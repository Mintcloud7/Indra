"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
function validate(schema) {
    return (req, res, next) => {
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
