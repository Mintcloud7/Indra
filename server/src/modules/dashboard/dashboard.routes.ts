import { Router } from 'express';
import { AuthRequest } from '../../shared/types';
import { sendSuccess } from '../../shared/response';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { dashboardService } from './dashboard.service';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('dashboard', 'read'),
  async (req: AuthRequest, res, next) => {
    try {
      const dashboard = await dashboardService.getFullDashboard();
      sendSuccess(res, dashboard);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
