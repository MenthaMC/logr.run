const express = require('express');
const authController = require('../controllers/authController.ts');

const createAuthRoutes = ({ authLimiter }) => {
    const router = express.Router();

    router.post('/register', authLimiter, authController.register);
    router.post('/login', authLimiter, authController.login);

    return router;
};

module.exports = createAuthRoutes;
