import { Router } from 'express';
import { AuthRequest } from '../../shared/types';
import { sendSuccess, sendPaginated } from '../../shared/response';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { logAudit } from '../../middleware/audit';
import {
  list, getById, create, update, remove,
  getDocuments, createDocument,
  getMeters, createMeter, addMeterReading,
  getHistory, getWorkOrders, getPreventiveMaintenance
} from './assets.service';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('assets', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const { page = 1, limit = 20, search, assetType, status } = req.query;
      const result = await list(
        Number(page),
        Number(limit),
        search as string | undefined,
        assetType as string | undefined,
        status as string | undefined
      );
      sendPaginated(res, result.data, result.total, Number(page), Number(limit));
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/',
  requirePermission('assets', 'create'),
  async (req: AuthRequest, res, next) => {
    try {
      const asset = await create(req.body);
      await logAudit(req.user?.id, 'CREATE', 'asset', asset.id, null, asset, req);
      sendSuccess(res, asset, 201);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id',
  requirePermission('assets', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const asset = await getById(req.params.id as string);
      sendSuccess(res, asset);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id/work-orders',
  requirePermission('assets', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const workOrders = await getWorkOrders(req.params.id as string);
      sendSuccess(res, { data: workOrders });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id/preventive-maintenance',
  requirePermission('assets', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const pm = await getPreventiveMaintenance(req.params.id as string);
      sendSuccess(res, { data: pm });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:id',
  requirePermission('assets', 'update'),
  async (req: AuthRequest, res, next) => {
    try {
      const result = await update(req.params.id as string, req.body);
      await logAudit(req.user?.id, 'UPDATE', 'asset', req.params.id as string, result.oldValue, result.newValue, req);
      sendSuccess(res, result.asset);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:id',
  requirePermission('assets', 'delete'),
  async (req: AuthRequest, res, next) => {
    try {
      const oldValue = await remove(req.params.id as string);
      await logAudit(req.user?.id, 'DELETE', 'asset', req.params.id as string, oldValue, null, req);
      sendSuccess(res, { message: 'Asset deleted' });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id/documents',
  requirePermission('assets', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const documents = await getDocuments(req.params.id as string);
      sendSuccess(res, documents);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/documents',
  requirePermission('assets', 'create'),
  async (req: AuthRequest, res, next) => {
    try {
      const document = await createDocument(req.params.id as string, req.body, req.user!.id);
      await logAudit(req.user?.id, 'CREATE', 'asset_document', document.id, null, document, req);
      sendSuccess(res, document, 201);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id/meters',
  requirePermission('assets', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const meters = await getMeters(req.params.id as string);
      sendSuccess(res, meters);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/meters',
  requirePermission('assets', 'create'),
  async (req: AuthRequest, res, next) => {
    try {
      const meter = await createMeter(req.params.id as string, req.body);
      await logAudit(req.user?.id, 'CREATE', 'asset_meter', meter.id, null, meter, req);
      sendSuccess(res, meter, 201);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/meters/:meterId/readings',
  requirePermission('assets', 'create'),
  async (req: AuthRequest, res, next) => {
    try {
      const reading = await addMeterReading(
        req.params.meterId as string,
        req.params.id as string,
        req.body.value,
        req.user!.id
      );
      await logAudit(req.user?.id, 'CREATE', 'meter_reading', reading.id, null, reading, req);
      sendSuccess(res, reading, 201);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id/history',
  requirePermission('assets', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const history = await getHistory(req.params.id as string);
      sendSuccess(res, history);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
