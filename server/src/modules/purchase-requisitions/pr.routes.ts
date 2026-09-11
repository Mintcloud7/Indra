import { Router } from 'express';
import { AuthRequest } from '../../shared/types';
import { sendSuccess, sendPaginated } from '../../shared/response';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { logAudit } from '../../middleware/audit';
import { prService } from './pr.service';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('inventory', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const { status, itemId } = req.query;
      const result = await prService.list(page, limit, status as string | undefined, itemId as string | undefined);
      sendPaginated(res, result.data, result.total, page, limit);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/',
  requirePermission('inventory', 'create'),
  async (req: AuthRequest, res, next) => {
    try {
      const pr = await prService.create(req.body);
      await logAudit(req.user?.id, 'CREATE', 'PURCHASE_REQUISITION', pr.id, null, pr, req);
      sendSuccess(res, pr, 201);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id',
  requirePermission('inventory', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const pr = await prService.getById(req.params.id);
      sendSuccess(res, pr);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:id',
  requirePermission('inventory', 'update'),
  async (req: AuthRequest, res, next) => {
    try {
      const oldPr = await prService.getById(req.params.id);
      const pr = await prService.update(req.params.id, req.body);
      await logAudit(req.user?.id, 'UPDATE', 'PURCHASE_REQUISITION', req.params.id, oldPr, pr, req);
      sendSuccess(res, pr);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/sync-zahir',
  requirePermission('inventory', 'update'),
  async (req: AuthRequest, res, next) => {
    try {
      const job = await prService.syncToZahir(req.params.id);
      await logAudit(req.user?.id, 'SYNC', 'PURCHASE_REQUISITION', req.params.id, null, job, req);
      sendSuccess(res, job, 201);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:id',
  requirePermission('inventory', 'delete'),
  async (req: AuthRequest, res, next) => {
    try {
      const oldPr = await prService.getById(req.params.id);
      await prService.remove(req.params.id);
      await logAudit(req.user?.id, 'DELETE', 'PURCHASE_REQUISITION', req.params.id, oldPr, null, req);
      sendSuccess(res, { message: 'Purchase Requisition deleted' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
