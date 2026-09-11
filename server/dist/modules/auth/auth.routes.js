"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_service_1 = require("./auth.service");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const response_1 = require("../../shared/response");
const audit_1 = require("../../middleware/audit");
const router = (0, express_1.Router)();
const loginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1),
    password: zod_1.z.string().min(1)
});
const changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: zod_1.z.string().min(8)
});
router.post('/login', (0, validate_1.validate)(loginSchema), async (req, res, next) => {
    try {
        const { username, password } = req.body;
        const result = await auth_service_1.authService.login(username, password);
        (0, audit_1.logAudit)(result.user.id, 'LOGIN', 'user', result.user.id, null, JSON.stringify({ username }), req);
        (0, response_1.sendSuccess)(res, result);
    }
    catch (error) {
        next(error);
    }
});
router.post('/logout', auth_1.authenticate, async (req, res, next) => {
    try {
        (0, audit_1.logAudit)(req.user.id, 'LOGOUT', 'user', req.user.id, null, null, req);
        (0, response_1.sendSuccess)(res, { message: 'Logged out' });
    }
    catch (error) {
        next(error);
    }
});
router.get('/me', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = await auth_service_1.authService.getMe(req.user.id);
        (0, response_1.sendSuccess)(res, user);
    }
    catch (error) {
        next(error);
    }
});
router.post('/change-password', auth_1.authenticate, (0, validate_1.validate)(changePasswordSchema), async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        await auth_service_1.authService.changePassword(req.user.id, currentPassword, newPassword);
        (0, audit_1.logAudit)(req.user.id, 'CHANGE_PASSWORD', 'user', req.user.id, null, null, req);
        (0, response_1.sendSuccess)(res, { message: 'Password changed successfully' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
