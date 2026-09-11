import { Router } from 'express';
import { AuthRequest } from '../../shared/types';
import { sendSuccess } from '../../shared/response';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { reportsService } from './reports.service';
import { woExportService } from './wo-export.service';
import { NotFoundError } from '../../shared/errors';

const router = Router();

router.use(authenticate);

router.get(
  '/work-orders/export-docx',
  requirePermission('reports', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const { startDate, endDate, status, priority, assignedToId, assetId } = req.query;
      const buffer = await woExportService.generateWorkOrderReportDocx({
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        status: status as string | undefined,
        priority: priority as string | undefined,
        assignedToId: assignedToId as string | undefined,
        assetId: assetId as string | undefined,
      });
      const now = new Date();
      const filename = `Laporan_Work_Order_${now.toISOString().split('T')[0]}.docx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/work-orders/:id/export-docx',
  requirePermission('reports', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const buffer = await woExportService.generateSingleWorkOrderDocx(req.params.id);
      const woNumber = req.params.id.slice(0, 8);
      const filename = `Work_Order_${woNumber}.docx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/work-orders',
  requirePermission('reports', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const { startDate, endDate, status, priority, assignedToId, assetId } = req.query;
      const report = await reportsService.workOrderReport({
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        status: status as string | undefined,
        priority: priority as string | undefined,
        assignedToId: assignedToId as string | undefined,
        assetId: assetId as string | undefined
      });
      sendSuccess(res, report);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/maintenance-cost',
  requirePermission('reports', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const { startDate, endDate, assetId } = req.query;
      const report = await reportsService.maintenanceCostReport({
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        assetId: assetId as string | undefined
      });
      sendSuccess(res, report);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/spare-part-usage',
  requirePermission('reports', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const { startDate, endDate, itemId, assetId } = req.query;
      const report = await reportsService.sparePartUsageReport({
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        itemId: itemId as string | undefined,
        assetId: assetId as string | undefined
      });
      sendSuccess(res, report);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/downtime',
  requirePermission('reports', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const { startDate, endDate, assetId } = req.query;
      const report = await reportsService.mttr({
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        assetId: assetId as string | undefined
      });
      sendSuccess(res, report);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/mtbf',
  requirePermission('reports', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const { startDate, endDate, assetId } = req.query;
      const report = await reportsService.mtbf({
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        assetId: assetId as string | undefined
      });
      sendSuccess(res, report);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/asset-history/:assetId',
  requirePermission('reports', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const history = await reportsService.assetHistory(req.params.assetId);
      if (!history) {
        throw new NotFoundError('Asset not found');
      }
      sendSuccess(res, history);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
