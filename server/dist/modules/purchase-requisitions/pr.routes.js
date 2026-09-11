"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const response_1 = require("../../shared/response");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const audit_1 = require("../../middleware/audit");
const pr_service_1 = require("./pr.service");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/', (0, rbac_1.requirePermission)('inventory', 'read'), async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const { status, itemId } = req.query;
        const result = await pr_service_1.prService.list(page, limit, status, itemId);
        (0, response_1.sendPaginated)(res, result.data, result.total, page, limit);
    }
    catch (err) {
        next(err);
    }
});
router.post('/', (0, rbac_1.requirePermission)('inventory', 'create'), async (req, res, next) => {
    try {
        const pr = await pr_service_1.prService.create(req.body);
        await (0, audit_1.logAudit)(req.user?.id, 'CREATE', 'PURCHASE_REQUISITION', pr.id, null, pr, req);
        (0, response_1.sendSuccess)(res, pr, 201);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id', (0, rbac_1.requirePermission)('inventory', 'read'), async (req, res, next) => {
    try {
        const pr = await pr_service_1.prService.getById(req.params.id);
        (0, response_1.sendSuccess)(res, pr);
    }
    catch (err) {
        next(err);
    }
});
router.put('/:id', (0, rbac_1.requirePermission)('inventory', 'update'), async (req, res, next) => {
    try {
        const oldPr = await pr_service_1.prService.getById(req.params.id);
        const pr = await pr_service_1.prService.update(req.params.id, req.body);
        await (0, audit_1.logAudit)(req.user?.id, 'UPDATE', 'PURCHASE_REQUISITION', req.params.id, oldPr, pr, req);
        (0, response_1.sendSuccess)(res, pr);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/sync-zahir', (0, rbac_1.requirePermission)('inventory', 'update'), async (req, res, next) => {
    try {
        const job = await pr_service_1.prService.syncToZahir(req.params.id);
        await (0, audit_1.logAudit)(req.user?.id, 'SYNC', 'PURCHASE_REQUISITION', req.params.id, null, job, req);
        (0, response_1.sendSuccess)(res, job, 201);
    }
    catch (err) {
        next(err);
    }
});
router.delete('/:id', (0, rbac_1.requirePermission)('inventory', 'delete'), async (req, res, next) => {
    try {
        const oldPr = await pr_service_1.prService.getById(req.params.id);
        await pr_service_1.prService.remove(req.params.id);
        await (0, audit_1.logAudit)(req.user?.id, 'DELETE', 'PURCHASE_REQUISITION', req.params.id, oldPr, null, req);
        (0, response_1.sendSuccess)(res, { message: 'Purchase Requisition deleted' });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
