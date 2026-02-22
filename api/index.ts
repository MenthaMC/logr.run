const cors = require('cors');
const express = require('express');
const {
    CONFIG,
    CORS_ORIGINS,
    MAX_LOG_BYTES,
    TRUST_PROXY
} = require('./src/config/env.ts');
const { authenticateToken } = require('./src/services/authService.ts');
const { initDb } = require('./src/services/db.ts');
const {
    createUploadMiddleware,
    ensureTmpDir,
    startCleanupTask
} = require('./src/services/logService.ts');
const {
    createRateLimiter,
    startRateLimitCleanup
} = require('./src/services/rateLimitService.ts');
const createAuthRoutes = require('./src/routes/authRoutes.ts');
const createDashboardRoutes = require('./src/routes/dashboardRoutes.ts');
const createLogRoutes = require('./src/routes/logRoutes.ts');
const createSystemRoutes = require('./src/routes/systemRoutes.ts');
const { loadRules } = require('./ruleEngine.js');

const app = express();

if (TRUST_PROXY) {
    app.set('trust proxy', TRUST_PROXY);
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

const authLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 10, keyPrefix: 'auth' });
const uploadLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20, keyPrefix: 'upload' });
const upload = createUploadMiddleware();

app.use(createSystemRoutes());
app.use('/auth', createAuthRoutes({ authLimiter }));
app.use('/dashboard', createDashboardRoutes({ authenticateToken }));
app.use('/logs', createLogRoutes({ uploadLimiter, upload }));

const startServer = async () => {
    try {
        await initDb();
        console.log('Database initialized');
    } catch (error) {
        console.error('Database init failed:', error);
    }

    try {
        await ensureTmpDir();
    } catch (error) {
        console.error('Failed to prepare tmp directory:', error);
    }

    try {
        const rules = loadRules();
        console.log(`[Rules] Loaded ${rules.length} rule(s).`);
    } catch (error) {
        console.error('[Rules] Failed to load rule files:', error);
    }

    startRateLimitCleanup();
    startCleanupTask();

    app.listen(CONFIG.PORT, '0.0.0.0', () => {
        console.log(`Server running on http://0.0.0.0:${CONFIG.PORT}`);
    });
};

startServer();

module.exports = app;
