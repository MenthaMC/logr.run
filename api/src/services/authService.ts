const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {
    MAX_PASSWORD_LENGTH,
    MAX_USERNAME_LENGTH,
    SECRET_KEY,
    TOKEN_TTL
} = require('../config/env.ts');
const { usersDb } = require('./db.ts');
const { isWeakPassword } = require('./helpers.ts');
const { verifyTurnstile } = require('./captchaService.ts');
const { createHttpError } = require('../utils/httpError.ts');

const parseTurnstileToken = (body = {}) => {
    return body.turnstileToken || body.captchaToken || body['cf-turnstile-response'];
};

const getUserFromToken = (req) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return null;
    try {
        return jwt.verify(token, SECRET_KEY);
    } catch {
        return null;
    }
};

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        return next();
    });
};

const registerUser = async ({ username, password, confirmPassword, turnstileToken, ip }) => {
    const captchaCheck = await verifyTurnstile(turnstileToken, ip);
    if (!captchaCheck.ok) throw createHttpError(400, captchaCheck.error);

    if (!username || !password) throw createHttpError(400, 'Missing fields');
    if (typeof username !== 'string' || typeof password !== 'string') throw createHttpError(400, 'Invalid fields');
    if (confirmPassword !== undefined && typeof confirmPassword !== 'string') throw createHttpError(400, 'Invalid fields');
    if (confirmPassword !== undefined && password !== confirmPassword) throw createHttpError(400, 'Password mismatch');
    if (username.length > MAX_USERNAME_LENGTH) throw createHttpError(400, 'Username too long');
    if (password.length > MAX_PASSWORD_LENGTH) throw createHttpError(400, 'Password too long');
    if (isWeakPassword(password)) throw createHttpError(400, 'Weak password');

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await usersDb.run('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashedPassword]);
        return { success: true };
    } catch {
        throw createHttpError(400, 'Username already exists or error');
    }
};

const loginUser = async ({ username, password, turnstileToken, ip }) => {
    const captchaCheck = await verifyTurnstile(turnstileToken, ip);
    if (!captchaCheck.ok) throw createHttpError(400, captchaCheck.error);

    if (typeof username !== 'string' || typeof password !== 'string') throw createHttpError(400, 'Invalid fields');
    if (username.length > MAX_USERNAME_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
        throw createHttpError(400, 'Invalid credentials');
    }

    try {
        const user = await usersDb.get('SELECT * FROM users WHERE username = $1', [username]);
        if (!user) throw createHttpError(400, 'User not found');
        const passwordMatches = await bcrypt.compare(password, user.password);
        if (!passwordMatches) throw createHttpError(400, 'Invalid credentials');
        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: TOKEN_TTL });
        return { success: true, token, username: user.username };
    } catch (error) {
        if (error && typeof error.status === 'number') throw error;
        throw createHttpError(500, 'Internal error');
    }
};

module.exports = {
    authenticateToken,
    getUserFromToken,
    loginUser,
    parseTurnstileToken,
    registerUser
};
