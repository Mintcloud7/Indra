import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error_code: err.errorCode
    });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error_code: 'INTERNAL_ERROR'
  });
}
