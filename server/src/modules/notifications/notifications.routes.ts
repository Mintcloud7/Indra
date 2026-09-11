import { Router } from 'express';
import { AuthRequest } from '../../shared/types';
import { sendSuccess, sendPaginated } from '../../shared/response';
import { authenticate } from '../../middleware/auth';
import { notificationService } from './notifications.service';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  async (req: AuthRequest, res, next) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const unreadOnly = req.query.unreadOnly === 'true';
      const result = await notificationService.list(req.user!.id, page, limit, unreadOnly);
      sendPaginated(res, result.data, result.total, page, limit);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/unread-count',
  async (req: AuthRequest, res, next) => {
    try {
      const count = await notificationService.getUnreadCount(req.user!.id);
      sendSuccess(res, { count });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id',
  async (req: AuthRequest, res, next) => {
    try {
      const notification = await notificationService.getById(req.params.id);
      sendSuccess(res, notification);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:id/read',
  async (req: AuthRequest, res, next) => {
    try {
      const notification = await notificationService.markAsRead(req.params.id, req.user!.id);
      sendSuccess(res, notification);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/read-all',
  async (req: AuthRequest, res, next) => {
    try {
      await notificationService.markAllAsRead(req.user!.id);
      sendSuccess(res, { message: 'All notifications marked as read' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
