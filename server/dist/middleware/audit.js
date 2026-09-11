"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = logAudit;
const connection_1 = require("../database/connection");
const utils_1 = require("../shared/utils");
async function logAudit(userId, action, entity, entityId, oldValue, newValue, req) {
    try {
        const db = await (0, connection_1.getDb)();
        db.run(`INSERT INTO audit_logs (id, userId, action, entity, entityId, oldValue, newValue, ipAddress, userAgent, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            (0, utils_1.generateId)(),
            userId || null,
            action,
            entity,
            entityId || null,
            oldValue ? JSON.stringify((0, utils_1.sanitizeForLog)(oldValue)) : null,
            newValue ? JSON.stringify((0, utils_1.sanitizeForLog)(newValue)) : null,
            req.ip || req.socket.remoteAddress || null,
            req.headers['user-agent'] || null,
            (0, utils_1.nowISO)()
        ]);
    }
    catch (err) {
        console.error('Audit log error:', err);
    }
}
