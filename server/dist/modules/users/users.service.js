"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersService = exports.UsersService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
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
class UsersService {
    async list(page = 1, limit = 20, search) {
        const { offset, limit: pageSize } = (0, utils_1.paginate)(page, limit);
        const db = await (0, connection_1.getDb)();
        let whereClause = '';
        const params = [];
        if (search) {
            whereClause = 'WHERE u.name LIKE ? OR u.email LIKE ?';
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern);
        }
        const countParams = [...params];
        const countResult = db.exec(`SELECT COUNT(*) as total FROM users u ${whereClause}`, countParams);
        const total = countResult[0]?.values[0]?.[0] || 0;
        params.push(pageSize, offset);
        const dataResult = db.exec(`SELECT u.id, u.email, u.name, u.phone, u.avatar, u.isActive, u.createdAt, u.updatedAt
       FROM users u ${whereClause}
       ORDER BY u.createdAt DESC
       LIMIT ? OFFSET ?`, params);
        const rows = formatRows(dataResult);
        const users = [];
        for (const row of rows) {
            const rolesResult = db.exec(`SELECT r.id, r.name FROM roles r JOIN user_roles ur ON r.id = ur.roleId WHERE ur.userId = ?`, [row.id]);
            const roles = formatRows(rolesResult);
            users.push({
                id: row.id, email: row.email, name: row.name, phone: row.phone,
                avatar: row.avatar, isActive: !!row.isActive, createdAt: row.createdAt, updatedAt: row.updatedAt, roles
            });
        }
        return { users, total };
    }
    async getById(id) {
        const db = await (0, connection_1.getDb)();
        const result = db.exec("SELECT id, email, name, phone, avatar, isActive, createdAt, updatedAt FROM users WHERE id = ?", [id]);
        const row = formatRow(result);
        if (!row) {
            throw new errors_1.NotFoundError('User not found');
        }
        const rolesResult = db.exec(`SELECT r.id, r.name FROM roles r JOIN user_roles ur ON r.id = ur.roleId WHERE ur.userId = ?`, [id]);
        const roles = formatRows(rolesResult);
        return {
            id: row.id, email: row.email, name: row.name, phone: row.phone,
            avatar: row.avatar, isActive: !!row.isActive, createdAt: row.createdAt, updatedAt: row.updatedAt, roles
        };
    }
    async create(data) {
        const db = await (0, connection_1.getDb)();
        const existingResult = db.exec("SELECT id FROM users WHERE email = ?", [data.email]);
        const existing = formatRow(existingResult);
        if (existing) {
            throw new errors_1.ConflictError('Email already exists');
        }
        const id = (0, utils_1.generateId)();
        const hashedPassword = await bcryptjs_1.default.hash(data.password, 12);
        const now = (0, utils_1.nowISO)();
        db.run(`INSERT INTO users (id, email, password, name, phone, avatar, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, data.email, hashedPassword, data.name, data.phone || null, data.avatar || null,
            data.isActive !== false ? 1 : 0, now, now]);
        if (data.roleIds && data.roleIds.length > 0) {
            for (const roleId of data.roleIds) {
                db.run("INSERT INTO user_roles (id, userId, roleId) VALUES (?, ?, ?)", [(0, utils_1.generateId)(), id, roleId]);
            }
        }
        (0, connection_1.saveDb)();
        return this.getById(id);
    }
    async update(id, data) {
        const db = await (0, connection_1.getDb)();
        const existingResult = db.exec("SELECT id FROM users WHERE id = ?", [id]);
        const existing = formatRow(existingResult);
        if (!existing) {
            throw new errors_1.NotFoundError('User not found');
        }
        if (data.email) {
            const emailCheckResult = db.exec("SELECT id FROM users WHERE email = ? AND id != ?", [data.email, id]);
            const emailCheck = formatRow(emailCheckResult);
            if (emailCheck) {
                throw new errors_1.ConflictError('Email already exists');
            }
        }
        const updates = [];
        const params = [];
        if (data.email !== undefined) {
            updates.push('email = ?');
            params.push(data.email);
        }
        if (data.name !== undefined) {
            updates.push('name = ?');
            params.push(data.name);
        }
        if (data.phone !== undefined) {
            updates.push('phone = ?');
            params.push(data.phone);
        }
        if (data.avatar !== undefined) {
            updates.push('avatar = ?');
            params.push(data.avatar);
        }
        if (data.isActive !== undefined) {
            updates.push('isActive = ?');
            params.push(data.isActive ? 1 : 0);
        }
        if (data.password) {
            const hashed = await bcryptjs_1.default.hash(data.password, 12);
            updates.push('password = ?');
            params.push(hashed);
        }
        if (updates.length > 0) {
            updates.push('updatedAt = ?');
            params.push((0, utils_1.nowISO)());
            params.push(id);
            db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
        }
        if (data.roleIds !== undefined) {
            db.run("DELETE FROM user_roles WHERE userId = ?", [id]);
            for (const roleId of data.roleIds) {
                db.run("INSERT INTO user_roles (id, userId, roleId) VALUES (?, ?, ?)", [(0, utils_1.generateId)(), id, roleId]);
            }
        }
        (0, connection_1.saveDb)();
        return this.getById(id);
    }
    async delete(id) {
        const db = await (0, connection_1.getDb)();
        const existingResult = db.exec("SELECT id FROM users WHERE id = ?", [id]);
        const existing = formatRow(existingResult);
        if (!existing) {
            throw new errors_1.NotFoundError('User not found');
        }
        db.run("DELETE FROM user_roles WHERE userId = ?", [id]);
        db.run("DELETE FROM users WHERE id = ?", [id]);
        (0, connection_1.saveDb)();
    }
    async getTechnicians() {
        const db = await (0, connection_1.getDb)();
        const result = db.exec(`SELECT u.id, u.email, u.name, u.phone
       FROM users u
       JOIN user_roles ur ON u.id = ur.userId
       JOIN roles r ON ur.roleId = r.id
       WHERE r.name = 'TECHNICIAN' AND u.isActive = 1
       ORDER BY u.name ASC`);
        return formatRows(result);
    }
    async changePassword(userId, currentPassword, newPassword) {
        const db = await (0, connection_1.getDb)();
        const result = db.exec("SELECT id, password FROM users WHERE id = ?", [userId]);
        const row = formatRow(result);
        if (!row) {
            throw new errors_1.NotFoundError('User not found');
        }
        const valid = await bcryptjs_1.default.compare(currentPassword, row.password);
        if (!valid) {
            throw new errors_1.BadRequestError('Password saat ini salah');
        }
        const hashed = await bcryptjs_1.default.hash(newPassword, 12);
        db.run("UPDATE users SET password = ?, updatedAt = ? WHERE id = ?", [hashed, (0, utils_1.nowISO)(), userId]);
        (0, connection_1.saveDb)();
    }
}
exports.UsersService = UsersService;
exports.usersService = new UsersService();
