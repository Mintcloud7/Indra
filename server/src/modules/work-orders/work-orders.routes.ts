import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { AuthRequest } from '../../shared/types';
import { sendSuccess, sendPaginated } from '../../shared/response';
import { authenticate } from '../../middleware/auth';
import { requirePermission, requireRole } from '../../middleware/rbac';
import { logAudit } from '../../middleware/audit';
import { workOrderService } from './work-orders.service';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|csv/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowed.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only images, documents, and spreadsheets are allowed'));
    }
  }
});

router.use(authenticate);

router.get(
  '/',
  requirePermission('work_orders', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const { status, priority, assignedToId, assetId, search } = req.query;
      const result = await workOrderService.list(page, limit, {
        status: status as string | undefined,
        priority: priority as string | undefined,
        assignedToId: assignedToId as string | undefined,
        assetId: assetId as string | undefined,
        search: search as string | undefined
      });
      sendPaginated(res, result.data, result.total, page, limit);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/',
  requirePermission('work_orders', 'create'),
  async (req: AuthRequest, res, next) => {
    try {
      const wo = await workOrderService.create(req.body, req.user!.id);
      await logAudit(req.user?.id, 'CREATE', 'WORK_ORDER', wo.id, null, wo, req);
      sendSuccess(res, wo, 201);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id',
  requirePermission('work_orders', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const wo = await workOrderService.getById(req.params.id);
      sendSuccess(res, wo);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:id',
  requirePermission('work_orders', 'update'),
  async (req: AuthRequest, res, next) => {
    try {
      const oldWo = await workOrderService.getById(req.params.id);
      const wo = await workOrderService.update(req.params.id, req.body);
      await logAudit(req.user?.id, 'UPDATE', 'WORK_ORDER', req.params.id, oldWo, wo, req);
      sendSuccess(res, wo);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:id',
  requirePermission('work_orders', 'delete'),
  async (req: AuthRequest, res, next) => {
    try {
      const wo = await workOrderService.getById(req.params.id);
      await workOrderService.remove(req.params.id);
      await logAudit(req.user?.id, 'DELETE', 'WORK_ORDER', req.params.id, wo, null, req);
      sendSuccess(res, { message: 'Work Order deleted' });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/assign',
  requirePermission('work_orders', 'assign'),
  async (req: AuthRequest, res, next) => {
    try {
      const wo = await workOrderService.assign(req.params.id, req.body, req.user!.id);
      await logAudit(req.user?.id, 'ASSIGN', 'WORK_ORDER', req.params.id, null, wo, req);
      sendSuccess(res, wo);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/start',
  requirePermission('work_orders', 'update'),
  async (req: AuthRequest, res, next) => {
    try {
      const wo = await workOrderService.start(req.params.id, req.user!.id);
      await logAudit(req.user?.id, 'UPDATE_STATUS', 'WORK_ORDER', req.params.id, null, { status: 'IN_PROGRESS' }, req);
      sendSuccess(res, wo);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/hold',
  requirePermission('work_orders', 'update'),
  async (req: AuthRequest, res, next) => {
    try {
      const wo = await workOrderService.hold(req.params.id, req.user!.id, req.body.notes);
      await logAudit(req.user?.id, 'UPDATE_STATUS', 'WORK_ORDER', req.params.id, null, { status: 'ON_HOLD' }, req);
      sendSuccess(res, wo);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/resume',
  requirePermission('work_orders', 'update'),
  async (req: AuthRequest, res, next) => {
    try {
      const wo = await workOrderService.resume(req.params.id, req.user!.id);
      await logAudit(req.user?.id, 'UPDATE_STATUS', 'WORK_ORDER', req.params.id, null, { status: 'IN_PROGRESS' }, req);
      sendSuccess(res, wo);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/close',
  requirePermission('work_orders', 'close'),
  async (req: AuthRequest, res, next) => {
    try {
      const wo = await workOrderService.close(req.params.id, req.user!.id, req.body);
      await logAudit(req.user?.id, 'CLOSE', 'WORK_ORDER', req.params.id, null, wo, req);
      sendSuccess(res, wo);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id/checklist',
  requirePermission('work_orders', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const checklist = await workOrderService.getChecklist(req.params.id);
      sendSuccess(res, checklist);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/checklist',
  requirePermission('work_orders', 'update'),
  requireRole('ADMIN', 'SUPERVISOR', 'MANAGER'),
  async (req: AuthRequest, res, next) => {
    try {
      const checklist = await workOrderService.addChecklist(req.params.id, req.body);
      await logAudit(req.user?.id, 'CREATE', 'WORK_ORDER_CHECKLIST', checklist.id, null, checklist, req);
      sendSuccess(res, checklist, 201);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:id/checklist/:checklistId',
  requirePermission('work_orders', 'update'),
  async (req: AuthRequest, res, next) => {
    try {
      const checklist = await workOrderService.updateChecklist(req.params.id, req.params.checklistId, req.body, req.user!.id);
      await logAudit(req.user?.id, 'UPDATE', 'WORK_ORDER_CHECKLIST', req.params.checklistId, null, checklist, req);
      sendSuccess(res, checklist);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:id/checklist/:checklistId',
  requirePermission('work_orders', 'delete'),
  requireRole('ADMIN'),
  async (req: AuthRequest, res, next) => {
    try {
      await workOrderService.deleteChecklist(req.params.id, req.params.checklistId);
      await logAudit(req.user?.id, 'DELETE', 'WORK_ORDER_CHECKLIST', req.params.checklistId, null, null, req);
      sendSuccess(res, { message: 'Checklist item deleted' });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id/attachments',
  requirePermission('work_orders', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const attachments = await workOrderService.getAttachments(req.params.id);
      sendSuccess(res, attachments);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/attachments',
  requirePermission('work_orders', 'update'),
  upload.single('file'),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.file) {
        sendSuccess(res, { message: 'No file uploaded' }, 400);
        return;
      }
      const attachment = await workOrderService.addAttachment(req.params.id, req.file, req.user!.id);
      await logAudit(req.user?.id, 'CREATE', 'WORK_ORDER_ATTACHMENT', attachment.id, null, attachment, req);
      sendSuccess(res, attachment, 201);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:id/attachments/:attachmentId',
  requirePermission('work_orders', 'delete'),
  requireRole('ADMIN'),
  async (req: AuthRequest, res, next) => {
    try {
      await workOrderService.deleteAttachment(req.params.id, req.params.attachmentId);
      await logAudit(req.user?.id, 'DELETE', 'WORK_ORDER_ATTACHMENT', req.params.attachmentId, null, null, req);
      sendSuccess(res, { message: 'Attachment deleted' });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/spare-parts',
  requirePermission('work_orders', 'update'),
  async (req: AuthRequest, res, next) => {
    try {
      const sparePart = await workOrderService.addSparePart(req.params.id, req.body);
      await logAudit(req.user?.id, 'CREATE', 'WORK_ORDER_SPARE_PART', sparePart.id, null, sparePart, req);
      sendSuccess(res, sparePart, 201);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:id/spare-parts/:sparePartId',
  requirePermission('work_orders', 'update'),
  async (req: AuthRequest, res, next) => {
    try {
      const sparePart = await workOrderService.updateSparePart(req.params.id, req.params.sparePartId, req.body);
      await logAudit(req.user?.id, 'UPDATE', 'WORK_ORDER_SPARE_PART', req.params.sparePartId, null, sparePart, req);
      sendSuccess(res, sparePart);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
