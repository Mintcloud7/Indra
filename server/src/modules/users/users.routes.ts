import { Router } from 'express';
import { z } from 'zod';
import { usersService } from './users.service';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { sendSuccess, sendPaginated } from '../../shared/response';
import { logAudit } from '../../middleware/audit';

const router = Router();

const createUserSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(8),
  name: z.string().min(1),
  phone: z.string().optional(),
  avatar: z.string().optional(),
  isActive: z.boolean().optional(),
  roleIds: z.array(z.string()).optional()
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  avatar: z.string().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
  roleIds: z.array(z.string()).optional()
});

router.use(authenticate);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.put('/me/password', validate(changePasswordSchema), async (req: any, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await usersService.changePassword(req.user.id, currentPassword, newPassword);
    sendSuccess(res, { message: 'Password berhasil diubah' });
  } catch (error) { next(error); }
});

router.get('/', requirePermission('users', 'read'), async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const search = req.query.search as string | undefined;
    const { users, total } = await usersService.list(page, limit, search);
    sendPaginated(res, users, total, page, limit);
  } catch (error) { next(error); }
});

router.get('/technicians', requirePermission('work_orders', 'read'), async (req, res, next) => {
  try {
    const technicians = await usersService.getTechnicians();
    sendSuccess(res, technicians);
  } catch (error) { next(error); }
});

router.get('/:id', requirePermission('users', 'read'), async (req, res, next) => {
  try {
    const user = await usersService.getById(req.params.id);
    sendSuccess(res, user);
  } catch (error) { next(error); }
});

router.post('/', requirePermission('users', 'create'), validate(createUserSchema), async (req: any, res, next) => {
  try {
    const user = await usersService.create(req.body);
    logAudit(req.user.id, 'CREATE', 'user', user.id, null, JSON.stringify(user), req);
    sendSuccess(res, user, 201);
  } catch (error) { next(error); }
});

router.put('/:id', requirePermission('users', 'update'), validate(updateUserSchema), async (req: any, res, next) => {
  try {
    const oldUser = await usersService.getById(req.params.id);
    const user = await usersService.update(req.params.id, req.body);
    logAudit(req.user.id, 'UPDATE', 'user', user.id, JSON.stringify(oldUser), JSON.stringify(user), req);
    sendSuccess(res, user);
  } catch (error) { next(error); }
});

router.delete('/:id', requirePermission('users', 'delete'), async (req: any, res, next) => {
  try {
    const user = await usersService.getById(req.params.id);
    await usersService.delete(req.params.id);
    logAudit(req.user.id, 'DELETE', 'user', req.params.id, JSON.stringify(user), null, req);
    sendSuccess(res, { message: 'User deleted' });
  } catch (error) { next(error); }
});

export default router;
