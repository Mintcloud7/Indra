"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const response_1 = require("../../shared/response");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const reports_service_1 = require("./reports.service");
const wo_export_service_1 = require("./wo-export.service");
const errors_1 = require("../../shared/errors");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/work-orders/export-docx', (0, rbac_1.requirePermission)('reports', 'read'), async (req, res, next) => {
    try {
        const { startDate, endDate, status, priority, assignedToId, assetId } = req.query;
        const buffer = await wo_export_service_1.woExportService.generateWorkOrderReportDocx({
            startDate: startDate,
            endDate: endDate,
            status: status,
            priority: priority,
            assignedToId: assignedToId,
            assetId: assetId,
        });
        const now = new Date();
        const filename = `Laporan_Work_Order_${now.toISOString().split('T')[0]}.docx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    }
    catch (err) {
        next(err);
    }
});
router.get('/work-orders/:id/export-docx', (0, rbac_1.requirePermission)('reports', 'read'), async (req, res, next) => {
    try {
        const buffer = await wo_export_service_1.woExportService.generateSingleWorkOrderDocx(req.params.id);
        const woNumber = req.params.id.slice(0, 8);
        const filename = `Work_Order_${woNumber}.docx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    }
    catch (err) {
        next(err);
    }
});
router.get('/work-orders', (0, rbac_1.requirePermission)('reports', 'read'), async (req, res, next) => {
    try {
        const { startDate, endDate, status, priority, assignedToId, assetId } = req.query;
        const report = await reports_service_1.reportsService.workOrderReport({
            startDate: startDate,
            endDate: endDate,
            status: status,
            priority: priority,
            assignedToId: assignedToId,
            assetId: assetId
        });
        (0, response_1.sendSuccess)(res, report);
    }
    catch (err) {
        next(err);
    }
});
router.get('/maintenance-cost', (0, rbac_1.requirePermission)('reports', 'read'), async (req, res, next) => {
    try {
        const { startDate, endDate, assetId } = req.query;
        const report = await reports_service_1.reportsService.maintenanceCostReport({
            startDate: startDate,
            endDate: endDate,
            assetId: assetId
        });
        (0, response_1.sendSuccess)(res, report);
    }
    catch (err) {
        next(err);
    }
});
router.get('/spare-part-usage', (0, rbac_1.requirePermission)('reports', 'read'), async (req, res, next) => {
    try {
        const { startDate, endDate, itemId, assetId } = req.query;
        const report = await reports_service_1.reportsService.sparePartUsageReport({
            startDate: startDate,
            endDate: endDate,
            itemId: itemId,
            assetId: assetId
        });
        (0, response_1.sendSuccess)(res, report);
    }
    catch (err) {
        next(err);
    }
});
router.get('/mttr', (0, rbac_1.requirePermission)('reports', 'read'), async (req, res, next) => {
    try {
        const { startDate, endDate, assetId } = req.query;
        const report = await reports_service_1.reportsService.mttr({
            startDate: startDate,
            endDate: endDate,
            assetId: assetId
        });
        (0, response_1.sendSuccess)(res, report);
    }
    catch (err) {
        next(err);
    }
});
router.get('/mtbf', (0, rbac_1.requirePermission)('reports', 'read'), async (req, res, next) => {
    try {
        const { startDate, endDate, assetId } = req.query;
        const report = await reports_service_1.reportsService.mtbf({
            startDate: startDate,
            endDate: endDate,
            assetId: assetId
        });
        (0, response_1.sendSuccess)(res, report);
    }
    catch (err) {
        next(err);
    }
});
router.get('/asset-history/:assetId', (0, rbac_1.requirePermission)('reports', 'read'), async (req, res, next) => {
    try {
        const history = await reports_service_1.reportsService.assetHistory(req.params.assetId);
        if (!history) {
            throw new errors_1.NotFoundError('Asset not found');
        }
        (0, response_1.sendSuccess)(res, history);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
