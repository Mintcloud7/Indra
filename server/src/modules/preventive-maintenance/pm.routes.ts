import { Router } from 'express';
import { AuthRequest } from '../../shared/types';
import { sendSuccess, sendPaginated } from '../../shared/response';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { logAudit } from '../../middleware/audit';
import { pmService } from './pm.service';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('preventive_maintenance', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const { status, frequency, assetId, assignedToId, search } = req.query;
      const result = await pmService.list(page, limit, {
        status: status as string | undefined,
        frequency: frequency as string | undefined,
        assetId: assetId as string | undefined,
        assignedToId: assignedToId as string | undefined,
        search: search as string | undefined
      });
      sendPaginated(res, result.data, result.total, page, limit);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/checklist-stats',
  requirePermission('preventive_maintenance', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const stats = await pmService.getChecklistStats();
      sendSuccess(res, stats);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/',
  requirePermission('preventive_maintenance', 'create'),
  async (req: AuthRequest, res, next) => {
    try {
      const pm = await pmService.create(req.body);
      await logAudit(req.user?.id, 'CREATE', 'PREVENTIVE_MAINTENANCE', pm.id, null, pm, req);
      sendSuccess(res, pm, 201);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id',
  requirePermission('preventive_maintenance', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const pm = await pmService.getById(req.params.id);
      sendSuccess(res, pm);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id/work-orders',
  requirePermission('preventive_maintenance', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const workOrders = await pmService.getWorkOrders(req.params.id);
      sendSuccess(res, workOrders);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:id',
  requirePermission('preventive_maintenance', 'update'),
  async (req: AuthRequest, res, next) => {
    try {
      const oldPm = await pmService.getById(req.params.id);
      const pm = await pmService.update(req.params.id, req.body);
      await logAudit(req.user?.id, 'UPDATE', 'PREVENTIVE_MAINTENANCE', req.params.id, oldPm, pm, req);
      sendSuccess(res, pm);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:id',
  requirePermission('preventive_maintenance', 'delete'),
  async (req: AuthRequest, res, next) => {
    try {
      const pm = await pmService.getById(req.params.id);
      await pmService.delete(req.params.id);
      await logAudit(req.user?.id, 'DELETE', 'PREVENTIVE_MAINTENANCE', req.params.id, pm, null, req);
      sendSuccess(res, { message: 'Preventive Maintenance deleted' });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/generate-wo',
  requirePermission('preventive_maintenance', 'update'),
  async (req: AuthRequest, res, next) => {
    try {
      const wo = await pmService.generateWorkOrder(req.params.id);
      await logAudit(req.user?.id, 'GENERATE_WO', 'PREVENTIVE_MAINTENANCE', req.params.id, null, wo, req);
      sendSuccess(res, wo, 201);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/check-due',
  requirePermission('preventive_maintenance', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const generated = await pmService.checkDuePMs();
      sendSuccess(res, { generatedCount: generated.length, workOrders: generated });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/checklists/:checklistId/toggle',
  requirePermission('preventive_maintenance', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const updated = await pmService.toggleChecklist(req.params.checklistId, req.user!.id);
      sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/submit-to-logbook',
  requirePermission('preventive_maintenance', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const log = await pmService.submitToLogbook(req.user!.id, req.body.workDate);
      sendSuccess(res, log, 201);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
