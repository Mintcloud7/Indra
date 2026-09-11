"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const connection_1 = require("../../database/connection");
const errors_1 = require("../../shared/errors");
const utils_1 = require("../../shared/utils");
const JWT_SECRET = process.env.AUTH_SECRET || 'dev-secret';
const JWT_EXPIRES = '24h';
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
class AuthService {
    async login(username, password) {
        const db = await (0, connection_1.getDb)();
        const result = db.exec("SELECT id, username, email, name, password, isActive FROM users WHERE username = ?", [username]);
        const user = formatRow(result);
        if (!user) {
            throw new errors_1.UnauthorizedError('Username atau password salah');
        }
        if (!user.isActive) {
            throw new errors_1.UnauthorizedError('Akun tidak aktif');
        }
        const validPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!validPassword) {
            throw new errors_1.UnauthorizedError('Username atau password salah');
        }
        const rolesResult = db.exec(`SELECT r.id, r.name FROM roles r
       JOIN user_roles ur ON r.id = ur.roleId
       WHERE ur.userId = ?`, [user.id]);
        const roles = formatRows(rolesResult);
        const permissionsResult = db.exec(`SELECT DISTINCT p.name FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permissionId
       JOIN user_roles ur ON rp.roleId = ur.roleId
       WHERE ur.userId = ?`, [user.id]);
        const permissions = formatRows(permissionsResult);
        const tokenPayload = {
            id: user.id,
            username: user.username,
            email: user.email,
            name: user.name,
            roles: roles.map((r) => r.name),
            permissions: permissions.map((p) => p.name)
        };
        const token = jsonwebtoken_1.default.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
        return {
            token,
            user: { id: user.id, username: user.username, email: user.email, name: user.name, roles, permissions: permissions.map((p) => p.name) }
        };
    }
    async getMe(userId) {
        const db = await (0, connection_1.getDb)();
        const result = db.exec("SELECT id, email, name, phone, avatar, isActive FROM users WHERE id = ?", [userId]);
        const user = formatRow(result);
        if (!user) {
            throw new errors_1.NotFoundError('User not found');
        }
        const rolesResult = db.exec(`SELECT r.id, r.name FROM roles r JOIN user_roles ur ON r.id = ur.roleId WHERE ur.userId = ?`, [userId]);
        const roles = formatRows(rolesResult);
        const permissionsResult = db.exec(`SELECT DISTINCT p.name FROM permissions p JOIN role_permissions rp ON p.id = rp.permissionId JOIN user_roles ur ON rp.roleId = ur.roleId WHERE ur.userId = ?`, [userId]);
        const permissions = formatRows(permissionsResult);
        return {
            id: user.id, email: user.email, name: user.name, phone: user.phone,
            avatar: user.avatar, isActive: !!user.isActive, roles: roles.map((r) => r.name), permissions: permissions.map((p) => p.name)
        };
    }
    async changePassword(userId, currentPassword, newPassword) {
        const db = await (0, connection_1.getDb)();
        const result = db.exec("SELECT password FROM users WHERE id = ?", [userId]);
        const user = formatRow(result);
        if (!user)
            throw new errors_1.NotFoundError('User not found');
        const valid = await bcryptjs_1.default.compare(currentPassword, user.password);
        if (!valid)
            throw new errors_1.UnauthorizedError('Current password is incorrect');
        const hashed = await bcryptjs_1.default.hash(newPassword, 12);
        db.run("UPDATE users SET password = ?, updatedAt = ? WHERE id = ?", [hashed, (0, utils_1.nowISO)(), userId]);
        (0, connection_1.saveDb)();
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
