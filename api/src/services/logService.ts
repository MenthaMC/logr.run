const crypto = require('crypto');
const fs = require('fs').promises;
const fsSync = require('fs');
const multer = require('multer');
const path = require('path');
const { pipeline, Transform, Writable } = require('stream');
const { promisify } = require('util');
const zlib = require('zlib');
const {
    CLEANUP_INTERVAL,
    CONFIG,
    LOG_ID_BYTES,
    MAX_CLIENT_TIME_BYTES,
    MAX_ERROR_BYTES,
    MAX_FORM_FIELD_BYTES,
    MAX_LOG_BYTES,
    MAX_ORIGINAL_NAME_BYTES,
    MAX_REASON_BYTES,
    MAX_REPORT_NAME_BYTES,
    MAX_UPLOAD_BYTES,
    RETENTION_DAYS,
    SHORT_ID_LENGTH,
    TMP_DIR
} = require('../config/env.ts');
const { logsDb } = require('./db.ts');
const { getUserFromToken } = require('./authService.ts');
const { analyzeLogContent, maskAnalysis, maskMetadata, maskSensitiveText } = require('./logAnalysisService.ts');
const { formatLogId, isTooLarge, isValidLogId, normalizeReason } = require('./helpers.ts');
const { createHttpError } = require('../utils/httpError.ts');

const pipelineAsync = promisify(pipeline);

const createSizeLimitStream = (maxBytes) => {
    let total = 0;
    return new Transform({
        transform(chunk, encoding, callback) {
            total += chunk.length;
            if (total > maxBytes) {
                const err = new Error('Log too large');
                err.code = 'LIMIT_EXCEEDED';
                callback(err);
                return;
            }
            callback(null, chunk);
        }
    });
};

const readLogContentFromPath = async (sourcePath, useGunzip) => {
    const chunks = [];
    const collector = new Writable({
        write(chunk, encoding, callback) {
            chunks.push(chunk);
            callback();
        }
    });

    const streams = [fsSync.createReadStream(sourcePath)];
    if (useGunzip) streams.push(zlib.createGunzip());
    streams.push(createSizeLimitStream(MAX_LOG_BYTES));
    streams.push(collector);
    await pipelineAsync(...streams);
    return Buffer.concat(chunks).toString('utf8');
};

const generateLogId = async () => {
    while (true) {
        const id = crypto.randomBytes(LOG_ID_BYTES).toString('hex');
        const row = await logsDb.get('SELECT id FROM logs WHERE id = $1', [id]);
        if (!row) return id;
    }
};

const resolveLogId = async (id) => {
    if (!isValidLogId(id)) return { error: createHttpError(400, 'Invalid Log ID') };
    if (id.length > SHORT_ID_LENGTH) return { id };

    const matches = await logsDb.all(
        'SELECT id FROM logs WHERE id LIKE $1 ORDER BY upload_time DESC LIMIT 2',
        [`${id}%`]
    );
    if (matches.length === 1) return { id: matches[0].id };
    if (matches.length === 0) return { error: createHttpError(404, 'Log not found') };
    return { error: createHttpError(409, 'Ambiguous Log ID') };
};

const getLogAccess = async (id) => {
    return logsDb.get(
        `SELECT logs.id, logs.plugin_id, COALESCE(logs.is_public, FALSE) AS is_public, plugins.user_id
         FROM logs
         LEFT JOIN plugins ON logs.plugin_id = plugins.id
         WHERE logs.id = $1`,
        [id]
    );
};

const canReadLog = (access, req) => {
    if (!access || !access.plugin_id) return true;
    if (Boolean(access.is_public)) return true;
    const user = getUserFromToken(req);
    return Boolean(user && user.id === access.user_id);
};

const buildLogMetadata = (log) => ({
    id: log.id,
    shortId: formatLogId(log.id),
    projectId: log.plugin_id || null,
    isPublic: log.plugin_id ? Boolean(log.is_public) : true,
    uploadTime: log.upload_time ? new Date(log.upload_time).toISOString() : null,
    reason: log.reason || 'MANUAL',
    originalName: log.original_name || null,
    reportName: log.report_name || null,
    error: log.error || null,
    clientTime: log.client_time || null
});

const createLogEntry = async (req) => {
    const id = await generateLogId();
    const rawToken = req.headers['x-auth-token']
        || req.headers['x-backend-token']
        || req.headers['x-project-token']
        || req.body.token
        || req.body.backendToken
        || req.body.projectToken;

    let projectToken = null;
    if (rawToken !== undefined && rawToken !== null && rawToken !== '') {
        if (typeof rawToken !== 'string') throw createHttpError(400, 'Invalid token');
        projectToken = rawToken.trim() || null;
    }

    let content = null;
    if (req.file) {
        const isGzip = req.file.mimetype === 'application/gzip' || req.file.originalname.endsWith('.gz');
        try {
            content = await readLogContentFromPath(req.file.path, isGzip);
        } catch (err) {
            if (isGzip && err && (err.code === 'Z_DATA_ERROR' || err.code === 'Z_BUF_ERROR')) {
                content = await readLogContentFromPath(req.file.path, false);
            } else {
                throw err;
            }
        }
    } else if (req.body.content) {
        if (typeof req.body.content !== 'string') throw createHttpError(400, 'Invalid content');
        if (Buffer.byteLength(req.body.content, 'utf8') > MAX_LOG_BYTES) throw createHttpError(413, 'Log too large');
        content = req.body.content;
    } else {
        throw createHttpError(400, 'No content provided');
    }

    if (req.body.reason && typeof req.body.reason !== 'string') throw createHttpError(400, 'Invalid reason');
    const reason = normalizeReason(req.body.reason);
    if (!reason) throw createHttpError(400, 'Invalid reason');

    const originalName = req.file ? req.file.originalname : null;
    if (originalName && isTooLarge(originalName, MAX_ORIGINAL_NAME_BYTES)) throw createHttpError(413, 'File name too large');

    if (req.body.reportName && typeof req.body.reportName !== 'string') throw createHttpError(400, 'Invalid reportName');
    if (req.body.reportName && isTooLarge(req.body.reportName, MAX_REPORT_NAME_BYTES)) throw createHttpError(413, 'reportName too large');
    const reportName = req.body.reportName || null;

    if (req.body.error && typeof req.body.error !== 'string') throw createHttpError(400, 'Invalid error');
    if (req.body.error && isTooLarge(req.body.error, MAX_ERROR_BYTES)) throw createHttpError(413, 'error too large');
    const error = req.body.error || null;

    if (req.body.timestamp && typeof req.body.timestamp !== 'string') throw createHttpError(400, 'Invalid timestamp');
    if (req.body.timestamp && isTooLarge(req.body.timestamp, MAX_CLIENT_TIME_BYTES)) throw createHttpError(413, 'timestamp too large');
    const clientTime = req.body.timestamp || null;

    let projectId = null;
    if (projectToken) {
        const project = await logsDb.get('SELECT id FROM plugins WHERE token = $1', [projectToken]);
        if (!project) throw createHttpError(401, 'Invalid token');
        projectId = project.id;
    }

    const analysis = analyzeLogContent(content);
    await logsDb.run(
        `INSERT INTO logs (id, plugin_id, reason, content, original_name, report_name, error, client_time, analysis_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, projectId, reason, content, originalName, reportName, error, clientTime, analysis]
    );

    if (projectId) {
        console.log(`[DB] Log ${id} linked to Project ${projectId}`);
    }

    return { id };
};

const parseMetaOnlyQuery = (query = {}) => {
    return query.meta === '1'
        || query.meta === 'true'
        || query.metadata === '1'
        || query.noContent === '1';
};

const getLog = async (req) => {
    const idParam = req.params.id;
    const metaOnly = parseMetaOnlyQuery(req.query);

    const resolved = await resolveLogId(idParam);
    if (resolved.error) throw resolved.error;
    const id = resolved.id;

    const access = await getLogAccess(id);
    if (!access) throw createHttpError(404, 'Log not found');
    if (!canReadLog(access, req)) throw createHttpError(403, 'RESTRICTED');

    const metaColumns = 'id, plugin_id, COALESCE(is_public, FALSE) AS is_public, reason, upload_time, original_name, report_name, error, client_time, analysis_json';
    const log = await logsDb.get(
        `SELECT ${metaOnly ? metaColumns : `${metaColumns}, content`}
         FROM logs WHERE id = $1`,
        [id]
    );
    if (!log) throw createHttpError(404, 'Log not found');

    let analysis = log.analysis_json || null;
    if (!metaOnly && !analysis) {
        analysis = analyzeLogContent(log.content);
        if (analysis) {
            await logsDb.run('UPDATE logs SET analysis_json = $1 WHERE id = $2', [analysis, id]);
        }
    }

    const metadata = buildLogMetadata(log);
    const maskedMetadata = maskMetadata(metadata);
    const maskedAnalysis = maskAnalysis(analysis);

    if (metaOnly) {
        return { success: true, metadata: maskedMetadata, analysis: maskedAnalysis };
    }

    return {
        success: true,
        content: maskSensitiveText(log.content),
        metadata: maskedMetadata,
        analysis: maskedAnalysis
    };
};

const updateLog = async (req) => {
    const idParam = req.params.id;
    const resolved = await resolveLogId(idParam);
    if (resolved.error) throw resolved.error;
    const id = resolved.id;

    const access = await getLogAccess(id);
    if (!access) throw createHttpError(404, 'Log not found');
    if (!access.plugin_id) throw createHttpError(403, 'RESTRICTED');
    const user = getUserFromToken(req);
    if (!user || user.id !== access.user_id) throw createHttpError(403, 'RESTRICTED');

    const updates = [];
    const values = [];
    let index = 1;

    if (req.body.reportName) {
        if (typeof req.body.reportName !== 'string') throw createHttpError(400, 'Invalid reportName');
        if (isTooLarge(req.body.reportName, MAX_REPORT_NAME_BYTES)) throw createHttpError(413, 'reportName too large');
        updates.push(`report_name = $${index++}`);
        values.push(req.body.reportName);
    }

    if (req.body.reason) {
        if (typeof req.body.reason !== 'string') throw createHttpError(400, 'Invalid reason');
        if (isTooLarge(req.body.reason, MAX_REASON_BYTES)) throw createHttpError(400, 'Invalid reason');
        updates.push(`reason = $${index++}`);
        values.push(String(req.body.reason).toUpperCase());
    }

    const nextIsPublic = req.body.isPublic ?? req.body.public ?? req.body.is_public;
    if (nextIsPublic !== undefined) {
        if (typeof nextIsPublic !== 'boolean') throw createHttpError(400, 'Invalid isPublic');
        updates.push(`is_public = $${index++}`);
        values.push(nextIsPublic);
    }

    if (updates.length === 0) throw createHttpError(400, 'No updates provided');

    values.push(id);
    const log = await logsDb.get(
        `UPDATE logs SET ${updates.join(', ')} WHERE id = $${index}
         RETURNING id, plugin_id, COALESCE(is_public, FALSE) AS is_public, reason, upload_time, original_name, report_name, error, client_time`,
        values
    );
    if (!log) throw createHttpError(404, 'Log not found');

    return { success: true, metadata: buildLogMetadata(log) };
};

const getRawLog = async (req) => {
    const idParam = req.params.id;
    const resolved = await resolveLogId(idParam);
    if (resolved.error) throw resolved.error;
    const id = resolved.id;

    const access = await getLogAccess(id);
    if (!access) throw createHttpError(404, 'Log not found');
    if (!canReadLog(access, req)) throw createHttpError(403, 'RESTRICTED');

    const log = await logsDb.get('SELECT content FROM logs WHERE id = $1', [id]);
    if (!log) throw createHttpError(404, 'Log not found');

    return maskSensitiveText(log.content);
};

const cleanupExpiredAnonymousLogs = async () => {
    const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - retentionMs);
    const result = await logsDb.run(
        'DELETE FROM logs WHERE plugin_id IS NULL AND upload_time < $1',
        [cutoff]
    );
    if (result.rowCount > 0) {
        console.log(`[Cleanup] Deleted ${result.rowCount} expired anonymous logs.`);
    }
};

const startCleanupTask = () => {
    setInterval(async () => {
        try {
            await cleanupExpiredAnonymousLogs();
        } catch (error) {
            console.error('[Cleanup] Error during cleanup task:', error);
        }
    }, CLEANUP_INTERVAL);

    cleanupExpiredAnonymousLogs().catch((error) => {
        console.error('[Cleanup] Error during cleanup task:', error);
    });
};

const createUploadMiddleware = () => {
    return multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => cb(null, TMP_DIR),
            filename: (req, file, cb) => {
                const suffix = crypto.randomBytes(8).toString('hex');
                const ext = path.extname(file.originalname) || '';
                cb(null, `${Date.now()}-${suffix}${ext}`);
            }
        }),
        limits: { fileSize: MAX_UPLOAD_BYTES, fieldSize: MAX_FORM_FIELD_BYTES }
    });
};

const ensureTmpDir = async () => {
    await fs.mkdir(TMP_DIR, { recursive: true });
};

const removeTempFile = async (filePath) => {
    if (!filePath) return;
    await fs.unlink(filePath).catch(() => {});
};

module.exports = {
    CONFIG,
    buildLogMetadata,
    canReadLog,
    createLogEntry,
    createUploadMiddleware,
    ensureTmpDir,
    formatLogId,
    getLog,
    getRawLog,
    removeTempFile,
    resolveLogId,
    startCleanupTask,
    updateLog
};
