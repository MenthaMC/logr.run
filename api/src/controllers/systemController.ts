const { CORS_ORIGINS } = require('../config/env.ts');

const health = (req, res) => {
    res.json({
        ok: true,
        time: new Date().toISOString()
    });
};

const debugCors = (req, res) => {
    res.json({
        origin: req.headers.origin || null,
        allowed: CORS_ORIGINS
    });
};

module.exports = {
    debugCors,
    health
};
