const express = require('express');
const cors = require('cors');
const multer = require('multer');
const zlib = require('zlib');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { Transform, Writable, pipeline } = require('stream');
const { promisify } = require('util');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const pipelineAsync = promisify(pipeline);

const app = express();

const TMP_DIR = path.join(__dirname, 'tmp');

const NODE_ENV = process.env.NODE_ENV || 'development';
const CONFIG = {
    PORT: parseInt(process.env.PORT, 10) || 4000,
    FRONTEND_BASE_URL: process.env.FRONTEND_BASE_URL || "http://localhost:5173"
};

const SECRET_KEY = process.env.SECRET_KEY || "DEV_SECRET_KEY_123";
const USERS_DATABASE_URL = process.env.USERS_DATABASE_URL || process.env.DATABASE_URL;
const LOGS_DATABASE_URL = process.env.LOGS_DATABASE_URL || process.env.DATABASE_URL;
const TOKEN_TTL = process.env.TOKEN_TTL || "7d";
const MAX_UPLOAD_BYTES = parseInt(process.env.MAX_UPLOAD_BYTES, 10) || 10 * 1024 * 1024;
const MAX_LOG_BYTES = parseInt(process.env.MAX_LOG_BYTES, 10) || 10 * 1024 * 1024;
const LOG_ID_BYTES = parseInt(process.env.LOG_ID_BYTES, 10) || 12;
const SHORT_ID_LENGTH = parseInt(process.env.SHORT_ID_LENGTH, 10) || 7;
const MAX_USERNAME_LENGTH = parseInt(process.env.MAX_USERNAME_LENGTH, 10) || 64;
const MAX_PASSWORD_LENGTH = parseInt(process.env.MAX_PASSWORD_LENGTH, 10) || 72;
const MAX_REASON_BYTES = parseInt(process.env.MAX_REASON_BYTES, 10) || 64;
const MAX_REPORT_NAME_BYTES = parseInt(process.env.MAX_REPORT_NAME_BYTES, 10) || 1024;
const MAX_ORIGINAL_NAME_BYTES = parseInt(process.env.MAX_ORIGINAL_NAME_BYTES, 10) || 1024;
const MAX_ERROR_BYTES = parseInt(process.env.MAX_ERROR_BYTES, 10) || 64 * 1024;
const MAX_CLIENT_TIME_BYTES = parseInt(process.env.MAX_CLIENT_TIME_BYTES, 10) || 128;
const MAX_FORM_FIELD_BYTES = parseInt(process.env.MAX_FORM_FIELD_BYTES, 10) || 64 * 1024;
const ANALYSIS_MAX_LINES = parseInt(process.env.ANALYSIS_MAX_LINES, 10) || 5000;
const ANALYSIS_MAX_SIGNALS = parseInt(process.env.ANALYSIS_MAX_SIGNALS, 10) || 25;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || CONFIG.FRONTEND_BASE_URL || "")
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const PG_SSL = process.env.PG_SSL === 'true';
const PG_SSL_REJECT_UNAUTHORIZED = process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false';
const createPool = (connectionString, label) => {
    const pool = new Pool({
        connectionString,
        ssl: PG_SSL ? { rejectUnauthorized: PG_SSL_REJECT_UNAUTHORIZED } : undefined
    });
    pool.on('error', (err) => {
        console.error(`PG pool error (${label}):`, err);
    });
    return pool;
};

const usersPool = createPool(USERS_DATABASE_URL, 'users');
const logsPool = createPool(LOGS_DATABASE_URL, 'logs');

if (NODE_ENV === 'production') {
    if (!process.env.SECRET_KEY) throw new Error("SECRET_KEY is required");
    if (!process.env.USERS_DATABASE_URL && !process.env.DATABASE_URL) throw new Error("USERS_DATABASE_URL is required");
    if (!process.env.LOGS_DATABASE_URL && !process.env.DATABASE_URL) throw new Error("LOGS_DATABASE_URL is required");
    if (!process.env.FRONTEND_BASE_URL) throw new Error("FRONTEND_BASE_URL is required");
    if (!process.env.TURNSTILE_SECRET_KEY) throw new Error("TURNSTILE_SECRET_KEY is required");
}

const isValidLogId = (id) => /^[a-zA-Z0-9_-]{1,64}$/.test(id);
const isTooLarge = (value, maxBytes) => Buffer.byteLength(value, 'utf8') > maxBytes;
const isWeakPassword = (password) => {
    if (password.length < 8) return true;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return !hasLetter || !hasNumber;
};
const formatLogId = (value) => {
    if (!value) return null;
    return value.length > SHORT_ID_LENGTH ? value.slice(0, SHORT_ID_LENGTH) : value;
};

const ANALYSIS_PATTERNS = [
    {
        code: 'OUT_OF_MEMORY',
        regex: /OutOfMemoryError/i,
        severity: 'error',
        hint: 'OutOfMemoryError detected. Increase memory or reduce mods/plugins.'
    },
    {
        code: 'STACK_OVERFLOW',
        regex: /StackOverflowError/i,
        severity: 'error',
        hint: 'StackOverflowError detected. A mod/plugin may be stuck in recursive calls.'
    },
    {
        code: 'CLASS_NOT_FOUND',
        regex: /(ClassNotFoundException|NoClassDefFoundError)/i,
        severity: 'error',
        hint: 'Missing class detected. Check mod/plugin dependencies and version compatibility.'
    },
    {
        code: 'NO_SUCH_METHOD',
        regex: /NoSuchMethodError/i,
        severity: 'error',
        hint: 'NoSuchMethodError detected. Likely incompatible mod/plugin versions.'
    },
    {
        code: 'MOD_RESOLUTION',
        regex: /(Missing\s+mods|Missing Mods|ModResolutionException|ModLoadingException|Failed to load mod)/i,
        severity: 'error',
        hint: 'Mod resolution failed. Check missing or incompatible mods.'
    },
    {
        code: 'MIXIN_FAILED',
        regex: /(Mixin apply failed|MixinApplyError|MixinTransformerError)/i,
        severity: 'error',
        hint: 'Mixin apply failed. Check mod/loader compatibility.'
    },
    {
        code: 'PLUGIN_EXCEPTION',
        regex: /(Exception in thread|Caused by:)/i,
        severity: 'warn',
        hint: 'Exception detected. Check the stack trace near this line.'
    }
];

const MASK_RULES = [
    { regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: '***.***.***.***' },
    { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: '***@***.***' },
    { regex: /((?:password|passwd|pwd|secret|token|api_key|auth|access_key)["']?\s*[:=]\s*["']?)([^"'\s]+)(["']?)/gi, replacement: '$1********$3' },
    { regex: /\b(1[3-9]\d{2})\d{4}(\d{4})\b/g, replacement: '$1****$2' }
];

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || "";
const TURNSTILE_BYPASS = process.env.TURNSTILE_BYPASS === 'true';
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const verifyTurnstile = (token, remoteIp) => {
    if (TURNSTILE_BYPASS || !TURNSTILE_SECRET_KEY) {
        return Promise.resolve({ ok: true });
    }
    if (!token) return Promise.resolve({ ok: false, error: 'Captcha required' });

    const payload = new URLSearchParams();
    payload.set('secret', TURNSTILE_SECRET_KEY);
    payload.set('response', token);
    if (remoteIp) payload.set('remoteip', remoteIp);

    const body = payload.toString();

    return new Promise((resolve) => {
        const req = https.request(
            TURNSTILE_VERIFY_URL,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(body)
                }
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk.toString('utf8');
                });
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        if (result && result.success) return resolve({ ok: true });
                        const codes = Array.isArray(result && result['error-codes']) ? result['error-codes'] : [];
                        if (codes.includes('missing-input-response')) {
                            return resolve({ ok: false, error: 'Captcha required' });
                        }
                        if (codes.includes('timeout-or-duplicate')) {
                            return resolve({ ok: false, error: 'Captcha expired' });
                        }
                        return resolve({ ok: false, error: 'Invalid captcha' });
                    } catch {
                        return resolve({ ok: false, error: 'Invalid captcha' });
                    }
                });
            }
        );
        req.on('error', () => resolve({ ok: false, error: 'Invalid captcha' }));
        req.write(body);
        req.end();
    });
};

const maskSensitiveText = (text) => {
    if (typeof text !== 'string') return text;
    let masked = text;
    for (const rule of MASK_RULES) {
        masked = masked.replace(rule.regex, rule.replacement);
    }
    return masked;
};

const maskMetadata = (metadata) => {
    if (!metadata || typeof metadata !== 'object') return metadata;
    return { ...metadata, error: maskSensitiveText(metadata.error) };
};

const maskAnalysis = (analysis) => {
    if (!analysis || typeof analysis !== 'object') return analysis;
    const masked = {
        ...analysis,
        summary: maskSensitiveText(analysis.summary),
        meta: analysis.meta ? { ...analysis.meta } : analysis.meta,
        signals: Array.isArray(analysis.signals)
            ? analysis.signals.map((signal) => ({
                ...signal,
                text: maskSensitiveText(signal.text)
            }))
            : analysis.signals
    };
    if (masked.meta) {
        for (const key of Object.keys(masked.meta)) {
            if (typeof masked.meta[key] === 'string') {
                masked.meta[key] = maskSensitiveText(masked.meta[key]);
            }
        }
    }
    return masked;
};

const analyzeLogContent = (content) => {
    if (!content) return null;
    const lines = content.split(/\r?\n/);
    const totalLines = lines.length;
    const scanStart = Math.max(0, totalLines - ANALYSIS_MAX_LINES);

    let errorCount = 0;
    let warnCount = 0;
    let crashDetected = false;
    let minecraftVersion = null;
    let loader = null;
    let javaVersion = null;
    let os = null;
    let runtime = null;
    let clientType = null;

    const signals = [];
    const hints = new Set();

    const pushSignal = (lineIndex, text, code, severity) => {
        if (signals.length >= ANALYSIS_MAX_SIGNALS) return;
        signals.push({
            line: lineIndex + 1,
            text: text.slice(0, 500),
            code,
            severity
        });
    };

    for (let i = 0; i < totalLines; i += 1) {
        const line = lines[i];
        if (!line) continue;

        if (line.includes('ERROR')) errorCount += 1;
        if (line.includes('WARN')) warnCount += 1;

        if (!minecraftVersion) {
            const match = line.match(/Minecraft(?:\s+Version)?[:=]\s*([0-9.]+)/i)
                || line.match(/MC\s*Version[:=]\s*([0-9.]+)/i);
            if (match) minecraftVersion = match[1];
        }
        if (!javaVersion) {
            const match = line.match(/Java\s+Version[:=]\s*([^\s,]+.*)/i)
                || line.match(/java version\s+"([^"]+)"/i);
            if (match) javaVersion = match[1];
        }
        if (!os) {
            const match = line.match(/Operating System:\s*(.*)/i)
                || line.match(/OS:\s*(.*)/i);
            if (match) os = match[1];
        }
        if (!runtime) {
            const match = line.match(/JVM\s+Flags:\s*(.*)/i);
            if (match) runtime = match[1];
        }
        if (!loader) {
            if (/Fabric Loader/i.test(line) || /fabric-loader/i.test(line)) loader = 'Fabric';
            else if (/Quilt Loader/i.test(line)) loader = 'Quilt';
            else if (/Forge Mod Loader|MinecraftForge|FML/i.test(line)) loader = 'Forge';
            else if (/Paper|Spigot|Bukkit/i.test(line)) loader = 'Paper/Spigot';
        }
        if (!clientType) {
            if (/Server thread|Dedicated Server|Starting minecraft server/i.test(line)) clientType = 'server';
            if (/Client thread|Minecraft client/i.test(line)) clientType = 'client';
        }

        if (!crashDetected && /---- Minecraft Crash Report ----/i.test(line)) {
            crashDetected = true;
        }

        if (i < scanStart) continue;

        for (const pattern of ANALYSIS_PATTERNS) {
            if (pattern.regex.test(line)) {
                pushSignal(i, line, pattern.code, pattern.severity);
                if (pattern.hint) hints.add(pattern.hint);
                break;
            }
        }
    }

    const summary = crashDetected
        ? 'Crash report detected.'
        : (signals.length > 0 ? 'Potential issues detected.' : 'No obvious crash detected.');

    return {
        summary,
        meta: {
            minecraftVersion,
            loader,
            javaVersion,
            os,
            runtime,
            clientType
        },
        stats: {
            lines: totalLines,
            errors: errorCount,
            warnings: warnCount
        },
        signals,
        hints: Array.from(hints)
    };
};

const getUserFromToken = (req) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return null;
    try {
        return jwt.verify(token, SECRET_KEY);
    } catch {
        return null;
    }
};

const getLogAccess = async (id) => {
    return await dbAsync.get(
        `SELECT logs.id, logs.plugin_id, COALESCE(logs.is_public, FALSE) AS is_public, plugins.user_id
         FROM logs
         LEFT JOIN plugins ON logs.plugin_id = plugins.id
         WHERE logs.id = $1`,
        [id]
    );
};

const RATE_LIMIT_BACKEND = (process.env.RATE_LIMIT_BACKEND || (NODE_ENV === 'production' ? 'db' : 'memory')).toLowerCase();
const inMemoryRateLimits = new Map();
const createRateLimiter = ({ windowMs, max, keyPrefix }) => {
    return async (req, res, next) => {
        const ip = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
        const key = `${keyPrefix}:${ip}`;
        const now = Date.now();

        if (RATE_LIMIT_BACKEND === 'db') {
            try {
                const resetAt = new Date(now + windowMs);
                const row = await dbAsync.get(
                    `INSERT INTO rate_limits (key, count, reset_at)
                     VALUES ($1, 1, $2)
                     ON CONFLICT (key)
                     DO UPDATE SET
                       count = CASE WHEN rate_limits.reset_at <= NOW()
                         THEN 1
                         ELSE rate_limits.count + 1
                       END,
                       reset_at = CASE WHEN rate_limits.reset_at <= NOW()
                         THEN $2
                         ELSE rate_limits.reset_at
                       END
                     RETURNING count, reset_at`,
                    [key, resetAt]
                );
                if (row && row.count > max) {
                    return res.status(429).json({ error: "Too many requests" });
                }
                return next();
            } catch (err) {
                console.error('[RateLimit] DB error:', err);
                return next();
            }
        }

        const entry = inMemoryRateLimits.get(key);
        if (!entry || entry.resetAt <= now) {
            inMemoryRateLimits.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }
        entry.count += 1;
        if (entry.count > max) {
            return res.status(429).json({ error: "Too many requests" });
        }
        return next();
    };
};

const createSizeLimitStream = (maxBytes) => {
    let total = 0;
    return new Transform({
        transform(chunk, encoding, callback) {
            total += chunk.length;
            if (total > maxBytes) {
                const err = new Error("Log too large");
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
        const row = await dbAsync.get("SELECT id FROM logs WHERE id = $1", [id]);
        if (!row) return id;
    }
};

const createHttpError = (status, message) => {
    const error = new Error(message);
    error.status = status;
    return error;
};

const resolveLogId = async (id) => {
    if (!isValidLogId(id)) {
        return { error: createHttpError(400, "Invalid Log ID") };
    }
    if (id.length > SHORT_ID_LENGTH) {
        return { id };
    }
    const matches = await dbAsync.all(
        "SELECT id FROM logs WHERE id LIKE $1 ORDER BY upload_time DESC LIMIT 2",
        [`${id}%`]
    );
    if (matches.length === 1) {
        return { id: matches[0].id };
    }
    if (matches.length === 0) {
        return { error: createHttpError(404, "Log not found") };
    }
    return { error: createHttpError(409, "Ambiguous Log ID") };
};

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
        if (typeof rawToken !== 'string') {
            throw createHttpError(400, "Invalid token");
        }
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
        if (typeof req.body.content !== 'string') {
            throw createHttpError(400, "Invalid content");
        }
        if (Buffer.byteLength(req.body.content, 'utf8') > MAX_LOG_BYTES) {
            throw createHttpError(413, "Log too large");
        }
        content = req.body.content;
    } else {
        throw createHttpError(400, "No content provided");
    }

    if (req.body.reason && typeof req.body.reason !== 'string') {
        throw createHttpError(400, "Invalid reason");
    }
    const reason = String(req.body.reason || "MANUAL").toUpperCase();
    if (isTooLarge(reason, MAX_REASON_BYTES)) {
        throw createHttpError(400, "Invalid reason");
    }
    const originalName = req.file ? req.file.originalname : null;
    if (originalName && isTooLarge(originalName, MAX_ORIGINAL_NAME_BYTES)) {
        throw createHttpError(413, "File name too large");
    }
    if (req.body.reportName && typeof req.body.reportName !== 'string') {
        throw createHttpError(400, "Invalid reportName");
    }
    if (req.body.reportName && isTooLarge(req.body.reportName, MAX_REPORT_NAME_BYTES)) {
        throw createHttpError(413, "reportName too large");
    }
    const reportName = req.body.reportName || null;
    if (req.body.error && typeof req.body.error !== 'string') {
        throw createHttpError(400, "Invalid error");
    }
    if (req.body.error && isTooLarge(req.body.error, MAX_ERROR_BYTES)) {
        throw createHttpError(413, "error too large");
    }
    const error = req.body.error || null;
    if (req.body.timestamp && typeof req.body.timestamp !== 'string') {
        throw createHttpError(400, "Invalid timestamp");
    }
    if (req.body.timestamp && isTooLarge(req.body.timestamp, MAX_CLIENT_TIME_BYTES)) {
        throw createHttpError(413, "timestamp too large");
    }
    const clientTime = req.body.timestamp || null;

    let projectId = null;
    if (projectToken) {
        const project = await dbAsync.get("SELECT id FROM plugins WHERE token = $1", [projectToken]);
        if (!project) {
            throw createHttpError(401, "Invalid token");
        }
        projectId = project.id;
    }

    const analysis = analyzeLogContent(content);
    await dbAsync.run(
        `INSERT INTO logs (id, plugin_id, reason, content, original_name, report_name, error, client_time, analysis_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, projectId, reason, content, originalName, reportName, error, clientTime, analysis]
    );

    if (projectId) {
        console.log(`[DB] Log ${id} linked to Project ${projectId}`);
    }

    return { id };
};

const usersDb = {
    run: (sql, params = []) => usersPool.query(sql, params),
    get: async (sql, params = []) => {
        const result = await usersPool.query(sql, params);
        return result.rows[0];
    },
    all: async (sql, params = []) => {
        const result = await usersPool.query(sql, params);
        return result.rows;
    }
};

const dbAsync = {
    run: (sql, params = []) => logsPool.query(sql, params),
    get: async (sql, params = []) => {
        const result = await logsPool.query(sql, params);
        return result.rows[0];
    },
    all: async (sql, params = []) => {
        const result = await logsPool.query(sql, params);
        return result.rows;
    }
};

(async () => {
    try {
        await usersDb.run(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )`);
        await dbAsync.run(`CREATE TABLE IF NOT EXISTS plugins (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            name TEXT,
            token TEXT UNIQUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )`);
        await dbAsync.run(`CREATE TABLE IF NOT EXISTS logs (
            id TEXT PRIMARY KEY,
            plugin_id INTEGER REFERENCES plugins(id) ON DELETE CASCADE,
            is_public BOOLEAN DEFAULT FALSE,
            reason TEXT,
            upload_time TIMESTAMPTZ DEFAULT NOW(),
            content TEXT NOT NULL,
            original_name TEXT,
            report_name TEXT,
            error TEXT,
            client_time TEXT,
            analysis_json JSONB
        )`);
        await dbAsync.run(`ALTER TABLE logs ADD COLUMN IF NOT EXISTS analysis_json JSONB`);
        await dbAsync.run(`ALTER TABLE logs ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE`);
        await dbAsync.run(`CREATE INDEX IF NOT EXISTS idx_logs_plugin_time ON logs (plugin_id, upload_time DESC)`);
        await dbAsync.run(`CREATE TABLE IF NOT EXISTS rate_limits (
            key TEXT PRIMARY KEY,
            count INTEGER NOT NULL,
            reset_at TIMESTAMPTZ NOT NULL
        )`);
        console.log("Database initialized");
    } catch (err) {
        console.error("Database init failed:", err);
    }
})();

if (process.env.TRUST_PROXY) {
    app.set('trust proxy', process.env.TRUST_PROXY);
}

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (CORS_ORIGINS.includes('*')) return callback(null, true);
        if (CORS_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
    }
};

app.use(cors(corsOptions));
app.use(express.json({ limit: MAX_LOG_BYTES }));
app.use(express.urlencoded({ extended: false, limit: MAX_LOG_BYTES }));

app.get('/health', (req, res) => {
    res.json({
        ok: true,
        time: new Date().toISOString()
    });
});

app.get('/debug/cors', (req, res) => {
    res.json({
        origin: req.headers.origin || null,
        allowed: CORS_ORIGINS
    });
});

const authLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 10, keyPrefix: 'auth' });
const uploadLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20, keyPrefix: 'upload' });
const RATE_LIMIT_MEMORY_CLEANUP_INTERVAL = 10 * 60 * 1000;

if (RATE_LIMIT_BACKEND !== 'db') {
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of inMemoryRateLimits.entries()) {
            if (entry.resetAt <= now) inMemoryRateLimits.delete(key);
        }
    }, RATE_LIMIT_MEMORY_CLEANUP_INTERVAL);
} else {
    setInterval(async () => {
        try {
            await dbAsync.run("DELETE FROM rate_limits WHERE reset_at <= NOW()");
        } catch (err) {
            console.error('[RateLimit] Cleanup failed:', err);
        }
    }, RATE_LIMIT_MEMORY_CLEANUP_INTERVAL);
}

(async () => {
    try {
        await fs.mkdir(TMP_DIR, { recursive: true });
    } catch (e) {}
})();

const upload = multer({
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

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

app.post('/auth/register', authLimiter, async (req, res) => {
    const { username, password, confirmPassword } = req.body;
    const turnstileToken = req.body.turnstileToken || req.body.captchaToken || req.body['cf-turnstile-response'];
    const captchaCheck = await verifyTurnstile(turnstileToken, req.ip);
    if (!captchaCheck.ok) return res.status(400).json({ error: captchaCheck.error });
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });
    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: "Invalid fields" });
    }
    if (confirmPassword !== undefined && typeof confirmPassword !== 'string') {
        return res.status(400).json({ error: "Invalid fields" });
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
        return res.status(400).json({ error: "Password mismatch" });
    }
    if (username.length > MAX_USERNAME_LENGTH) {
        return res.status(400).json({ error: "Username too long" });
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
        return res.status(400).json({ error: "Password too long" });
    }
    if (isWeakPassword(password)) {
        return res.status(400).json({ error: "Weak password" });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await usersDb.run("INSERT INTO users (username, password) VALUES ($1, $2)", [username, hashedPassword]);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: "Username already exists or error" });
    }
});

app.post('/auth/login', authLimiter, async (req, res) => {
    const { username, password } = req.body;
    const turnstileToken = req.body.turnstileToken || req.body.captchaToken || req.body['cf-turnstile-response'];
    const captchaCheck = await verifyTurnstile(turnstileToken, req.ip);
    if (!captchaCheck.ok) return res.status(400).json({ error: captchaCheck.error });
    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: "Invalid fields" });
    }
    if (username.length > MAX_USERNAME_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
        return res.status(400).json({ error: "Invalid credentials" });
    }
    try {
        const user = await usersDb.get("SELECT * FROM users WHERE username = $1", [username]);
        if (!user) {
            return res.status(400).json({ error: "User not found" });
        }
        if (!(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ error: "Invalid credentials" });
        }
        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: TOKEN_TTL });
        res.json({ success: true, token, username: user.username });
    } catch (err) {
        res.status(500).json({ error: "Internal error" });
    }
});


app.get('/dashboard/projects', authenticateToken, async (req, res) => {
    try {
        const rows = await dbAsync.all("SELECT * FROM plugins WHERE user_id = $1", [req.user.id]);
        res.json({ success: true, projects: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/dashboard/plugins', authenticateToken, async (req, res) => {
    try {
        const rows = await dbAsync.all("SELECT * FROM plugins WHERE user_id = $1", [req.user.id]);
        res.json({ success: true, plugins: rows, projects: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/dashboard/projects', authenticateToken, async (req, res) => {
    if (!req.body.name) return res.status(400).json({ error: "Name required" });
    const token = crypto.randomBytes(16).toString('hex');
    try {
        const existing = await dbAsync.get(
            "SELECT id FROM plugins WHERE user_id = $1 AND name = $2",
            [req.user.id, req.body.name]
        );
        if (existing) return res.status(409).json({ error: "Project name already exists" });

        const row = await dbAsync.get(
            "INSERT INTO plugins (user_id, name, token) VALUES ($1, $2, $3) RETURNING id",
            [req.user.id, req.body.name, token]
        );
        res.json({ success: true, project: { id: row.id, name: req.body.name, token } });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/dashboard/plugins', authenticateToken, async (req, res) => {
    if (!req.body.name) return res.status(400).json({ error: "Name required" });
    const token = crypto.randomBytes(16).toString('hex');
    try {
        const existing = await dbAsync.get(
            "SELECT id FROM plugins WHERE user_id = $1 AND name = $2",
            [req.user.id, req.body.name]
        );
        if (existing) return res.status(409).json({ error: "Project name already exists" });

        const row = await dbAsync.get(
            "INSERT INTO plugins (user_id, name, token) VALUES ($1, $2, $3) RETURNING id",
            [req.user.id, req.body.name, token]
        );
        const project = { id: row.id, name: req.body.name, token };
        res.json({ success: true, plugin: project, project });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.put('/dashboard/projects/:id', authenticateToken, async (req, res) => {
    try {
        const existing = await dbAsync.get(
            "SELECT id FROM plugins WHERE user_id = $1 AND name = $2 AND id != $3",
            [req.user.id, req.body.name, req.params.id]
        );
        if (existing) return res.status(409).json({ error: "Project name already exists" });

        const result = await dbAsync.run(
            "UPDATE plugins SET name = $1 WHERE id = $2 AND user_id = $3",
            [req.body.name, req.params.id, req.user.id]
        );
        if (result.rowCount === 0) return res.status(403).json({ error: "Permission denied" });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/dashboard/plugins/:id', authenticateToken, async (req, res) => {
    try {
        const existing = await dbAsync.get(
            "SELECT id FROM plugins WHERE user_id = $1 AND name = $2 AND id != $3",
            [req.user.id, req.body.name, req.params.id]
        );
        if (existing) return res.status(409).json({ error: "Project name already exists" });

        const result = await dbAsync.run(
            "UPDATE plugins SET name = $1 WHERE id = $2 AND user_id = $3",
            [req.body.name, req.params.id, req.user.id]
        );
        if (result.rowCount === 0) return res.status(403).json({ error: "Permission denied" });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/dashboard/projects/:id', authenticateToken, async (req, res) => {
    try {
        const result = await dbAsync.run(
            "DELETE FROM plugins WHERE id = $1 AND user_id = $2",
            [req.params.id, req.user.id]
        );
        if (result.rowCount === 0) return res.status(403).json({ error: "Permission denied" });

        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false });
    }
});

app.delete('/dashboard/plugins/:id', authenticateToken, async (req, res) => {
    try {
        const result = await dbAsync.run(
            "DELETE FROM plugins WHERE id = $1 AND user_id = $2",
            [req.params.id, req.user.id]
        );
        if (result.rowCount === 0) return res.status(403).json({ error: "Permission denied" });

        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false });
    }
});

app.get('/dashboard/logs/:projectId', authenticateToken, async (req, res) => {
    try {
        const project = await dbAsync.get(
            "SELECT id FROM plugins WHERE id = $1 AND user_id = $2",
            [req.params.projectId, req.user.id]
        );
        if (!project) return res.status(403).send();
        
        const logs = await dbAsync.all(
            "SELECT id, reason, upload_time, COALESCE(is_public, FALSE) AS is_public FROM logs WHERE plugin_id = $1 ORDER BY upload_time DESC LIMIT 100",
            [req.params.projectId]
        );
        const formattedLogs = logs.map((log) => ({
            id: log.id,
            shortId: formatLogId(log.id),
            reason: log.reason,
            upload_time: log.upload_time,
            isPublic: Boolean(log.is_public)
        }));
        res.json({ success: true, logs: formattedLogs });
    } catch (e) { res.status(500).send(); }
});

app.delete('/dashboard/logs/batch', authenticateToken, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "Invalid IDs" });

        const result = await dbAsync.run(`
            DELETE FROM logs
            USING plugins
            WHERE logs.plugin_id = plugins.id
              AND logs.id = ANY($1::text[])
              AND plugins.user_id = $2
        `, [ids, req.user.id]);

        res.json({ success: true, count: result.rowCount });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/dashboard/logs/batch/visibility', authenticateToken, async (req, res) => {
    try {
        const { ids, isPublic } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "Invalid IDs" });
        if (typeof isPublic !== 'boolean') return res.status(400).json({ error: "Invalid isPublic" });

        const result = await dbAsync.run(`
            UPDATE logs
            SET is_public = $3
            FROM plugins
            WHERE logs.plugin_id = plugins.id
              AND logs.id = ANY($1::text[])
              AND plugins.user_id = $2
        `, [ids, req.user.id, isPublic]);

        res.json({ success: true, count: result.rowCount });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/dashboard/logs/:id', authenticateToken, async (req, res) => {
    try {
        if (!isValidLogId(req.params.id)) return res.status(400).json({ error: "Invalid ID" });

        const result = await dbAsync.run(`
            DELETE FROM logs
            USING plugins
            WHERE logs.plugin_id = plugins.id
              AND logs.id = $1
              AND plugins.user_id = $2
        `, [req.params.id, req.user.id]);

        if (result.rowCount === 0) return res.status(403).json({ error: "Permission denied" });

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});


app.post('/logs', uploadLimiter, upload.single('file'), async (req, res) => {
    const tempPath = req.file ? req.file.path : null;
    try {
        const { id } = await createLogEntry(req);
        const viewUrl = `${CONFIG.FRONTEND_BASE_URL}/view/${id}`;
        res.header('Location', viewUrl);
        res.json({ success: true, id, shortId: formatLogId(id), url: viewUrl });
    } catch (error) {
        if (error && error.code === 'LIMIT_EXCEEDED') {
            return res.status(413).json({ success: false, error: "Log too large" });
        }
        if (error && error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        console.error(error);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    } finally {
        if (tempPath) {
            await fs.unlink(tempPath).catch(() => {});
        }
    }
});

app.get('/logs/:id', async (req, res) => {
    try {
        const idParam = req.params.id;
        const metaOnly = req.query.meta === '1'
            || req.query.meta === 'true'
            || req.query.metadata === '1'
            || req.query.noContent === '1';
        
        const resolved = await resolveLogId(idParam);
        if (resolved.error) {
            return res.status(resolved.error.status).json({ error: resolved.error.message });
        }
        const id = resolved.id;

        const access = await getLogAccess(id);
        if (!access) {
            return res.status(404).json({ success: false, error: "Log not found" });
        }
        if (access.plugin_id) {
            const isPublic = Boolean(access.is_public);
            if (!isPublic) {
                const user = getUserFromToken(req);
                if (!user || user.id !== access.user_id) {
                    return res.status(403).json({ error: "RESTRICTED" });
                }
            }
        }

        const metaColumns = "id, plugin_id, COALESCE(is_public, FALSE) AS is_public, reason, upload_time, original_name, report_name, error, client_time, analysis_json";
        const log = await dbAsync.get(
            `SELECT ${metaOnly ? metaColumns : `${metaColumns}, content`}
             FROM logs WHERE id = $1`,
            [id]
        );
        if (!log) {
            return res.status(404).json({ success: false, error: "Log not found" });
        }

        const metadata = {
            id: log.id,
            shortId: formatLogId(log.id),
            projectId: log.plugin_id || null,
            isPublic: log.plugin_id ? Boolean(log.is_public) : true,
            uploadTime: log.upload_time ? new Date(log.upload_time).toISOString() : null,
            reason: log.reason || "MANUAL",
            originalName: log.original_name || null,
            reportName: log.report_name || null,
            error: log.error || null,
            clientTime: log.client_time || null
        };
        let analysis = log.analysis_json || null;
        if (!metaOnly && !analysis) {
            analysis = analyzeLogContent(log.content);
            if (analysis) {
                await dbAsync.run("UPDATE logs SET analysis_json = $1 WHERE id = $2", [analysis, id]);
            }
        }

        const maskedMetadata = maskMetadata(metadata);
        const maskedAnalysis = maskAnalysis(analysis);

        if (metaOnly) {
            return res.json({ success: true, metadata: maskedMetadata, analysis: maskedAnalysis });
        }

        res.json({ success: true, content: maskSensitiveText(log.content), metadata: maskedMetadata, analysis: maskedAnalysis });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

app.put('/logs/:id', async (req, res) => {
    try {
        const idParam = req.params.id;
        const resolved = await resolveLogId(idParam);
        if (resolved.error) {
            return res.status(resolved.error.status).json({ error: resolved.error.message });
        }
        const id = resolved.id;

        const access = await dbAsync.get(
            `SELECT logs.plugin_id, COALESCE(logs.is_public, FALSE) AS is_public, plugins.user_id
             FROM logs
             LEFT JOIN plugins ON logs.plugin_id = plugins.id
             WHERE logs.id = $1`,
            [id]
        );
        if (!access) {
            return res.status(404).json({ success: false, error: "Log not found" });
        }
        if (!access.plugin_id) {
            return res.status(403).json({ error: "RESTRICTED" });
        }
        const user = getUserFromToken(req);
        if (!user || user.id !== access.user_id) {
            return res.status(403).json({ error: "RESTRICTED" });
        }

        const updates = [];
        const values = [];
        let index = 1;

        if (req.body.reportName) {
            if (typeof req.body.reportName !== 'string') {
                return res.status(400).json({ error: "Invalid reportName" });
            }
            if (isTooLarge(req.body.reportName, MAX_REPORT_NAME_BYTES)) {
                return res.status(413).json({ error: "reportName too large" });
            }
            updates.push(`report_name = $${index++}`);
            values.push(req.body.reportName);
        }
        if (req.body.reason) {
            if (typeof req.body.reason !== 'string') {
                return res.status(400).json({ error: "Invalid reason" });
            }
            if (isTooLarge(req.body.reason, MAX_REASON_BYTES)) {
                return res.status(400).json({ error: "Invalid reason" });
            }
            updates.push(`reason = $${index++}`);
            values.push(String(req.body.reason).toUpperCase());
        }
        const nextIsPublic = req.body.isPublic ?? req.body.public ?? req.body.is_public;
        if (nextIsPublic !== undefined) {
            if (typeof nextIsPublic !== 'boolean') {
                return res.status(400).json({ error: "Invalid isPublic" });
            }
            updates.push(`is_public = $${index++}`);
            values.push(nextIsPublic);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: "No updates provided" });
        }

        values.push(id);
        const log = await dbAsync.get(
            `UPDATE logs SET ${updates.join(', ')} WHERE id = $${index}
             RETURNING id, plugin_id, COALESCE(is_public, FALSE) AS is_public, reason, upload_time, original_name, report_name, error, client_time`,
            values
        );

        if (!log) {
            return res.status(404).json({ success: false, error: "Log not found" });
        }

        const metadata = {
            id: log.id,
            shortId: formatLogId(log.id),
            projectId: log.plugin_id || null,
            isPublic: log.plugin_id ? Boolean(log.is_public) : true,
            uploadTime: log.upload_time ? new Date(log.upload_time).toISOString() : null,
            reason: log.reason || "MANUAL",
            originalName: log.original_name || null,
            reportName: log.report_name || null,
            error: log.error || null,
            clientTime: log.client_time || null
        };

        res.json({ success: true, metadata });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: "Failed to update log" });
    }
});

const sendRawLog = async (req, res) => {
    try {
        const idParam = req.params.id;
        const resolved = await resolveLogId(idParam);
        if (resolved.error) {
            return res.status(resolved.error.status).send(resolved.error.message);
        }
        const id = resolved.id;

        const access = await getLogAccess(id);
        if (!access) {
            return res.status(404).send("Log not found");
        }
        if (access.plugin_id) {
            const isPublic = Boolean(access.is_public);
            if (!isPublic) {
                const user = getUserFromToken(req);
                if (!user || user.id !== access.user_id) {
                    return res.status(403).send("RESTRICTED");
                }
            }
        }

        const log = await dbAsync.get("SELECT content FROM logs WHERE id = $1", [id]);
        if (!log) return res.status(404).send("Log not found");

        res.header('Content-Type', 'text/plain; charset=utf-8');
        res.send(maskSensitiveText(log.content));
    } catch (e) {
        console.error(e);
        res.status(500).send("Internal Server Error");
    }
};

app.get('/logs/:id/raw', sendRawLog);


const RETENTION_DAYS = 90;
const CLEANUP_INTERVAL = 60 * 60 * 1000;

async function cleanupExpiredLogs() {
    try {
        const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;
        const cutoff = new Date(Date.now() - retentionMs);
        const result = await dbAsync.run(
            "DELETE FROM logs WHERE plugin_id IS NULL AND upload_time < $1",
            [cutoff]
        );
        if (result.rowCount > 0) {
            console.log(`[Cleanup] Deleted ${result.rowCount} expired anonymous logs.`);
        }
    } catch (error) {
        console.error("[Cleanup] Error during cleanup task:", error);
    }
}

setInterval(cleanupExpiredLogs, CLEANUP_INTERVAL);
cleanupExpiredLogs();

app.listen(CONFIG.PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${CONFIG.PORT}`);
});
