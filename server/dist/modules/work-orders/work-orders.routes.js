"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const response_1 = require("../../shared/response");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const audit_1 = require("../../middleware/audit");
const work_orders_service_1 = require("./work-orders.service");
const router = (0, express_1.Router)();
const storage = multer_1.default.diskStorage({
    destination: path_1.default.resolve(__dirname, '../../../uploads'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|csv/;
        const extname = allowed.test(path_1.default.extname(file.originalname).toLowerCase());
        const mimetype = allowed.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        }
        else {
            cb(new Error('Only images, documents, and spreadsheets are allowed'));
        }
    }
});
router.use(auth_1.authenticate);
router.get('/', (0, rbac_1.requirePermission)('work_orders', 'read'), async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const { status, priority, assignedToId, assetId, search } = req.query;
        const result = await work_orders_service_1.workOrderService.list(page, limit, {
            status: status,
            priority: priority,
            assignedToId: assignedToId,
            assetId: assetId,
            search: search
        });
        (0, response_1.sendPaginated)(res, result.data, result.total, page, limit);
    }
    catch (err) {
        next(err);
    }
});
router.post('/', (0, rbac_1.requirePermission)('work_orders', 'create'), async (req, res, next) => {
    try {
        const wo = await work_orders_service_1.workOrderService.create(req.body, req.user.id);
        await (0, audit_1.logAudit)(req.user?.id, 'CREATE', 'WORK_ORDER', wo.id, null, wo, req);
        (0, response_1.sendSuccess)(res, wo, 201);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id', (0, rbac_1.requirePermission)('work_orders', 'read'), async (req, res, next) => {
    try {
        const wo = await work_orders_service_1.workOrderService.getById(req.params.id);
        (0, response_1.sendSuccess)(res, wo);
    }
    catch (err) {
        next(err);
    }
});
router.put('/:id', (0, rbac_1.requirePermission)('work_orders', 'update'), async (req, res, next) => {
    try {
        const oldWo = await work_orders_service_1.workOrderService.getById(req.params.id);
        const wo = await work_orders_service_1.workOrderService.update(req.params.id, req.body);
        await (0, audit_1.logAudit)(req.user?.id, 'UPDATE', 'WORK_ORDER', req.params.id, oldWo, wo, req);
        (0, response_1.sendSuccess)(res, wo);
    }
    catch (err) {
        next(err);
    }
});
router.delete('/:id', (0, rbac_1.requirePermission)('work_orders', 'delete'), async (req, res, next) => {
    try {
        const wo = await work_orders_service_1.workOrderService.getById(req.params.id);
        await work_orders_service_1.workOrderService.remove(req.params.id);
        await (0, audit_1.logAudit)(req.user?.id, 'DELETE', 'WORK_ORDER', req.params.id, wo, null, req);
        (0, response_1.sendSuccess)(res, { message: 'Work Order deleted' });
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/assign', (0, rbac_1.requirePermission)('work_orders', 'assign'), async (req, res, next) => {
    try {
        const wo = await work_orders_service_1.workOrderService.assign(req.params.id, req.body, req.user.id);
        await (0, audit_1.logAudit)(req.user?.id, 'ASSIGN', 'WORK_ORDER', req.params.id, null, wo, req);
        (0, response_1.sendSuccess)(res, wo);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/start', (0, rbac_1.requirePermission)('work_orders', 'update'), async (req, res, next) => {
    try {
        const wo = await work_orders_service_1.workOrderService.start(req.params.id, req.user.id);
        await (0, audit_1.logAudit)(req.user?.id, 'UPDATE_STATUS', 'WORK_ORDER', req.params.id, null, { status: 'IN_PROGRESS' }, req);
        (0, response_1.sendSuccess)(res, wo);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/hold', (0, rbac_1.requirePermission)('work_orders', 'update'), async (req, res, next) => {
    try {
        const wo = await work_orders_service_1.workOrderService.hold(req.params.id, req.user.id, req.body.notes);
        await (0, audit_1.logAudit)(req.user?.id, 'UPDATE_STATUS', 'WORK_ORDER', req.params.id, null, { status: 'ON_HOLD' }, req);
        (0, response_1.sendSuccess)(res, wo);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/resume', (0, rbac_1.requirePermission)('work_orders', 'update'), async (req, res, next) => {
    try {
        const wo = await work_orders_service_1.workOrderService.resume(req.params.id, req.user.id);
        await (0, audit_1.logAudit)(req.user?.id, 'UPDATE_STATUS', 'WORK_ORDER', req.params.id, null, { status: 'IN_PROGRESS' }, req);
        (0, response_1.sendSuccess)(res, wo);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/close', (0, rbac_1.requirePermission)('work_orders', 'close'), async (req, res, next) => {
    try {
        const wo = await work_orders_service_1.workOrderService.close(req.params.id, req.user.id, req.body);
        await (0, audit_1.logAudit)(req.user?.id, 'CLOSE', 'WORK_ORDER', req.params.id, null, wo, req);
        (0, response_1.sendSuccess)(res, wo);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/checklist', (0, rbac_1.requirePermission)('work_orders', 'update'), async (req, res, next) => {
    try {
        const checklist = await work_orders_service_1.workOrderService.addChecklist(req.params.id, req.body);
        await (0, audit_1.logAudit)(req.user?.id, 'CREATE', 'WORK_ORDER_CHECKLIST', checklist.id, null, checklist, req);
        (0, response_1.sendSuccess)(res, checklist, 201);
    }
    catch (err) {
        next(err);
    }
});
router.put('/:id/checklist/:checklistId', (0, rbac_1.requirePermission)('work_orders', 'update'), async (req, res, next) => {
    try {
        const checklist = await work_orders_service_1.workOrderService.updateChecklist(req.params.id, req.params.checklistId, req.body, req.user.id);
        await (0, audit_1.logAudit)(req.user?.id, 'UPDATE', 'WORK_ORDER_CHECKLIST', req.params.checklistId, null, checklist, req);
        (0, response_1.sendSuccess)(res, checklist);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/attachments', (0, rbac_1.requirePermission)('work_orders', 'update'), upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            (0, response_1.sendSuccess)(res, { message: 'No file uploaded' }, 400);
            return;
        }
        const attachment = await work_orders_service_1.workOrderService.addAttachment(req.params.id, req.file, req.user.id);
        await (0, audit_1.logAudit)(req.user?.id, 'CREATE', 'WORK_ORDER_ATTACHMENT', attachment.id, null, attachment, req);
        (0, response_1.sendSuccess)(res, attachment, 201);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/spare-parts', (0, rbac_1.requirePermission)('work_orders', 'update'), async (req, res, next) => {
    try {
        const sparePart = await work_orders_service_1.workOrderService.addSparePart(req.params.id, req.body);
        await (0, audit_1.logAudit)(req.user?.id, 'CREATE', 'WORK_ORDER_SPARE_PART', sparePart.id, null, sparePart, req);
        (0, response_1.sendSuccess)(res, sparePart, 201);
    }
    catch (err) {
        next(err);
    }
});
router.put('/:id/spare-parts/:sparePartId', (0, rbac_1.requirePermission)('work_orders', 'update'), async (req, res, next) => {
    try {
        const sparePart = await work_orders_service_1.workOrderService.updateSparePart(req.params.id, req.params.sparePartId, req.body);
        await (0, audit_1.logAudit)(req.user?.id, 'UPDATE', 'WORK_ORDER_SPARE_PART', req.params.sparePartId, null, sparePart, req);
        (0, response_1.sendSuccess)(res, sparePart);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
