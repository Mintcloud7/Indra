import { Router } from 'express';
import { z } from 'zod';
import { authService } from './auth.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { sendSuccess } from '../../shared/response';
import { logAudit } from '../../middleware/audit';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);
    logAudit(result.user.id, 'LOGIN', 'user', result.user.id, null, JSON.stringify({ username }), req);
    sendSuccess(res, result);
  } catch (error) { next(error); }
});

router.post('/logout', authenticate, async (req: any, res, next) => {
  try {
    logAudit(req.user.id, 'LOGOUT', 'user', req.user.id, null, null, req);
    sendSuccess(res, { message: 'Logged out' });
  } catch (error) { next(error); }
});

router.get('/me', authenticate, async (req: any, res, next) => {
  try {
    const user = await authService.getMe(req.user.id);
    sendSuccess(res, user);
  } catch (error) { next(error); }
});

router.post('/change-password', authenticate, validate(changePasswordSchema), async (req: any, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user.id, currentPassword, newPassword);
    logAudit(req.user.id, 'CHANGE_PASSWORD', 'user', req.user.id, null, null, req);
    sendSuccess(res, { message: 'Password changed successfully' });
  } catch (error) { next(error); }
});

export default router;
