const express = require('express');
const logController = require('../controllers/logController.ts');

const createLogRoutes = ({ uploadLimiter, upload }) => {
    const router = express.Router();

    router.post('/', uploadLimiter, upload.single('file'), logController.uploadLog);
    router.get('/:id', logController.getLogDetail);
    router.put('/:id', logController.updateLogDetail);
    router.get('/:id/raw', logController.getRawLogContent);

    return router;
};

module.exports = createLogRoutes;
