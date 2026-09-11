"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const response_1 = require("../../shared/response");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const audit_1 = require("../../middleware/audit");
const log_books_service_1 = require("./log-books.service");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/', (0, rbac_1.requirePermission)('log_books', 'read'), async (req, res, next) => {
    try {
        const { page = 1, limit = 20, userId, startDate, endDate, search } = req.query;
        const result = await (0, log_books_service_1.listLogBooks)(Number(page), Number(limit), userId, startDate, endDate, search);
        (0, response_1.sendPaginated)(res, result.data, result.total, result.page, result.limit);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id', (0, rbac_1.requirePermission)('log_books', 'read'), async (req, res, next) => {
    try {
        const log = await (0, log_books_service_1.getLogBookById)(req.params.id);
        (0, response_1.sendSuccess)(res, log);
    }
    catch (err) {
        next(err);
    }
});
router.post('/', (0, rbac_1.requirePermission)('log_books', 'create'), async (req, res, next) => {
    try {
        const log = await (0, log_books_service_1.createLogBook)({ ...req.body, userId: req.user.id });
        await (0, audit_1.logAudit)(req.user?.id, 'CREATE', 'log_book', log.id, null, log, req);
        (0, response_1.sendSuccess)(res, log, 201);
    }
    catch (err) {
        next(err);
    }
});
router.put('/:id', (0, rbac_1.requirePermission)('log_books', 'update'), async (req, res, next) => {
    try {
        const log = await (0, log_books_service_1.updateLogBook)(req.params.id, req.body);
        await (0, audit_1.logAudit)(req.user?.id, 'UPDATE', 'log_book', log.id, null, log, req);
        (0, response_1.sendSuccess)(res, log);
    }
    catch (err) {
        next(err);
    }
});
router.delete('/:id', (0, rbac_1.requirePermission)('log_books', 'delete'), async (req, res, next) => {
    try {
        await (0, log_books_service_1.deleteLogBook)(req.params.id);
        await (0, audit_1.logAudit)(req.user?.id, 'DELETE', 'log_book', req.params.id, null, null, req);
        (0, response_1.sendSuccess)(res, { message: 'Log book deleted' });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
