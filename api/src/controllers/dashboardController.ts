const {
    createUserProject,
    deleteLogsBatch,
    deleteSingleLog,
    deleteUserProject,
    getProjectIssueDetail,
    getProjectIssues,
    getProjectLogs,
    listUserProjects,
    parseProjectName,
    renameUserProject,
    updateLogsBatchVisibility
} = require('../services/projectService.ts');
const { isHttpError } = require('../utils/httpError.ts');

const sendError = (res, error) => {
    if (isHttpError(error)) {
        return res.status(error.status).json({ error: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
};

const listProjects = (withPluginAlias = false) => async (req, res) => {
    try {
        const rows = await listUserProjects(req.user.id);
        if (withPluginAlias) {
            return res.json({ success: true, plugins: rows, projects: rows });
        }
        return res.json({ success: true, projects: rows });
    } catch (error) {
        return sendError(res, error);
    }
};

const createProject = (withPluginAlias = false) => async (req, res) => {
    const name = parseProjectName(req.body.name);
    if (!name) return res.status(400).json({ error: 'Name required' });
    try {
        const project = await createUserProject(req.user.id, name);
        if (withPluginAlias) {
            return res.json({ success: true, plugin: project, project });
        }
        return res.json({ success: true, project });
    } catch (error) {
        if (isHttpError(error) && error.status === 409) {
            return res.status(409).json({ error: error.message });
        }
        console.error(error);
        return res.status(500).json({ success: false });
    }
};

const renameProject = async (req, res) => {
    const name = parseProjectName(req.body.name);
    if (!name) return res.status(400).json({ error: 'Name required' });
    try {
        await renameUserProject(req.user.id, req.params.id, name);
        return res.json({ success: true });
    } catch (error) {
        return sendError(res, error);
    }
};

const deleteProject = async (req, res) => {
    try {
        await deleteUserProject(req.user.id, req.params.id);
        return res.json({ success: true });
    } catch (error) {
        if (isHttpError(error)) {
            return res.status(error.status).json({ error: error.message });
        }
        console.error(error);
        return res.status(500).json({ success: false });
    }
};

const getLogsByProject = async (req, res) => {
    try {
        const logs = await getProjectLogs(req.user.id, req.params.projectId);
        return res.json({ success: true, logs });
    } catch (error) {
        if (isHttpError(error) && error.status === 403) {
            return res.status(403).send();
        }
        return sendError(res, error);
    }
};

const getIssuesByProject = async (req, res) => {
    try {
        const issues = await getProjectIssues(req.user.id, req.params.projectId, {
            range: req.query.range,
            sort: req.query.sort,
            limit: req.query.limit
        });
        return res.json({ success: true, issues });
    } catch (error) {
        return sendError(res, error);
    }
};

const getIssueDetail = async (req, res) => {
    try {
        const payload = await getProjectIssueDetail(
            req.user.id,
            req.params.projectId,
            req.params.signature,
            { range: req.query.range }
        );
        return res.json({ success: true, ...payload });
    } catch (error) {
        return sendError(res, error);
    }
};

const batchDeleteLogs = async (req, res) => {
    try {
        const count = await deleteLogsBatch(req.user.id, req.body.ids);
        return res.json({ success: true, count });
    } catch (error) {
        return sendError(res, error);
    }
};

const batchUpdateVisibility = async (req, res) => {
    try {
        const count = await updateLogsBatchVisibility(req.user.id, req.body.ids, req.body.isPublic);
        return res.json({ success: true, count });
    } catch (error) {
        return sendError(res, error);
    }
};

const deleteLog = async (req, res) => {
    try {
        await deleteSingleLog(req.user.id, req.params.id);
        return res.json({ success: true });
    } catch (error) {
        return sendError(res, error);
    }
};

module.exports = {
    batchDeleteLogs,
    batchUpdateVisibility,
    createProject,
    deleteLog,
    deleteProject,
    getIssueDetail,
    getIssuesByProject,
    getLogsByProject,
    listProjects,
    renameProject
};
