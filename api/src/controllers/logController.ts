const {
    CONFIG,
    createLogEntry,
    formatLogId,
    getLog,
    getRawLog,
    removeTempFile,
    updateLog
} = require('../services/logService.ts');
const { isHttpError } = require('../utils/httpError.ts');

const uploadLog = async (req, res) => {
    const tempPath = req.file ? req.file.path : null;
    try {
        const { id } = await createLogEntry(req);
        const viewUrl = `${CONFIG.FRONTEND_BASE_URL}/view/${id}`;
        res.header('Location', viewUrl);
        return res.json({ success: true, id, shortId: formatLogId(id), url: viewUrl });
    } catch (error) {
        if (error && error.code === 'LIMIT_EXCEEDED') {
            return res.status(413).json({ success: false, error: 'Log too large' });
        }
        if (isHttpError(error)) {
            return res.status(error.status).json({ error: error.message });
        }
        console.error(error);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    } finally {
        await removeTempFile(tempPath);
    }
};

const getLogDetail = async (req, res) => {
    try {
        const payload = await getLog(req);
        return res.json(payload);
    } catch (error) {
        if (isHttpError(error)) {
            if (error.status === 404 && error.message === 'Log not found') {
                return res.status(404).json({ success: false, error: error.message });
            }
            return res.status(error.status).json({ error: error.message });
        }
        console.error(error);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

const updateLogDetail = async (req, res) => {
    try {
        const payload = await updateLog(req);
        return res.json(payload);
    } catch (error) {
        if (isHttpError(error)) {
            if (error.status === 404 && error.message === 'Log not found') {
                return res.status(404).json({ success: false, error: error.message });
            }
            return res.status(error.status).json({ error: error.message });
        }
        console.error(error);
        return res.status(500).json({ success: false, error: 'Failed to update log' });
    }
};

const getRawLogContent = async (req, res) => {
    try {
        const content = await getRawLog(req);
        res.header('Content-Type', 'text/plain; charset=utf-8');
        return res.send(content);
    } catch (error) {
        if (isHttpError(error)) {
            return res.status(error.status).send(error.message);
        }
        console.error(error);
        return res.status(500).send('Internal Server Error');
    }
};

module.exports = {
    getLogDetail,
    getRawLogContent,
    updateLogDetail,
    uploadLog
};
