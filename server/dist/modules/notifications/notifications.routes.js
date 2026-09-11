"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const response_1 = require("../../shared/response");
const auth_1 = require("../../middleware/auth");
const notifications_service_1 = require("./notifications.service");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/', async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const unreadOnly = req.query.unreadOnly === 'true';
        const result = await notifications_service_1.notificationService.list(req.user.id, page, limit, unreadOnly);
        (0, response_1.sendPaginated)(res, result.data, result.total, page, limit);
    }
    catch (err) {
        next(err);
    }
});
router.get('/unread-count', async (req, res, next) => {
    try {
        const count = await notifications_service_1.notificationService.getUnreadCount(req.user.id);
        (0, response_1.sendSuccess)(res, { count });
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id', async (req, res, next) => {
    try {
        const notification = await notifications_service_1.notificationService.getById(req.params.id);
        (0, response_1.sendSuccess)(res, notification);
    }
    catch (err) {
        next(err);
    }
});
router.put('/:id/read', async (req, res, next) => {
    try {
        const notification = await notifications_service_1.notificationService.markAsRead(req.params.id, req.user.id);
        (0, response_1.sendSuccess)(res, notification);
    }
    catch (err) {
        next(err);
    }
});
router.put('/read-all', async (req, res, next) => {
    try {
        await notifications_service_1.notificationService.markAllAsRead(req.user.id);
        (0, response_1.sendSuccess)(res, { message: 'All notifications marked as read' });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
