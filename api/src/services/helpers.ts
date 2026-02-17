const {
    MAX_PASSWORD_LENGTH,
    MAX_REASON_BYTES,
    MAX_USERNAME_LENGTH,
    SHORT_ID_LENGTH
} = require('../config/env.ts');

const isValidLogId = (id) => /^[a-zA-Z0-9_-]{1,64}$/.test(id);
const isTooLarge = (value, maxBytes) => Buffer.byteLength(value, 'utf8') > maxBytes;

const isWeakPassword = (password) => {
    if (typeof password !== 'string') return true;
    if (password.length < 8) return true;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return !hasLetter || !hasNumber;
};

const formatLogId = (value) => {
    if (!value) return null;
    return value.length > SHORT_ID_LENGTH ? value.slice(0, SHORT_ID_LENGTH) : value;
};

const validateAuthFieldLengths = ({ username, password }) => {
    if (username.length > MAX_USERNAME_LENGTH) return { ok: false, error: 'Username too long' };
    if (password.length > MAX_PASSWORD_LENGTH) return { ok: false, error: 'Password too long' };
    return { ok: true };
};

const normalizeReason = (reason) => {
    const normalized = String(reason || 'MANUAL').toUpperCase();
    if (isTooLarge(normalized, MAX_REASON_BYTES)) return null;
    return normalized;
};

module.exports = {
    formatLogId,
    isTooLarge,
    isValidLogId,
    isWeakPassword,
    normalizeReason,
    validateAuthFieldLengths
};
