"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = requirePermission;
const errors_1 = require("../shared/errors");
function requirePermission(module, action) {
    return (req, res, next) => {
        if (!req.user) {
            next(new errors_1.ForbiddenError('Not authenticated'));
            return;
        }
        const permissionName = `${module}.${action}`;
        const hasPermission = req.user.permissions.includes(permissionName) ||
            req.user.permissions.includes(`${module}.*`) ||
            req.user.permissions.includes('*.*');
        if (!hasPermission) {
            next(new errors_1.ForbiddenError(`Missing permission: ${permissionName}`));
            return;
        }
        next();
    };
}
