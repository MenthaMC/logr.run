const { Pool } = require('pg');
const {
    LOGS_DATABASE_URL,
    PG_SSL,
    PG_SSL_REJECT_UNAUTHORIZED,
    USERS_DATABASE_URL
} = require('../config/env.ts');

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

const logsDb = {
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

const initDb = async () => {
    await usersDb.run(`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    )`);

    await logsDb.run(`CREATE TABLE IF NOT EXISTS plugins (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name TEXT,
        token TEXT UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    await logsDb.run(`CREATE TABLE IF NOT EXISTS logs (
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

    await logsDb.run('ALTER TABLE logs ADD COLUMN IF NOT EXISTS analysis_json JSONB');
    await logsDb.run('ALTER TABLE logs ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE');
    await logsDb.run('CREATE INDEX IF NOT EXISTS idx_logs_plugin_time ON logs (plugin_id, upload_time DESC)');

    await logsDb.run(`CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        reset_at TIMESTAMPTZ NOT NULL
    )`);
};

module.exports = {
    initDb,
    logsDb,
    logsPool,
    usersDb,
    usersPool
};
