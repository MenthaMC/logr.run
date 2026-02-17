const path = require('path');

const NODE_ENV = process.env.NODE_ENV || 'development';
const CONFIG = {
    PORT: parseInt(process.env.PORT, 10) || 4000,
    FRONTEND_BASE_URL: process.env.FRONTEND_BASE_URL || 'http://localhost:5173'
};

const SECRET_KEY = process.env.SECRET_KEY || 'DEV_SECRET_KEY_123';
const USERS_DATABASE_URL = process.env.USERS_DATABASE_URL || process.env.DATABASE_URL;
const LOGS_DATABASE_URL = process.env.LOGS_DATABASE_URL || process.env.DATABASE_URL;
const TOKEN_TTL = process.env.TOKEN_TTL || '7d';
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
const CORS_ORIGINS = (process.env.CORS_ORIGINS || CONFIG.FRONTEND_BASE_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || '';
const TURNSTILE_BYPASS = process.env.TURNSTILE_BYPASS === 'true';
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const RATE_LIMIT_BACKEND = (process.env.RATE_LIMIT_BACKEND || (NODE_ENV === 'production' ? 'db' : 'memory')).toLowerCase();
const RATE_LIMIT_MEMORY_CLEANUP_INTERVAL = 10 * 60 * 1000;

const RETENTION_DAYS = 90;
const CLEANUP_INTERVAL = 60 * 60 * 1000;

const PG_SSL = process.env.PG_SSL === 'true';
const PG_SSL_REJECT_UNAUTHORIZED = process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false';

const TRUST_PROXY = process.env.TRUST_PROXY;
const TMP_DIR = path.resolve(__dirname, '..', '..', 'tmp');

if (NODE_ENV === 'production') {
    if (!process.env.SECRET_KEY) throw new Error('SECRET_KEY is required');
    if (!process.env.USERS_DATABASE_URL && !process.env.DATABASE_URL) throw new Error('USERS_DATABASE_URL is required');
    if (!process.env.LOGS_DATABASE_URL && !process.env.DATABASE_URL) throw new Error('LOGS_DATABASE_URL is required');
    if (!process.env.FRONTEND_BASE_URL) throw new Error('FRONTEND_BASE_URL is required');
    if (!process.env.TURNSTILE_SECRET_KEY) throw new Error('TURNSTILE_SECRET_KEY is required');
}

module.exports = {
    ANALYSIS_MAX_LINES,
    ANALYSIS_MAX_SIGNALS,
    CLEANUP_INTERVAL,
    CONFIG,
    CORS_ORIGINS,
    LOG_ID_BYTES,
    LOGS_DATABASE_URL,
    MAX_CLIENT_TIME_BYTES,
    MAX_ERROR_BYTES,
    MAX_FORM_FIELD_BYTES,
    MAX_LOG_BYTES,
    MAX_ORIGINAL_NAME_BYTES,
    MAX_PASSWORD_LENGTH,
    MAX_REASON_BYTES,
    MAX_REPORT_NAME_BYTES,
    MAX_UPLOAD_BYTES,
    MAX_USERNAME_LENGTH,
    NODE_ENV,
    PG_SSL,
    PG_SSL_REJECT_UNAUTHORIZED,
    RATE_LIMIT_BACKEND,
    RATE_LIMIT_MEMORY_CLEANUP_INTERVAL,
    RETENTION_DAYS,
    SECRET_KEY,
    SHORT_ID_LENGTH,
    TOKEN_TTL,
    TMP_DIR,
    TRUST_PROXY,
    TURNSTILE_BYPASS,
    TURNSTILE_SECRET_KEY,
    TURNSTILE_VERIFY_URL,
    USERS_DATABASE_URL
};
