import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../shared/types';
import { UnauthorizedError } from '../shared/errors';

const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-secret';

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, AUTH_SECRET) as { id: string; email: string; name: string; roles: string[]; permissions: string[] };

    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      roles: decoded.roles,
      permissions: decoded.permissions
    };

    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      next(err);
    } else {
      next(new UnauthorizedError('Invalid or expired token'));
    }
  }
}
