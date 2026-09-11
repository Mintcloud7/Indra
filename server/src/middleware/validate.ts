import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const formattedErrors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));

      res.status(400).json({
        success: false,
        message: 'Validation failed',
        error_code: 'VALIDATION_ERROR',
        errors: formattedErrors
      });
      return;
    }

    req.body = result.data;
    next();
  };
}
