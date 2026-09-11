"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const response_1 = require("../../shared/response");
const connection_1 = require("../../database/connection");
const utils_1 = require("../../shared/utils");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const router = (0, express_1.Router)();
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
router.use(auth_1.authenticate);
router.get('/', (0, rbac_1.requirePermission)('audit_logs', 'read'), async (req, res, next) => {
    try {
        const db = await (0, connection_1.getDb)();
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const { offset, limit: lim } = (0, utils_1.paginate)(page, limit);
        let whereClause = '';
        const params = [];
        const action = req.query.action;
        const entity = req.query.entity;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        if (action) {
            whereClause += ' AND al.action = ?';
            params.push(action);
        }
        if (entity) {
            whereClause += ' AND al.entity = ?';
            params.push(entity);
        }
        if (startDate) {
            whereClause += ' AND al.createdAt >= ?';
            params.push(startDate);
        }
        if (endDate) {
            whereClause += ' AND al.createdAt <= ?';
            params.push(endDate + 'T23:59:59');
        }
        const countParams = [...params];
        const countResult = db.exec(`SELECT COUNT(*) as total FROM audit_logs al WHERE 1=1 ${whereClause}`, countParams);
        const total = countResult[0]?.values[0]?.[0] || 0;
        params.push(lim, offset);
        const dataResult = db.exec(`SELECT al.*, u.name as userName, u.email as userEmail
       FROM audit_logs al
       LEFT JOIN users u ON al.userId = u.id
       WHERE 1=1 ${whereClause}
       ORDER BY al.createdAt DESC LIMIT ? OFFSET ?`, params);
        const data = formatRows(dataResult);
        for (const obj of data) {
            if (obj.oldValue && typeof obj.oldValue === 'string') {
                try {
                    obj.oldValue = JSON.parse(obj.oldValue);
                }
                catch { }
            }
            if (obj.newValue && typeof obj.newValue === 'string') {
                try {
                    obj.newValue = JSON.parse(obj.newValue);
                }
                catch { }
            }
            obj.user = obj.userName ? { name: obj.userName, email: obj.userEmail } : undefined;
        }
        (0, response_1.sendPaginated)(res, data, total, page, limit);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
