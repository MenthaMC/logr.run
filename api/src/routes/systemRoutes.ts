const express = require('express');
const systemController = require('../controllers/systemController.ts');

const createSystemRoutes = () => {
    const router = express.Router();

    router.get('/health', systemController.health);
    router.get('/debug/cors', systemController.debugCors);

    return router;
};

module.exports = createSystemRoutes;
