"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const response_1 = require("../../shared/response");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const audit_1 = require("../../middleware/audit");
const assets_service_1 = require("./assets.service");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/', (0, rbac_1.requirePermission)('assets', 'read'), async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search, assetType, status } = req.query;
        const result = await (0, assets_service_1.list)(Number(page), Number(limit), search, assetType, status);
        (0, response_1.sendPaginated)(res, result.data, result.total, Number(page), Number(limit));
    }
    catch (err) {
        next(err);
    }
});
router.post('/', (0, rbac_1.requirePermission)('assets', 'create'), async (req, res, next) => {
    try {
        const asset = await (0, assets_service_1.create)(req.body);
        await (0, audit_1.logAudit)(req.user?.id, 'CREATE', 'asset', asset.id, null, asset, req);
        (0, response_1.sendSuccess)(res, asset, 201);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id', (0, rbac_1.requirePermission)('assets', 'read'), async (req, res, next) => {
    try {
        const asset = await (0, assets_service_1.getById)(req.params.id);
        (0, response_1.sendSuccess)(res, asset);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/work-orders', (0, rbac_1.requirePermission)('assets', 'read'), async (req, res, next) => {
    try {
        const workOrders = await (0, assets_service_1.getWorkOrders)(req.params.id);
        (0, response_1.sendSuccess)(res, { data: workOrders });
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/preventive-maintenance', (0, rbac_1.requirePermission)('assets', 'read'), async (req, res, next) => {
    try {
        const pm = await (0, assets_service_1.getPreventiveMaintenance)(req.params.id);
        (0, response_1.sendSuccess)(res, { data: pm });
    }
    catch (err) {
        next(err);
    }
});
router.put('/:id', (0, rbac_1.requirePermission)('assets', 'update'), async (req, res, next) => {
    try {
        const result = await (0, assets_service_1.update)(req.params.id, req.body);
        await (0, audit_1.logAudit)(req.user?.id, 'UPDATE', 'asset', req.params.id, result.oldValue, result.newValue, req);
        (0, response_1.sendSuccess)(res, result.asset);
    }
    catch (err) {
        next(err);
    }
});
router.delete('/:id', (0, rbac_1.requirePermission)('assets', 'delete'), async (req, res, next) => {
    try {
        const oldValue = await (0, assets_service_1.remove)(req.params.id);
        await (0, audit_1.logAudit)(req.user?.id, 'DELETE', 'asset', req.params.id, oldValue, null, req);
        (0, response_1.sendSuccess)(res, { message: 'Asset deleted' });
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/documents', (0, rbac_1.requirePermission)('assets', 'read'), async (req, res, next) => {
    try {
        const documents = await (0, assets_service_1.getDocuments)(req.params.id);
        (0, response_1.sendSuccess)(res, documents);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/documents', (0, rbac_1.requirePermission)('assets', 'create'), async (req, res, next) => {
    try {
        const document = await (0, assets_service_1.createDocument)(req.params.id, req.body, req.user.id);
        await (0, audit_1.logAudit)(req.user?.id, 'CREATE', 'asset_document', document.id, null, document, req);
        (0, response_1.sendSuccess)(res, document, 201);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/meters', (0, rbac_1.requirePermission)('assets', 'read'), async (req, res, next) => {
    try {
        const meters = await (0, assets_service_1.getMeters)(req.params.id);
        (0, response_1.sendSuccess)(res, meters);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/meters', (0, rbac_1.requirePermission)('assets', 'create'), async (req, res, next) => {
    try {
        const meter = await (0, assets_service_1.createMeter)(req.params.id, req.body);
        await (0, audit_1.logAudit)(req.user?.id, 'CREATE', 'asset_meter', meter.id, null, meter, req);
        (0, response_1.sendSuccess)(res, meter, 201);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/meters/:meterId/readings', (0, rbac_1.requirePermission)('assets', 'create'), async (req, res, next) => {
    try {
        const reading = await (0, assets_service_1.addMeterReading)(req.params.meterId, req.params.id, req.body.value, req.user.id);
        await (0, audit_1.logAudit)(req.user?.id, 'CREATE', 'meter_reading', reading.id, null, reading, req);
        (0, response_1.sendSuccess)(res, reading, 201);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/history', (0, rbac_1.requirePermission)('assets', 'read'), async (req, res, next) => {
    try {
        const history = await (0, assets_service_1.getHistory)(req.params.id);
        (0, response_1.sendSuccess)(res, history);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
