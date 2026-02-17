const crypto = require('crypto');
const { logsDb } = require('./db.ts');
const { formatLogId, isValidLogId } = require('./helpers.ts');
const { createHttpError } = require('../utils/httpError.ts');

const parseProjectName = (value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
};

const parseProjectId = (projectId) => {
    const value = parseInt(projectId, 10);
    if (!Number.isFinite(value)) throw createHttpError(400, 'Invalid projectId');
    return value;
};

const ensureProjectOwnership = async (userId, projectId) => {
    const project = await logsDb.get(
        'SELECT id FROM plugins WHERE id = $1 AND user_id = $2',
        [projectId, userId]
    );
    if (!project) throw createHttpError(403, 'Permission denied');
};

const parseRangeMs = (rangeRaw) => {
    const range = String(rangeRaw || '7d').trim();
    const match = range.match(/^(\d+)(h|d|w)$/i);
    let ms = 7 * 24 * 60 * 60 * 1000;
    if (match) {
        const n = Math.max(1, Math.min(365, parseInt(match[1], 10)));
        const unit = match[2].toLowerCase();
        if (unit === 'h') ms = n * 60 * 60 * 1000;
        if (unit === 'd') ms = n * 24 * 60 * 60 * 1000;
        if (unit === 'w') ms = n * 7 * 24 * 60 * 60 * 1000;
    } else if (range === '24h') {
        ms = 24 * 60 * 60 * 1000;
    }
    return Math.min(ms, 365 * 24 * 60 * 60 * 1000);
};

const pickIssueTitle = (analysis) => {
    if (!analysis) return 'Unknown';
    const meta = analysis.meta || {};
    if (meta.causedBy) return meta.causedBy;
    if (meta.exceptionType) return meta.exceptionType;
    const signal = Array.isArray(analysis.signals) ? analysis.signals[0] : null;
    if (signal && signal.text) return signal.text.slice(0, 160);
    if (analysis.summary) return analysis.summary;
    return 'Unknown';
};

const pickIssueSeverity = (analysis, reason) => {
    const meta = analysis?.meta || {};
    if (meta.severity) return meta.severity;
    if (reason === 'CRASH') return 'error';
    const signals = Array.isArray(analysis?.signals) ? analysis.signals : [];
    if (signals.some((s) => s.severity === 'error')) return 'error';
    if (signals.some((s) => s.severity === 'warn')) return 'warn';
    return 'info';
};

const topOfCounts = (mapObj) => {
    if (!mapObj) return null;
    let bestKey = null;
    let best = -1;
    for (const [key, value] of Object.entries(mapObj)) {
        if (value > best) {
            best = value;
            bestKey = key;
        }
    }
    return bestKey;
};

const computeIssueSignature = (analysis) => {
    const metaSignature = analysis?.meta?.signature;
    if (typeof metaSignature === 'string' && metaSignature.trim()) {
        return metaSignature.trim().slice(0, 12);
    }
    const seed = String(pickIssueTitle(analysis) || 'Unknown').slice(0, 500);
    return crypto.createHash('sha1').update(seed).digest('hex').slice(0, 12);
};

const listUserProjects = (userId) => {
    return logsDb.all('SELECT * FROM plugins WHERE user_id = $1', [userId]);
};

const createUserProject = async (userId, name) => {
    const existing = await logsDb.get(
        'SELECT id FROM plugins WHERE user_id = $1 AND name = $2',
        [userId, name]
    );
    if (existing) throw createHttpError(409, 'Project name already exists');

    const token = crypto.randomBytes(16).toString('hex');
    const row = await logsDb.get(
        'INSERT INTO plugins (user_id, name, token) VALUES ($1, $2, $3) RETURNING id',
        [userId, name, token]
    );
    return { id: row.id, name, token };
};

const renameUserProject = async (userId, projectId, name) => {
    const existing = await logsDb.get(
        'SELECT id FROM plugins WHERE user_id = $1 AND name = $2 AND id != $3',
        [userId, name, projectId]
    );
    if (existing) throw createHttpError(409, 'Project name already exists');

    const result = await logsDb.run(
        'UPDATE plugins SET name = $1 WHERE id = $2 AND user_id = $3',
        [name, projectId, userId]
    );
    if (result.rowCount === 0) throw createHttpError(403, 'Permission denied');
};

const deleteUserProject = async (userId, projectId) => {
    const result = await logsDb.run(
        'DELETE FROM plugins WHERE id = $1 AND user_id = $2',
        [projectId, userId]
    );
    if (result.rowCount === 0) throw createHttpError(403, 'Permission denied');
};

const getProjectLogs = async (userId, projectId) => {
    const normalizedProjectId = parseProjectId(projectId);
    await ensureProjectOwnership(userId, normalizedProjectId);

    const logs = await logsDb.all(
        'SELECT id, reason, upload_time, COALESCE(is_public, FALSE) AS is_public FROM logs WHERE plugin_id = $1 ORDER BY upload_time DESC LIMIT 100',
        [normalizedProjectId]
    );

    return logs.map((log) => ({
        id: log.id,
        shortId: formatLogId(log.id),
        reason: log.reason,
        upload_time: log.upload_time,
        isPublic: Boolean(log.is_public)
    }));
};

const getProjectIssues = async (userId, projectId, { range = '7d', sort = 'lastSeen', limit = 2000 } = {}) => {
    const normalizedProjectId = parseProjectId(projectId);
    await ensureProjectOwnership(userId, normalizedProjectId);

    const rangeMs = parseRangeMs(range);
    const cutoff = new Date(Date.now() - rangeMs);
    const normalizedLimit = Math.min(5000, Math.max(50, parseInt(limit, 10) || 2000));

    const rows = await logsDb.all(
        `SELECT id, reason, upload_time, COALESCE(is_public, FALSE) AS is_public, analysis_json
         FROM logs
         WHERE plugin_id = $1 AND upload_time >= $2
         ORDER BY upload_time DESC
         LIMIT $3`,
        [normalizedProjectId, cutoff, normalizedLimit]
    );

    const groups = new Map();

    for (const row of rows) {
        const analysis = row.analysis_json || null;
        const meta = analysis?.meta || {};
        const signature = computeIssueSignature(analysis);
        const title = pickIssueTitle(analysis);
        const severity = pickIssueSeverity(analysis, row.reason);
        const uploadIso = row.upload_time ? new Date(row.upload_time).toISOString() : null;
        const minecraftVersion = meta.minecraftVersion || null;
        const loader = meta.loader || null;
        const clientType = meta.clientType || null;

        if (!groups.has(signature)) {
            groups.set(signature, {
                signature,
                title,
                severity,
                count: 0,
                firstSeen: uploadIso,
                lastSeen: uploadIso,
                topTags: { minecraftVersion: null, loader: null, clientType: null },
                _tagCounts: {
                    minecraftVersion: {},
                    loader: {},
                    clientType: {}
                }
            });
        }

        const current = groups.get(signature);
        current.count += 1;
        if (uploadIso) {
            if (!current.firstSeen || uploadIso < current.firstSeen) current.firstSeen = uploadIso;
            if (!current.lastSeen || uploadIso > current.lastSeen) current.lastSeen = uploadIso;
        }

        if (minecraftVersion) {
            current._tagCounts.minecraftVersion[minecraftVersion] = (current._tagCounts.minecraftVersion[minecraftVersion] || 0) + 1;
        }
        if (loader) {
            current._tagCounts.loader[loader] = (current._tagCounts.loader[loader] || 0) + 1;
        }
        if (clientType) {
            current._tagCounts.clientType[clientType] = (current._tagCounts.clientType[clientType] || 0) + 1;
        }
    }

    const issues = Array.from(groups.values()).map((item) => {
        item.topTags.minecraftVersion = topOfCounts(item._tagCounts.minecraftVersion);
        item.topTags.loader = topOfCounts(item._tagCounts.loader);
        item.topTags.clientType = topOfCounts(item._tagCounts.clientType);
        delete item._tagCounts;
        return item;
    });

    const normalizedSort = String(sort || 'lastSeen');
    issues.sort((a, b) => {
        if (normalizedSort === 'count') return (b.count || 0) - (a.count || 0);
        const timeA = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
        const timeB = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
        return timeB - timeA;
    });

    return issues;
};

const getProjectIssueDetail = async (userId, projectId, signature, { range = '7d', scanLimit = 5000, eventsLimit = 300 } = {}) => {
    const normalizedProjectId = parseProjectId(projectId);
    const normalizedSignature = String(signature || '').trim();
    if (!normalizedSignature) throw createHttpError(400, 'Invalid signature');

    await ensureProjectOwnership(userId, normalizedProjectId);

    const rangeMs = parseRangeMs(range);
    const cutoff = new Date(Date.now() - rangeMs);
    const normalizedScanLimit = Math.min(5000, Math.max(300, parseInt(scanLimit, 10) || 5000));
    const normalizedEventsLimit = Math.min(500, Math.max(20, parseInt(eventsLimit, 10) || 300));

    const rows = await logsDb.all(
        `SELECT id, reason, upload_time, COALESCE(is_public, FALSE) AS is_public, analysis_json
         FROM logs
         WHERE plugin_id = $1 AND upload_time >= $2
         ORDER BY upload_time DESC
         LIMIT $3`,
        [normalizedProjectId, cutoff, normalizedScanLimit]
    );

    const matched = rows.filter((row) => computeIssueSignature(row.analysis_json || null) === normalizedSignature);
    if (matched.length === 0) throw createHttpError(404, 'Issue not found');

    let firstSeen = null;
    let lastSeen = null;
    const timelineMap = {};
    const tagStats = {
        minecraftVersion: {},
        loader: {},
        clientType: {}
    };

    for (const row of matched) {
        const iso = row.upload_time ? new Date(row.upload_time).toISOString() : null;
        if (iso) {
            if (!firstSeen || iso < firstSeen) firstSeen = iso;
            if (!lastSeen || iso > lastSeen) lastSeen = iso;
            const day = iso.slice(0, 10);
            timelineMap[day] = (timelineMap[day] || 0) + 1;
        }

        const meta = row.analysis_json?.meta || {};
        if (meta.minecraftVersion) {
            tagStats.minecraftVersion[meta.minecraftVersion] = (tagStats.minecraftVersion[meta.minecraftVersion] || 0) + 1;
        }
        if (meta.loader) {
            tagStats.loader[meta.loader] = (tagStats.loader[meta.loader] || 0) + 1;
        }
        if (meta.clientType) {
            tagStats.clientType[meta.clientType] = (tagStats.clientType[meta.clientType] || 0) + 1;
        }
    }

    const timeline = Object.keys(timelineMap)
        .sort()
        .map((day) => ({ day, count: timelineMap[day] }));

    const sampleAnalysis = matched[0].analysis_json || null;
    const issue = {
        signature: normalizedSignature,
        title: pickIssueTitle(sampleAnalysis),
        severity: pickIssueSeverity(sampleAnalysis, matched[0].reason),
        count: matched.length,
        firstSeen,
        lastSeen
    };

    const events = matched.slice(0, normalizedEventsLimit).map((row) => {
        const analysis = row.analysis_json || null;
        const meta = analysis?.meta || {};
        return {
            id: row.id,
            shortId: formatLogId(row.id),
            uploadTime: row.upload_time ? new Date(row.upload_time).toISOString() : null,
            reason: row.reason || 'MANUAL',
            isPublic: Boolean(row.is_public),
            summary: analysis?.summary || null,
            meta: {
                minecraftVersion: meta.minecraftVersion || null,
                loader: meta.loader || null,
                clientType: meta.clientType || null
            }
        };
    });

    return {
        issue,
        timeline,
        tagStats,
        events
    };
};

const deleteLogsBatch = async (userId, ids) => {
    if (!Array.isArray(ids) || ids.length === 0) throw createHttpError(400, 'Invalid IDs');

    const result = await logsDb.run(
        `DELETE FROM logs
         USING plugins
         WHERE logs.plugin_id = plugins.id
           AND logs.id = ANY($1::text[])
           AND plugins.user_id = $2`,
        [ids, userId]
    );

    return result.rowCount;
};

const updateLogsBatchVisibility = async (userId, ids, isPublic) => {
    if (!Array.isArray(ids) || ids.length === 0) throw createHttpError(400, 'Invalid IDs');
    if (typeof isPublic !== 'boolean') throw createHttpError(400, 'Invalid isPublic');

    const result = await logsDb.run(
        `UPDATE logs
         SET is_public = $3
         FROM plugins
         WHERE logs.plugin_id = plugins.id
           AND logs.id = ANY($1::text[])
           AND plugins.user_id = $2`,
        [ids, userId, isPublic]
    );

    return result.rowCount;
};

const deleteSingleLog = async (userId, id) => {
    if (!isValidLogId(id)) throw createHttpError(400, 'Invalid ID');

    const result = await logsDb.run(
        `DELETE FROM logs
         USING plugins
         WHERE logs.plugin_id = plugins.id
           AND logs.id = $1
           AND plugins.user_id = $2`,
        [id, userId]
    );
    if (result.rowCount === 0) throw createHttpError(403, 'Permission denied');
};

module.exports = {
    createUserProject,
    deleteLogsBatch,
    deleteSingleLog,
    deleteUserProject,
    getProjectIssueDetail,
    getProjectIssues,
    getProjectLogs,
    listUserProjects,
    parseProjectName,
    renameUserProject,
    updateLogsBatchVisibility
};
