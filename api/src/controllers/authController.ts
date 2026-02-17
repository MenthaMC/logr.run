const {
    loginUser,
    parseTurnstileToken,
    registerUser
} = require('../services/authService.ts');
const { isHttpError } = require('../utils/httpError.ts');

const register = async (req, res) => {
    try {
        await registerUser({
            username: req.body.username,
            password: req.body.password,
            confirmPassword: req.body.confirmPassword,
            turnstileToken: parseTurnstileToken(req.body),
            ip: req.ip
        });
        return res.json({ success: true });
    } catch (error) {
        if (isHttpError(error)) {
            return res.status(error.status).json({ error: error.message });
        }
        console.error(error);
        return res.status(500).json({ error: 'Internal error' });
    }
};

const login = async (req, res) => {
    try {
        const result = await loginUser({
            username: req.body.username,
            password: req.body.password,
            turnstileToken: parseTurnstileToken(req.body),
            ip: req.ip
        });
        return res.json(result);
    } catch (error) {
        if (isHttpError(error)) {
            return res.status(error.status).json({ error: error.message });
        }
        console.error(error);
        return res.status(500).json({ error: 'Internal error' });
    }
};

module.exports = {
    login,
    register
};
