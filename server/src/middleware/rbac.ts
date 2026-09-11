import { Response, NextFunction } from 'express';
import { AuthRequest } from '../shared/types';
import { ForbiddenError } from '../shared/errors';

export function requirePermission(module: string, action: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ForbiddenError('Not authenticated'));
      return;
    }

    const permissionName = `${module}.${action}`;
    const hasPermission = req.user.permissions.includes(permissionName) ||
      req.user.permissions.includes(`${module}.*`) ||
      req.user.permissions.includes('*.*');

    if (!hasPermission) {
      next(new ForbiddenError(`Missing permission: ${permissionName}`));
      return;
    }

    next();
  };
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ForbiddenError('Not authenticated'));
      return;
    }

    const userRoles = (req.user.roles || []).map((r: any) => typeof r === 'string' ? r : r.name);
    const hasRole = roles.some(role => userRoles.includes(role));

    if (!hasRole) {
      next(new ForbiddenError('Insufficient role'));
      return;
    }

    next();
  };
}
