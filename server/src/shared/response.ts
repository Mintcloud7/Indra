import { Response } from 'express';

export function sendSuccess(res: Response, data: any, statusCode: number = 200): void {
  res.status(statusCode).json({ success: true, data });
}

export function sendError(res: Response, message: string, statusCode: number = 500, errorCode?: string, errors?: any): void {
  res.status(statusCode).json({
    success: false,
    message,
    error_code: errorCode || 'ERROR',
    ...(errors && { errors })
  });
}

export function sendPaginated(res: Response, data: any[], total: number, page: number, limit: number): void {
  res.status(200).json({
    success: true,
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  });
}
