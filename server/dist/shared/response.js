"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuccess = sendSuccess;
exports.sendError = sendError;
exports.sendPaginated = sendPaginated;
function sendSuccess(res, data, statusCode = 200) {
    res.status(statusCode).json({ success: true, data });
}
function sendError(res, message, statusCode = 500, errorCode, errors) {
    res.status(statusCode).json({
        success: false,
        message,
        error_code: errorCode || 'ERROR',
        ...(errors && { errors })
    });
}
function sendPaginated(res, data, total, page, limit) {
    res.status(200).json({
        success: true,
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
    });
}
