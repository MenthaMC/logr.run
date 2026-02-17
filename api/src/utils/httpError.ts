class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
    }
}

const createHttpError = (status, message) => new HttpError(status, message);

const isHttpError = (error) => error instanceof HttpError || (error && typeof error.status === 'number');

module.exports = {
    HttpError,
    createHttpError,
    isHttpError
};
