"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rolesService = exports.RolesService = void 0;
const connection_1 = require("../../database/connection");
const errors_1 = require("../../shared/errors");
const utils_1 = require("../../shared/utils");
function formatRow(result, index = 0) {
    if (!result[0] || !result[0].values[index])
        return null;
    const obj = {};
    result[0].columns.forEach((col, i) => {
        obj[col] = result[0].values[index][i];
    });
    return obj;
}
function formatRows(result) {
    if (!result[0])
        return [];
    return result[0].values.map((row) => {
        const obj = {};
        result[0].columns.forEach((col, i) => {
            obj[col] = row[i];
        });
        return obj;
    });
}
class RolesService {
    async list() {
        const db = await (0, connection_1.getDb)();
        const result = db.exec(`SELECT r.id, r.name, r.description, r.createdAt, r.updatedAt,
              (SELECT COUNT(*) FROM role_permissions rp WHERE rp.roleId = r.id) as permissionCount
       FROM roles r
       ORDER BY r.name ASC`);
        return formatRows(result);
    }
    async getById(id) {
        const db = await (0, connection_1.getDb)();
        const result = db.exec("SELECT id, name, description, createdAt, updatedAt FROM roles WHERE id = ?", [id]);
        const row = formatRow(result);
        if (!row) {
            throw new errors_1.NotFoundError('Role not found');
        }
        const permissionsResult = db.exec(`SELECT p.id, p.name, p.module, p.action, p.description
       FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permissionId
       WHERE rp.roleId = ?
       ORDER BY p.module, p.action`, [id]);
        const permissions = formatRows(permissionsResult);
        return { ...row, permissions };
    }
    async create(data) {
        const db = await (0, connection_1.getDb)();
        const existingResult = db.exec("SELECT id FROM roles WHERE name = ?", [data.name]);
        const existing = formatRow(existingResult);
        if (existing) {
            throw new errors_1.ConflictError('Role name already exists');
        }
        const id = (0, utils_1.generateId)();
        const now = (0, utils_1.nowISO)();
        db.run(`INSERT INTO roles (id, name, description, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?)`, [id, data.name, data.description || null, now, now]);
        if (data.permissionIds && data.permissionIds.length > 0) {
            for (const permissionId of data.permissionIds) {
                db.run("INSERT INTO role_permissions (id, roleId, permissionId) VALUES (?, ?, ?)", [(0, utils_1.generateId)(), id, permissionId]);
            }
        }
        (0, connection_1.saveDb)();
        return this.getById(id);
    }
    async update(id, data) {
        const db = await (0, connection_1.getDb)();
        const existingResult = db.exec("SELECT id FROM roles WHERE id = ?", [id]);
        const existing = formatRow(existingResult);
        if (!existing) {
            throw new errors_1.NotFoundError('Role not found');
        }
        if (data.name) {
            const nameCheckResult = db.exec("SELECT id FROM roles WHERE name = ? AND id != ?", [data.name, id]);
            const nameCheck = formatRow(nameCheckResult);
            if (nameCheck) {
                throw new errors_1.ConflictError('Role name already exists');
            }
        }
        const updates = [];
        const params = [];
        if (data.name !== undefined) {
            updates.push('name = ?');
            params.push(data.name);
        }
        if (data.description !== undefined) {
            updates.push('description = ?');
            params.push(data.description);
        }
        if (updates.length > 0) {
            updates.push('updatedAt = ?');
            params.push((0, utils_1.nowISO)());
            params.push(id);
            db.run(`UPDATE roles SET ${updates.join(', ')} WHERE id = ?`, params);
        }
        if (data.permissionIds !== undefined) {
            db.run("DELETE FROM role_permissions WHERE roleId = ?", [id]);
            for (const permissionId of data.permissionIds) {
                db.run("INSERT INTO role_permissions (id, roleId, permissionId) VALUES (?, ?, ?)", [(0, utils_1.generateId)(), id, permissionId]);
            }
        }
        (0, connection_1.saveDb)();
        return this.getById(id);
    }
    async delete(id) {
        const db = await (0, connection_1.getDb)();
        const existingResult = db.exec("SELECT id FROM roles WHERE id = ?", [id]);
        const existing = formatRow(existingResult);
        if (!existing) {
            throw new errors_1.NotFoundError('Role not found');
        }
        const usersWithRoleResult = db.exec("SELECT COUNT(*) as count FROM user_roles WHERE roleId = ?", [id]);
        const count = usersWithRoleResult[0]?.values[0]?.[0] || 0;
        if (count > 0) {
            throw new errors_1.ConflictError('Cannot delete role that is assigned to users');
        }
        db.run("DELETE FROM role_permissions WHERE roleId = ?", [id]);
        db.run("DELETE FROM roles WHERE id = ?", [id]);
        (0, connection_1.saveDb)();
    }
    async getAllPermissions() {
        const db = await (0, connection_1.getDb)();
        const result = db.exec(`SELECT id, name, module, action, description
       FROM permissions
       ORDER BY module, action`);
        return formatRows(result);
    }
}
exports.RolesService = RolesService;
exports.rolesService = new RolesService();
