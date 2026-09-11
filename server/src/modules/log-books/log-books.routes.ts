import { Router } from 'express';
import { AuthRequest } from '../../shared/types';
import { sendSuccess, sendPaginated } from '../../shared/response';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { logAudit } from '../../middleware/audit';
import { listLogBooks, getLogBookById, createLogBook, updateLogBook, deleteLogBook } from './log-books.service';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('log_books', 'read'), async (req: AuthRequest, res, next) => {
  try {
    const { page = 1, limit = 20, userId, startDate, endDate, search } = req.query;
    const result = await listLogBooks(
      Number(page),
      Number(limit),
      userId as string | undefined,
      startDate as string | undefined,
      endDate as string | undefined,
      search as string | undefined
    );
    sendPaginated(res, result.data, result.total, result.page, result.limit);
  } catch (err) { next(err); }
});

router.get('/:id', requirePermission('log_books', 'read'), async (req: AuthRequest, res, next) => {
  try {
    const log = await getLogBookById(req.params.id);
    sendSuccess(res, log);
  } catch (err) { next(err); }
});

router.post('/', requirePermission('log_books', 'create'), async (req: AuthRequest, res, next) => {
  try {
    const log = await createLogBook({ ...req.body, userId: req.user!.id });
    await logAudit(req.user?.id, 'CREATE', 'log_book', log.id, null, log, req);
    sendSuccess(res, log, 201);
  } catch (err) { next(err); }
});

router.put('/:id', requirePermission('log_books', 'update'), async (req: AuthRequest, res, next) => {
  try {
    const log = await updateLogBook(req.params.id, req.body);
    await logAudit(req.user?.id, 'UPDATE', 'log_book', log.id, null, log, req);
    sendSuccess(res, log);
  } catch (err) { next(err); }
});

router.delete('/:id', requirePermission('log_books', 'delete'), async (req: AuthRequest, res, next) => {
  try {
    await deleteLogBook(req.params.id);
    await logAudit(req.user?.id, 'DELETE', 'log_book', req.params.id, null, null, req);
    sendSuccess(res, { message: 'Log book deleted' });
  } catch (err) { next(err); }
});

export default router;
