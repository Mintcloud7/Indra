import { Router } from 'express';
import { AuthRequest } from '../../shared/types';
import { sendSuccess, sendPaginated } from '../../shared/response';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { logAudit } from '../../middleware/audit';
import { prService } from '../purchase-requisitions/pr.service';
import {
  listSpareParts, getSparePartById, createSparePart, updateSparePart,
  listWarehouses, createWarehouse, updateWarehouse, deleteWarehouse,
  listTransactions, stockIn, stockOut, adjustment, returnStock,
  getLowStockItems
} from './inventory.service';

const router = Router();

router.use(authenticate);

// ─── Low Stock ───────────────────────────────────────────────────────────────

router.get(
  '/spare-parts/low-stock',
  requirePermission('inventory', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const items = await getLowStockItems();
      sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  }
);

// ─── Spare Parts ─────────────────────────────────────────────────────────────

router.get(
  '/spare-parts',
  requirePermission('inventory', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const { page = 1, limit = 20, search, category, warehouseId } = req.query;
      const result = await listSpareParts(
        Number(page),
        Number(limit),
        search as string | undefined,
        category as string | undefined,
        warehouseId as string | undefined
      );
      sendPaginated(res, result.data, result.total, Number(page), Number(limit));
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/spare-parts',
  requirePermission('inventory', 'create'),
  async (req: AuthRequest, res, next) => {
    try {
      const sparePart = await createSparePart(req.body);
      await logAudit(req.user?.id, 'CREATE', 'spare_part', sparePart.id, null, sparePart, req);
      sendSuccess(res, sparePart, 201);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/spare-parts/:id',
  requirePermission('inventory', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const sparePart = await getSparePartById(req.params.id);
      sendSuccess(res, sparePart);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/spare-parts/:id',
  requirePermission('inventory', 'update'),
  async (req: AuthRequest, res, next) => {
    try {
      const sparePart = await updateSparePart(req.params.id, req.body);
      await logAudit(req.user?.id, 'UPDATE', 'spare_part', req.params.id, null, sparePart, req);
      sendSuccess(res, sparePart);
    } catch (err) {
      next(err);
    }
  }
);

// ─── Generate Purchase Requisition from Low Stock ────────────────────────────

router.post(
  '/spare-parts/:id/generate-pr',
  requirePermission('inventory', 'create'),
  async (req: AuthRequest, res, next) => {
    try {
      const item = await getSparePartById(req.params.id);
      const quantity = (item.maximumStock || item.minimumStock * 2) - item.currentStock;
      if (quantity <= 0) {
        sendSuccess(res, { message: 'Stock is sufficient' });
        return;
      }
      const pr = await prService.create({
        itemId: item.id,
        quantity,
        reason: `Auto-generated: ${item.itemName} stock below minimum (${item.currentStock}/${item.minimumStock})`,
      });
      await logAudit(req.user?.id, 'CREATE', 'PURCHASE_REQUISITION', pr.id, null, pr, req);
      sendSuccess(res, pr, 201);
    } catch (err) {
      next(err);
    }
  }
);

// ─── Warehouses ──────────────────────────────────────────────────────────────

router.get(
  '/warehouses',
  requirePermission('inventory', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const warehouses = await listWarehouses();
      sendSuccess(res, warehouses);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/warehouses',
  requirePermission('inventory', 'create'),
  async (req: AuthRequest, res, next) => {
    try {
      const warehouse = await createWarehouse(req.body);
      await logAudit(req.user?.id, 'CREATE', 'warehouse', warehouse.id, null, warehouse, req);
      sendSuccess(res, warehouse, 201);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/warehouses/:id',
  requirePermission('inventory', 'update'),
  async (req: AuthRequest, res, next) => {
    try {
      const warehouse = await updateWarehouse(req.params.id, req.body);
      await logAudit(req.user?.id, 'UPDATE', 'warehouse', warehouse.id, null, warehouse, req);
      sendSuccess(res, warehouse);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/warehouses/:id',
  requirePermission('inventory', 'delete'),
  async (req: AuthRequest, res, next) => {
    try {
      await deleteWarehouse(req.params.id);
      await logAudit(req.user?.id, 'DELETE', 'warehouse', req.params.id, null, null, req);
      sendSuccess(res, { message: 'Warehouse deleted' });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Transactions ────────────────────────────────────────────────────────────

router.get(
  '/transactions',
  requirePermission('inventory', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const { page = 1, limit = 20, itemId, warehouseId, transactionType, startDate, endDate } = req.query;
      const result = await listTransactions(
        Number(page),
        Number(limit),
        itemId as string | undefined,
        warehouseId as string | undefined,
        transactionType as string | undefined,
        startDate as string | undefined,
        endDate as string | undefined
      );
      sendPaginated(res, result.data, result.total, Number(page), Number(limit));
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/stock-in',
  requirePermission('inventory', 'update'),
  async (req: AuthRequest, res, next) => {
    try {
      const { itemId, warehouseId, quantity, unitCost, notes } = req.body;
      const transaction = await stockIn(itemId, warehouseId, quantity, unitCost, notes, req.user!.id);
      await logAudit(req.user?.id, 'STOCK_IN', 'inventory_transaction', transaction.id, null, transaction, req);
      sendSuccess(res, transaction, 201);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/stock-out',
  requirePermission('inventory', 'update'),
  async (req: AuthRequest, res, next) => {
    try {
      const { itemId, warehouseId, quantity, unitCost, referenceType, referenceId, notes } = req.body;
      const transaction = await stockOut(itemId, warehouseId, quantity, unitCost, referenceType, referenceId, notes, req.user!.id);
      await logAudit(req.user?.id, 'STOCK_OUT', 'inventory_transaction', transaction.id, null, transaction, req);
      sendSuccess(res, transaction, 201);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/adjustment',
  requirePermission('inventory', 'update'),
  async (req: AuthRequest, res, next) => {
    try {
      const { itemId, warehouseId, quantity, unitCost, notes } = req.body;
      const transaction = await adjustment(itemId, warehouseId, quantity, unitCost, notes, req.user!.id);
      await logAudit(req.user?.id, 'ADJUSTMENT', 'inventory_transaction', transaction.id, null, transaction, req);
      sendSuccess(res, transaction, 201);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/return',
  requirePermission('inventory', 'update'),
  async (req: AuthRequest, res, next) => {
    try {
      const { itemId, warehouseId, quantity, unitCost, notes } = req.body;
      const transaction = await returnStock(itemId, warehouseId, quantity, unitCost, notes, req.user!.id);
      await logAudit(req.user?.id, 'RETURN', 'inventory_transaction', transaction.id, null, transaction, req);
      sendSuccess(res, transaction, 201);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
