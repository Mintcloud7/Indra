"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const roles_service_1 = require("./roles.service");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const validate_1 = require("../../middleware/validate");
const response_1 = require("../../shared/response");
const audit_1 = require("../../middleware/audit");
const router = (0, express_1.Router)();
const createRoleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    permissionIds: zod_1.z.array(zod_1.z.string()).optional()
});
const updateRoleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().optional(),
    permissionIds: zod_1.z.array(zod_1.z.string()).optional()
});
router.use(auth_1.authenticate);
router.get('/permissions', (0, rbac_1.requirePermission)('roles', 'read'), async (req, res, next) => {
    try {
        const permissions = await roles_service_1.rolesService.getAllPermissions();
        (0, response_1.sendSuccess)(res, permissions);
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id', (0, rbac_1.requirePermission)('roles', 'read'), async (req, res, next) => {
    try {
        const role = await roles_service_1.rolesService.getById(req.params.id);
        (0, response_1.sendSuccess)(res, role);
    }
    catch (error) {
        next(error);
    }
});
router.get('/', (0, rbac_1.requirePermission)('roles', 'read'), async (req, res, next) => {
    try {
        const roles = await roles_service_1.rolesService.list();
        (0, response_1.sendSuccess)(res, roles);
    }
    catch (error) {
        next(error);
    }
});
router.post('/', (0, rbac_1.requirePermission)('roles', 'create'), (0, validate_1.validate)(createRoleSchema), async (req, res, next) => {
    try {
        const role = await roles_service_1.rolesService.create(req.body);
        (0, audit_1.logAudit)(req.user.id, 'CREATE', 'role', role.id, null, JSON.stringify(role), req);
        (0, response_1.sendSuccess)(res, role, 201);
    }
    catch (error) {
        next(error);
    }
});
router.put('/:id', (0, rbac_1.requirePermission)('roles', 'update'), (0, validate_1.validate)(updateRoleSchema), async (req, res, next) => {
    try {
        const oldRole = await roles_service_1.rolesService.getById(req.params.id);
        const role = await roles_service_1.rolesService.update(req.params.id, req.body);
        (0, audit_1.logAudit)(req.user.id, 'UPDATE', 'role', role.id, JSON.stringify(oldRole), JSON.stringify(role), req);
        (0, response_1.sendSuccess)(res, role);
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:id', (0, rbac_1.requirePermission)('roles', 'delete'), async (req, res, next) => {
    try {
        const role = await roles_service_1.rolesService.getById(req.params.id);
        await roles_service_1.rolesService.delete(req.params.id);
        (0, audit_1.logAudit)(req.user.id, 'DELETE', 'role', req.params.id, JSON.stringify(role), null, req);
        (0, response_1.sendSuccess)(res, { message: 'Role deleted' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
