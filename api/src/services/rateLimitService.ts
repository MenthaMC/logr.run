const {
    RATE_LIMIT_BACKEND,
    RATE_LIMIT_MEMORY_CLEANUP_INTERVAL
} = require('../config/env.ts');
const { logsDb } = require('./db.ts');

const inMemoryRateLimits = new Map();

const createRateLimiter = ({ windowMs, max, keyPrefix }) => {
    return async (req, res, next) => {
        const ip = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
        const key = `${keyPrefix}:${ip}`;
        const now = Date.now();

        if (RATE_LIMIT_BACKEND === 'db') {
            try {
                const resetAt = new Date(now + windowMs);
                const row = await logsDb.get(
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
                    return res.status(429).json({ error: 'Too many requests' });
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
            return res.status(429).json({ error: 'Too many requests' });
        }

        return next();
    };
};

const startRateLimitCleanup = () => {
    if (RATE_LIMIT_BACKEND !== 'db') {
        setInterval(() => {
            const now = Date.now();
            for (const [key, entry] of inMemoryRateLimits.entries()) {
                if (entry.resetAt <= now) inMemoryRateLimits.delete(key);
            }
        }, RATE_LIMIT_MEMORY_CLEANUP_INTERVAL);
        return;
    }

    setInterval(async () => {
        try {
            await logsDb.run('DELETE FROM rate_limits WHERE reset_at <= NOW()');
        } catch (err) {
            console.error('[RateLimit] Cleanup failed:', err);
        }
    }, RATE_LIMIT_MEMORY_CLEANUP_INTERVAL);
};

module.exports = {
    createRateLimiter,
    startRateLimitCleanup
};
