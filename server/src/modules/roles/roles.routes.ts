import { Router } from 'express';
import { z } from 'zod';
import { rolesService } from './roles.service';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { sendSuccess } from '../../shared/response';
import { logAudit } from '../../middleware/audit';

const router = Router();

const createRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).optional()
});

const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).optional()
});

router.use(authenticate);

router.get('/permissions', requirePermission('roles', 'read'), async (req, res, next) => {
  try {
    const permissions = await rolesService.getAllPermissions();
    sendSuccess(res, permissions);
  } catch (error) { next(error); }
});

router.get('/:id', requirePermission('roles', 'read'), async (req, res, next) => {
  try {
    const role = await rolesService.getById(req.params.id);
    sendSuccess(res, role);
  } catch (error) { next(error); }
});

router.get('/', requirePermission('roles', 'read'), async (req, res, next) => {
  try {
    const roles = await rolesService.list();
    sendSuccess(res, roles);
  } catch (error) { next(error); }
});

router.post('/', requirePermission('roles', 'create'), validate(createRoleSchema), async (req: any, res, next) => {
  try {
    const role = await rolesService.create(req.body);
    logAudit(req.user.id, 'CREATE', 'role', role.id, null, JSON.stringify(role), req);
    sendSuccess(res, role, 201);
  } catch (error) { next(error); }
});

router.put('/:id', requirePermission('roles', 'update'), validate(updateRoleSchema), async (req: any, res, next) => {
  try {
    const oldRole = await rolesService.getById(req.params.id);
    const role = await rolesService.update(req.params.id, req.body);
    logAudit(req.user.id, 'UPDATE', 'role', role.id, JSON.stringify(oldRole), JSON.stringify(role), req);
    sendSuccess(res, role);
  } catch (error) { next(error); }
});

router.delete('/:id', requirePermission('roles', 'delete'), async (req: any, res, next) => {
  try {
    const role = await rolesService.getById(req.params.id);
    await rolesService.delete(req.params.id);
    logAudit(req.user.id, 'DELETE', 'role', req.params.id, JSON.stringify(role), null, req);
    sendSuccess(res, { message: 'Role deleted' });
  } catch (error) { next(error); }
});

export default router;
