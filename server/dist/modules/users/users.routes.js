"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const users_service_1 = require("./users.service");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const validate_1 = require("../../middleware/validate");
const response_1 = require("../../shared/response");
const audit_1 = require("../../middleware/audit");
const router = (0, express_1.Router)();
const createUserSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    name: zod_1.z.string().min(1),
    phone: zod_1.z.string().optional(),
    avatar: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
    roleIds: zod_1.z.array(zod_1.z.string()).optional()
});
const updateUserSchema = zod_1.z.object({
    email: zod_1.z.string().email().optional(),
    name: zod_1.z.string().min(1).optional(),
    phone: zod_1.z.string().optional(),
    avatar: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
    password: zod_1.z.string().min(8).optional(),
    roleIds: zod_1.z.array(zod_1.z.string()).optional()
});
router.use(auth_1.authenticate);
const changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: zod_1.z.string().min(8),
});
router.put('/me/password', (0, validate_1.validate)(changePasswordSchema), async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        await users_service_1.usersService.changePassword(req.user.id, currentPassword, newPassword);
        (0, response_1.sendSuccess)(res, { message: 'Password berhasil diubah' });
    }
    catch (error) {
        next(error);
    }
});
router.get('/', (0, rbac_1.requirePermission)('users', 'read'), async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const search = req.query.search;
        const { users, total } = await users_service_1.usersService.list(page, limit, search);
        (0, response_1.sendPaginated)(res, users, total, page, limit);
    }
    catch (error) {
        next(error);
    }
});
router.get('/technicians', (0, rbac_1.requirePermission)('work_orders', 'read'), async (req, res, next) => {
    try {
        const technicians = await users_service_1.usersService.getTechnicians();
        (0, response_1.sendSuccess)(res, technicians);
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id', (0, rbac_1.requirePermission)('users', 'read'), async (req, res, next) => {
    try {
        const user = await users_service_1.usersService.getById(req.params.id);
        (0, response_1.sendSuccess)(res, user);
    }
    catch (error) {
        next(error);
    }
});
router.post('/', (0, rbac_1.requirePermission)('users', 'create'), (0, validate_1.validate)(createUserSchema), async (req, res, next) => {
    try {
        const user = await users_service_1.usersService.create(req.body);
        (0, audit_1.logAudit)(req.user.id, 'CREATE', 'user', user.id, null, JSON.stringify(user), req);
        (0, response_1.sendSuccess)(res, user, 201);
    }
    catch (error) {
        next(error);
    }
});
router.put('/:id', (0, rbac_1.requirePermission)('users', 'update'), (0, validate_1.validate)(updateUserSchema), async (req, res, next) => {
    try {
        const oldUser = await users_service_1.usersService.getById(req.params.id);
        const user = await users_service_1.usersService.update(req.params.id, req.body);
        (0, audit_1.logAudit)(req.user.id, 'UPDATE', 'user', user.id, JSON.stringify(oldUser), JSON.stringify(user), req);
        (0, response_1.sendSuccess)(res, user);
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:id', (0, rbac_1.requirePermission)('users', 'delete'), async (req, res, next) => {
    try {
        const user = await users_service_1.usersService.getById(req.params.id);
        await users_service_1.usersService.delete(req.params.id);
        (0, audit_1.logAudit)(req.user.id, 'DELETE', 'user', req.params.id, JSON.stringify(user), null, req);
        (0, response_1.sendSuccess)(res, { message: 'User deleted' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
