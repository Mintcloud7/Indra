"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const response_1 = require("../../shared/response");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const audit_1 = require("../../middleware/audit");
const pm_service_1 = require("./pm.service");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/', (0, rbac_1.requirePermission)('preventive_maintenance', 'read'), async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const { status, frequency, assetId, assignedToId, search } = req.query;
        const result = await pm_service_1.pmService.list(page, limit, {
            status: status,
            frequency: frequency,
            assetId: assetId,
            assignedToId: assignedToId,
            search: search
        });
        (0, response_1.sendPaginated)(res, result.data, result.total, page, limit);
    }
    catch (err) {
        next(err);
    }
});
router.get('/checklist-stats', (0, rbac_1.requirePermission)('preventive_maintenance', 'read'), async (req, res, next) => {
    try {
        const stats = await pm_service_1.pmService.getChecklistStats();
        (0, response_1.sendSuccess)(res, stats);
    }
    catch (err) {
        next(err);
    }
});
router.post('/', (0, rbac_1.requirePermission)('preventive_maintenance', 'create'), async (req, res, next) => {
    try {
        const pm = await pm_service_1.pmService.create(req.body);
        await (0, audit_1.logAudit)(req.user?.id, 'CREATE', 'PREVENTIVE_MAINTENANCE', pm.id, null, pm, req);
        (0, response_1.sendSuccess)(res, pm, 201);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id', (0, rbac_1.requirePermission)('preventive_maintenance', 'read'), async (req, res, next) => {
    try {
        const pm = await pm_service_1.pmService.getById(req.params.id);
        (0, response_1.sendSuccess)(res, pm);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/work-orders', (0, rbac_1.requirePermission)('preventive_maintenance', 'read'), async (req, res, next) => {
    try {
        const workOrders = await pm_service_1.pmService.getWorkOrders(req.params.id);
        (0, response_1.sendSuccess)(res, workOrders);
    }
    catch (err) {
        next(err);
    }
});
router.put('/:id', (0, rbac_1.requirePermission)('preventive_maintenance', 'update'), async (req, res, next) => {
    try {
        const oldPm = await pm_service_1.pmService.getById(req.params.id);
        const pm = await pm_service_1.pmService.update(req.params.id, req.body);
        await (0, audit_1.logAudit)(req.user?.id, 'UPDATE', 'PREVENTIVE_MAINTENANCE', req.params.id, oldPm, pm, req);
        (0, response_1.sendSuccess)(res, pm);
    }
    catch (err) {
        next(err);
    }
});
router.delete('/:id', (0, rbac_1.requirePermission)('preventive_maintenance', 'delete'), async (req, res, next) => {
    try {
        const pm = await pm_service_1.pmService.getById(req.params.id);
        await pm_service_1.pmService.delete(req.params.id);
        await (0, audit_1.logAudit)(req.user?.id, 'DELETE', 'PREVENTIVE_MAINTENANCE', req.params.id, pm, null, req);
        (0, response_1.sendSuccess)(res, { message: 'Preventive Maintenance deleted' });
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/generate-wo', (0, rbac_1.requirePermission)('preventive_maintenance', 'update'), async (req, res, next) => {
    try {
        const wo = await pm_service_1.pmService.generateWorkOrder(req.params.id);
        await (0, audit_1.logAudit)(req.user?.id, 'GENERATE_WO', 'PREVENTIVE_MAINTENANCE', req.params.id, null, wo, req);
        (0, response_1.sendSuccess)(res, wo, 201);
    }
    catch (err) {
        next(err);
    }
});
router.post('/check-due', (0, rbac_1.requirePermission)('preventive_maintenance', 'read'), async (req, res, next) => {
    try {
        const generated = await pm_service_1.pmService.checkDuePMs();
        (0, response_1.sendSuccess)(res, { generatedCount: generated.length, workOrders: generated });
    }
    catch (err) {
        next(err);
    }
});
router.put('/checklists/:checklistId/toggle', (0, rbac_1.requirePermission)('preventive_maintenance', 'read'), async (req, res, next) => {
    try {
        const updated = await pm_service_1.pmService.toggleChecklist(req.params.checklistId, req.user.id);
        (0, response_1.sendSuccess)(res, updated);
    }
    catch (err) {
        next(err);
    }
});
router.post('/submit-to-logbook', (0, rbac_1.requirePermission)('preventive_maintenance', 'read'), async (req, res, next) => {
    try {
        const log = await pm_service_1.pmService.submitToLogbook(req.user.id, req.body.workDate);
        (0, response_1.sendSuccess)(res, log, 201);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
