const express = require('express');
const dashboardController = require('../controllers/dashboardController.ts');

const createDashboardRoutes = ({ authenticateToken }) => {
    const router = express.Router();

    router.get('/projects', authenticateToken, dashboardController.listProjects(false));
    router.post('/projects', authenticateToken, dashboardController.createProject(false));
    router.put('/projects/:id', authenticateToken, dashboardController.renameProject);
    router.delete('/projects/:id', authenticateToken, dashboardController.deleteProject);

    router.get('/plugins', authenticateToken, dashboardController.listProjects(true));
    router.post('/plugins', authenticateToken, dashboardController.createProject(true));
    router.put('/plugins/:id', authenticateToken, dashboardController.renameProject);
    router.delete('/plugins/:id', authenticateToken, dashboardController.deleteProject);

    router.get('/issues/:projectId', authenticateToken, dashboardController.getIssuesByProject);
    router.get('/issues/:projectId/:signature', authenticateToken, dashboardController.getIssueDetail);

    router.get('/logs/:projectId', authenticateToken, dashboardController.getLogsByProject);
    router.delete('/logs/batch', authenticateToken, dashboardController.batchDeleteLogs);
    router.put('/logs/batch/visibility', authenticateToken, dashboardController.batchUpdateVisibility);
    router.delete('/logs/:id', authenticateToken, dashboardController.deleteLog);

    return router;
};

module.exports = createDashboardRoutes;
