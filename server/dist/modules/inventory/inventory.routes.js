"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const response_1 = require("../../shared/response");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const audit_1 = require("../../middleware/audit");
const pr_service_1 = require("../purchase-requisitions/pr.service");
const inventory_service_1 = require("./inventory.service");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// ─── Low Stock ───────────────────────────────────────────────────────────────
router.get('/spare-parts/low-stock', (0, rbac_1.requirePermission)('inventory', 'read'), async (req, res, next) => {
    try {
        const items = await (0, inventory_service_1.getLowStockItems)();
        (0, response_1.sendSuccess)(res, items);
    }
    catch (err) {
        next(err);
    }
});
// ─── Spare Parts ─────────────────────────────────────────────────────────────
router.get('/spare-parts', (0, rbac_1.requirePermission)('inventory', 'read'), async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search, category, warehouseId } = req.query;
        const result = await (0, inventory_service_1.listSpareParts)(Number(page), Number(limit), search, category, warehouseId);
        (0, response_1.sendPaginated)(res, result.data, result.total, Number(page), Number(limit));
    }
    catch (err) {
        next(err);
    }
});
router.post('/spare-parts', (0, rbac_1.requirePermission)('inventory', 'create'), async (req, res, next) => {
    try {
        const sparePart = await (0, inventory_service_1.createSparePart)(req.body);
        await (0, audit_1.logAudit)(req.user?.id, 'CREATE', 'spare_part', sparePart.id, null, sparePart, req);
        (0, response_1.sendSuccess)(res, sparePart, 201);
    }
    catch (err) {
        next(err);
    }
});
router.get('/spare-parts/:id', (0, rbac_1.requirePermission)('inventory', 'read'), async (req, res, next) => {
    try {
        const sparePart = await (0, inventory_service_1.getSparePartById)(req.params.id);
        (0, response_1.sendSuccess)(res, sparePart);
    }
    catch (err) {
        next(err);
    }
});
router.put('/spare-parts/:id', (0, rbac_1.requirePermission)('inventory', 'update'), async (req, res, next) => {
    try {
        const sparePart = await (0, inventory_service_1.updateSparePart)(req.params.id, req.body);
        await (0, audit_1.logAudit)(req.user?.id, 'UPDATE', 'spare_part', req.params.id, null, sparePart, req);
        (0, response_1.sendSuccess)(res, sparePart);
    }
    catch (err) {
        next(err);
    }
});
// ─── Generate Purchase Requisition from Low Stock ────────────────────────────
router.post('/spare-parts/:id/generate-pr', (0, rbac_1.requirePermission)('inventory', 'create'), async (req, res, next) => {
    try {
        const item = await (0, inventory_service_1.getSparePartById)(req.params.id);
        const quantity = (item.maximumStock || item.minimumStock * 2) - item.currentStock;
        if (quantity <= 0) {
            (0, response_1.sendSuccess)(res, { message: 'Stock is sufficient' });
            return;
        }
        const pr = await pr_service_1.prService.create({
            itemId: item.id,
            quantity,
            reason: `Auto-generated: ${item.itemName} stock below minimum (${item.currentStock}/${item.minimumStock})`,
        });
        await (0, audit_1.logAudit)(req.user?.id, 'CREATE', 'PURCHASE_REQUISITION', pr.id, null, pr, req);
        (0, response_1.sendSuccess)(res, pr, 201);
    }
    catch (err) {
        next(err);
    }
});
// ─── Warehouses ──────────────────────────────────────────────────────────────
router.get('/warehouses', (0, rbac_1.requirePermission)('inventory', 'read'), async (req, res, next) => {
    try {
        const warehouses = await (0, inventory_service_1.listWarehouses)();
        (0, response_1.sendSuccess)(res, warehouses);
    }
    catch (err) {
        next(err);
    }
});
router.post('/warehouses', (0, rbac_1.requirePermission)('inventory', 'create'), async (req, res, next) => {
    try {
        const warehouse = await (0, inventory_service_1.createWarehouse)(req.body);
        await (0, audit_1.logAudit)(req.user?.id, 'CREATE', 'warehouse', warehouse.id, null, warehouse, req);
        (0, response_1.sendSuccess)(res, warehouse, 201);
    }
    catch (err) {
        next(err);
    }
});
router.put('/warehouses/:id', (0, rbac_1.requirePermission)('inventory', 'update'), async (req, res, next) => {
    try {
        const warehouse = await (0, inventory_service_1.updateWarehouse)(req.params.id, req.body);
        await (0, audit_1.logAudit)(req.user?.id, 'UPDATE', 'warehouse', warehouse.id, null, warehouse, req);
        (0, response_1.sendSuccess)(res, warehouse);
    }
    catch (err) {
        next(err);
    }
});
router.delete('/warehouses/:id', (0, rbac_1.requirePermission)('inventory', 'delete'), async (req, res, next) => {
    try {
        await (0, inventory_service_1.deleteWarehouse)(req.params.id);
        await (0, audit_1.logAudit)(req.user?.id, 'DELETE', 'warehouse', req.params.id, null, null, req);
        (0, response_1.sendSuccess)(res, { message: 'Warehouse deleted' });
    }
    catch (err) {
        next(err);
    }
});
// ─── Transactions ────────────────────────────────────────────────────────────
router.get('/transactions', (0, rbac_1.requirePermission)('inventory', 'read'), async (req, res, next) => {
    try {
        const { page = 1, limit = 20, itemId, warehouseId, transactionType, startDate, endDate } = req.query;
        const result = await (0, inventory_service_1.listTransactions)(Number(page), Number(limit), itemId, warehouseId, transactionType, startDate, endDate);
        (0, response_1.sendPaginated)(res, result.data, result.total, Number(page), Number(limit));
    }
    catch (err) {
        next(err);
    }
});
router.post('/stock-in', (0, rbac_1.requirePermission)('inventory', 'update'), async (req, res, next) => {
    try {
        const { itemId, warehouseId, quantity, unitCost, notes } = req.body;
        const transaction = await (0, inventory_service_1.stockIn)(itemId, warehouseId, quantity, unitCost, notes, req.user.id);
        await (0, audit_1.logAudit)(req.user?.id, 'STOCK_IN', 'inventory_transaction', transaction.id, null, transaction, req);
        (0, response_1.sendSuccess)(res, transaction, 201);
    }
    catch (err) {
        next(err);
    }
});
router.post('/stock-out', (0, rbac_1.requirePermission)('inventory', 'update'), async (req, res, next) => {
    try {
        const { itemId, warehouseId, quantity, unitCost, referenceType, referenceId, notes } = req.body;
        const transaction = await (0, inventory_service_1.stockOut)(itemId, warehouseId, quantity, unitCost, referenceType, referenceId, notes, req.user.id);
        await (0, audit_1.logAudit)(req.user?.id, 'STOCK_OUT', 'inventory_transaction', transaction.id, null, transaction, req);
        (0, response_1.sendSuccess)(res, transaction, 201);
    }
    catch (err) {
        next(err);
    }
});
router.post('/adjustment', (0, rbac_1.requirePermission)('inventory', 'update'), async (req, res, next) => {
    try {
        const { itemId, warehouseId, quantity, unitCost, notes } = req.body;
        const transaction = await (0, inventory_service_1.adjustment)(itemId, warehouseId, quantity, unitCost, notes, req.user.id);
        await (0, audit_1.logAudit)(req.user?.id, 'ADJUSTMENT', 'inventory_transaction', transaction.id, null, transaction, req);
        (0, response_1.sendSuccess)(res, transaction, 201);
    }
    catch (err) {
        next(err);
    }
});
router.post('/return', (0, rbac_1.requirePermission)('inventory', 'update'), async (req, res, next) => {
    try {
        const { itemId, warehouseId, quantity, unitCost, notes } = req.body;
        const transaction = await (0, inventory_service_1.returnStock)(itemId, warehouseId, quantity, unitCost, notes, req.user.id);
        await (0, audit_1.logAudit)(req.user?.id, 'RETURN', 'inventory_transaction', transaction.id, null, transaction, req);
        (0, response_1.sendSuccess)(res, transaction, 201);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
