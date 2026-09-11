"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = void 0;
const connection_1 = require("../../database/connection");
const utils_1 = require("../../shared/utils");
const errors_1 = require("../../shared/errors");
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
class NotificationService {
    async list(userId, page = 1, limit = 20, unreadOnly = false) {
        const db = await (0, connection_1.getDb)();
        let where = 'WHERE n.userId = ?';
        const params = [userId];
        if (unreadOnly) {
            where += ' AND n.read = 0';
        }
        const countResult = db.exec(`SELECT COUNT(*) as count FROM notifications n ${where}`, params);
        const total = countResult[0]?.values[0]?.[0] || 0;
        const { offset, limit: lim } = (0, utils_1.paginate)(page, limit);
        params.push(lim, offset);
        const dataResult = db.exec(`SELECT n.* FROM notifications n ${where} ORDER BY n.createdAt DESC LIMIT ? OFFSET ?`, params);
        return { data: formatRows(dataResult), total };
    }
    async getById(id) {
        const db = await (0, connection_1.getDb)();
        const result = db.exec('SELECT * FROM notifications WHERE id = ?', [id]);
        const row = formatRow(result);
        if (!row) {
            throw new errors_1.NotFoundError('Notification not found');
        }
        return row;
    }
    async markAsRead(id, userId) {
        const db = await (0, connection_1.getDb)();
        const existingResult = db.exec('SELECT * FROM notifications WHERE id = ? AND userId = ?', [id, userId]);
        const existing = formatRow(existingResult);
        if (!existing) {
            throw new errors_1.NotFoundError('Notification not found');
        }
        db.run('UPDATE notifications SET read = 1 WHERE id = ? AND userId = ?', [id, userId]);
        (0, connection_1.saveDb)();
        return this.getById(id);
    }
    async markAllAsRead(userId) {
        const db = await (0, connection_1.getDb)();
        db.run('UPDATE notifications SET read = 1 WHERE userId = ? AND read = 0', [userId]);
        (0, connection_1.saveDb)();
    }
    async create(userId, type, title, message, referenceType, referenceId) {
        const db = await (0, connection_1.getDb)();
        const id = (0, utils_1.generateId)();
        const now = (0, utils_1.nowISO)();
        db.run(`INSERT INTO notifications (id, userId, type, title, message, referenceType, referenceId, read, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`, [id, userId, type, title, message, referenceType || null, referenceId || null, now]);
        (0, connection_1.saveDb)();
        const result = db.exec('SELECT * FROM notifications WHERE id = ?', [id]);
        return formatRow(result);
    }
    async getUnreadCount(userId) {
        const db = await (0, connection_1.getDb)();
        const result = db.exec('SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND read = 0', [userId]);
        return result[0]?.values[0]?.[0] || 0;
    }
}
exports.NotificationService = NotificationService;
exports.notificationService = new NotificationService();
