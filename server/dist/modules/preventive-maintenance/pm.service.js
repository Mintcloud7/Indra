"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pmService = exports.PmService = void 0;
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
class PmService {
    async getChecklistStats() {
        const db = await (0, connection_1.getDb)();
        const result = db.exec(`SELECT pmId, COUNT(*) as total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
       FROM pm_checklists GROUP BY pmId`);
        const stats = {};
        if (result[0]) {
            for (const row of result[0].values) {
                stats[row[0]] = { total: row[1], completed: row[2] };
            }
        }
        return stats;
    }
    async list(page = 1, limit = 20, filters = {}) {
        const db = await (0, connection_1.getDb)();
        let where = 'WHERE 1=1';
        const params = [];
        if (filters.status) {
            where += ' AND pm.status = ?';
            params.push(filters.status);
        }
        if (filters.frequency) {
            where += ' AND pm.frequency = ?';
            params.push(filters.frequency);
        }
        if (filters.assetId) {
            where += ' AND pm.assetId = ?';
            params.push(filters.assetId);
        }
        if (filters.assignedToId) {
            where += ' AND pm.assignedToId = ?';
            params.push(filters.assignedToId);
        }
        if (filters.search) {
            where += ` AND (pm.title LIKE ? OR pm.description LIKE ?)`;
            params.push(`%${filters.search}%`, `%${filters.search}%`);
        }
        const countResult = db.exec(`SELECT COUNT(*) as count FROM preventive_maintenance pm ${where}`, params);
        const total = countResult[0]?.values[0]?.[0] || 0;
        const { offset, limit: lim } = (0, utils_1.paginate)(page, limit);
        params.push(lim, offset);
        const dataResult = db.exec(`SELECT pm.*, a.assetName, a.assetCode, u.name as assignedToName
       FROM preventive_maintenance pm
       LEFT JOIN assets a ON pm.assetId = a.id
       LEFT JOIN users u ON pm.assignedToId = u.id
       ${where} ORDER BY pm.createdAt DESC LIMIT ? OFFSET ?`, params);
        return { data: formatRows(dataResult), total };
    }
    async getById(id) {
        const db = await (0, connection_1.getDb)();
        const pmResult = db.exec(`SELECT pm.*, a.assetName, a.assetCode, u.name as assignedToName
       FROM preventive_maintenance pm
       LEFT JOIN assets a ON pm.assetId = a.id
       LEFT JOIN users u ON pm.assignedToId = u.id
       WHERE pm.id = ?`, [id]);
        const pm = formatRow(pmResult);
        if (!pm)
            throw new errors_1.NotFoundError('Preventive Maintenance not found');
        const clResult = db.exec(`SELECT * FROM pm_checklists WHERE pmId = ? ORDER BY createdAt`, [id]);
        pm.checklists = formatRows(clResult);
        const logsResult = db.exec(`SELECT pl.*, w.woNumber FROM pm_logs pl
       LEFT JOIN work_orders w ON pl.woId = w.id
       WHERE pl.pmId = ? ORDER BY pl.completedAt DESC`, [id]);
        pm.logs = formatRows(logsResult);
        const woResult = db.exec(`SELECT pw.*, w.woNumber, w.status as woStatus FROM pm_wos pw
       LEFT JOIN work_orders w ON pw.woId = w.id
       WHERE pw.pmId = ? ORDER BY pw.createdAt DESC`, [id]);
        pm.generatedWorkOrders = formatRows(woResult);
        return pm;
    }
    async getWorkOrders(id) {
        const db = await (0, connection_1.getDb)();
        const result = db.exec(`SELECT w.* FROM pm_wos pw
       LEFT JOIN work_orders w ON pw.woId = w.id
       WHERE pw.pmId = ? ORDER BY w.createdAt DESC`, [id]);
        return formatRows(result);
    }
    async create(data) {
        const db = await (0, connection_1.getDb)();
        const id = (0, utils_1.generateId)();
        const now = (0, utils_1.nowISO)();
        if (!data.title)
            throw new errors_1.BadRequestError('Title is required');
        if (!data.assetId)
            throw new errors_1.BadRequestError('Asset is required');
        if (!data.frequency)
            throw new errors_1.BadRequestError('Frequency is required');
        const validFrequencies = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM'];
        if (!validFrequencies.includes(data.frequency)) {
            throw new errors_1.BadRequestError(`Invalid frequency. Must be one of: ${validFrequencies.join(', ')}`);
        }
        const assetResult = db.exec('SELECT id FROM assets WHERE id = ?', [String(data.assetId)]);
        const asset = formatRow(assetResult);
        if (!asset) {
            throw new errors_1.NotFoundError('Asset not found');
        }
        const assignedToId = data.assignedToId || data.assignedTo || null;
        if (assignedToId) {
            const userResult = db.exec('SELECT id FROM users WHERE id = ?', [assignedToId]);
            const user = formatRow(userResult);
            if (!user) {
                throw new errors_1.NotFoundError('Assigned user not found');
            }
        }
        const nextDueDate = data.nextDueDate || this.calculateNextDueDate(data.frequency, data.startDate, data.customIntervalDays);
        db.run(`INSERT INTO preventive_maintenance (id, assetId, title, description, frequency, customIntervalDays, startDate, nextDueDate, meterType, meterThreshold, assignedToId, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`, [
            id, data.assetId, data.title, data.description || null,
            data.frequency, data.customIntervalDays || null,
            data.startDate || data.nextDueDate || now, nextDueDate,
            data.meterType || null, data.meterThreshold || null,
            assignedToId, now, now
        ]);
        if (data.checklists && Array.isArray(data.checklists)) {
            for (const item of data.checklists) {
                db.run(`INSERT INTO pm_checklists (id, pmId, title, description, required) VALUES (?, ?, ?, ?, ?)`, [(0, utils_1.generateId)(), id, item.title, item.description || null, item.required !== false ? 1 : 0]);
            }
        }
        (0, connection_1.saveDb)();
        return this.getById(id);
    }
    async update(id, data) {
        const db = await (0, connection_1.getDb)();
        const existingResult = db.exec('SELECT * FROM preventive_maintenance WHERE id = ?', [id]);
        const existing = formatRow(existingResult);
        if (!existing) {
            throw new errors_1.NotFoundError('Preventive Maintenance not found');
        }
        if (data.assignedToId) {
            const userResult = db.exec('SELECT id FROM users WHERE id = ?', [data.assignedToId]);
            const user = formatRow(userResult);
            if (!user) {
                throw new errors_1.NotFoundError('Assigned user not found');
            }
        }
        const fields = [];
        const params = [];
        const allowedFields = [
            'assetId', 'title', 'description', 'frequency', 'customIntervalDays',
            'startDate', 'nextDueDate', 'meterType', 'meterThreshold', 'assignedToId', 'status'
        ];
        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                fields.push(`${field} = ?`);
                params.push(data[field]);
            }
        }
        const recalculateDue = data.frequency || data.startDate || data.customIntervalDays;
        if (recalculateDue) {
            const frequency = data.frequency || existing.frequency;
            const startDate = data.startDate || existing.startDate;
            const customInterval = data.customIntervalDays !== undefined ? data.customIntervalDays : existing.customIntervalDays;
            const nextDue = this.calculateNextDueDate(frequency, startDate, customInterval);
            fields.push('nextDueDate = ?');
            params.push(nextDue);
        }
        if (fields.length === 0) {
            return this.getById(id);
        }
        fields.push('updatedAt = ?');
        params.push((0, utils_1.nowISO)());
        params.push(id);
        db.run(`UPDATE preventive_maintenance SET ${fields.join(', ')} WHERE id = ?`, params);
        if (data.checklists && Array.isArray(data.checklists)) {
            db.run('DELETE FROM pm_checklists WHERE pmId = ?', [id]);
            for (const item of data.checklists) {
                db.run(`INSERT INTO pm_checklists (id, pmId, title, description, required) VALUES (?, ?, ?, ?, ?)`, [(0, utils_1.generateId)(), id, item.title, item.description || null, item.required !== false ? 1 : 0]);
            }
        }
        (0, connection_1.saveDb)();
        return this.getById(id);
    }
    async delete(id) {
        const db = await (0, connection_1.getDb)();
        const existingResult = db.exec('SELECT id FROM preventive_maintenance WHERE id = ?', [id]);
        const existing = formatRow(existingResult);
        if (!existing) {
            throw new errors_1.NotFoundError('Preventive Maintenance not found');
        }
        db.run('DELETE FROM pm_checklists WHERE pmId = ?', [id]);
        db.run('DELETE FROM pm_logs WHERE pmId = ?', [id]);
        db.run('DELETE FROM pm_wos WHERE pmId = ?', [id]);
        db.run('DELETE FROM preventive_maintenance WHERE id = ?', [id]);
        (0, connection_1.saveDb)();
    }
    async toggleChecklist(checklistId, userId) {
        const db = await (0, connection_1.getDb)();
        const existing = formatRow(db.exec('SELECT * FROM pm_checklists WHERE id = ?', [checklistId]));
        if (!existing)
            throw new errors_1.NotFoundError('Checklist item not found');
        const newCompleted = existing.completed ? 0 : 1;
        const now = (0, utils_1.nowISO)();
        db.run(`UPDATE pm_checklists SET completed = ?, completedBy = ?, completedAt = ? WHERE id = ?`, [newCompleted, newCompleted ? userId : null, newCompleted ? now : null, checklistId]);
        (0, connection_1.saveDb)();
        return formatRow(db.exec('SELECT * FROM pm_checklists WHERE id = ?', [checklistId]));
    }
    async submitToLogbook(userId, workDate) {
        const db = await (0, connection_1.getDb)();
        const now = (0, utils_1.nowISO)();
        const pmsResult = db.exec(`SELECT pm.*, a.assetName, a.assetCode, a.location as assetLocation
       FROM preventive_maintenance pm
       LEFT JOIN assets a ON pm.assetId = a.id
       WHERE pm.nextDueDate = ? AND pm.status = 'ACTIVE'`, [workDate]);
        const pms = formatRows(pmsResult);
        if (pms.length === 0)
            throw new errors_1.BadRequestError('No PM schedules found for this date');
        const logBookId = (0, utils_1.generateId)();
        db.run(`INSERT INTO log_books (id, userId, workDate, location, description, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`, [logBookId, userId, workDate, 'PM Schedule', `Preventive maintenance activities for ${workDate}`, now, now]);
        for (const pm of pms) {
            const checklists = formatRows(db.exec('SELECT * FROM pm_checklists WHERE pmId = ? ORDER BY createdAt', [pm.id]));
            const completed = checklists.filter((c) => c.completed);
            const incomplete = checklists.filter((c) => !c.completed);
            let detailNotes = `PM: ${pm.title}`;
            if (pm.assetName)
                detailNotes += `\nAsset: ${pm.assetCode} - ${pm.assetName}`;
            if (pm.description)
                detailNotes += `\nDeskripsi: ${pm.description}`;
            if (checklists.length > 0) {
                detailNotes += `\n\nChecklist (${completed.length}/${checklists.length} selesai):`;
                for (const cl of checklists) {
                    const status = cl.completed ? '✓' : '✗';
                    const time = cl.completedAt ? ` (${new Date(cl.completedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})` : '';
                    detailNotes += `\n  ${status} ${cl.title}${time}`;
                }
            }
            const itemId = (0, utils_1.generateId)();
            db.run(`INSERT INTO log_book_items (id, logBookId, description, activityType, location, assetId, workOrderNo, durationMinutes, notes, createdAt)
         VALUES (?, ?, ?, 'PREVENTIVE', ?, ?, ?, ?, ?, ?)`, [itemId, logBookId, pm.title, pm.assetLocation || pm.assetName || null,
                pm.assetId || null, null, null, detailNotes, now]);
        }
        (0, connection_1.saveDb)();
        const result = db.exec(`SELECT lb.*, u.name as userName FROM log_books lb LEFT JOIN users u ON lb.userId = u.id WHERE lb.id = ?`, [logBookId]);
        const log = formatRow(result);
        log.items = formatRows(db.exec('SELECT * FROM log_book_items WHERE logBookId = ?', [logBookId]));
        log.spareParts = [];
        return log;
    }
    async generateWorkOrder(pmId) {
        const db = await (0, connection_1.getDb)();
        const pmResult = db.exec(`SELECT pm.*, a.assetName, a.assetCode, a.location
       FROM preventive_maintenance pm
       LEFT JOIN assets a ON pm.assetId = a.id
       WHERE pm.id = ?`, [pmId]);
        const pm = formatRow(pmResult);
        if (!pm) {
            throw new errors_1.NotFoundError('Preventive Maintenance not found');
        }
        if (pm.status !== 'ACTIVE') {
            throw new errors_1.BadRequestError('Can only generate work orders for ACTIVE preventive maintenance');
        }
        const now = (0, utils_1.nowISO)();
        const currentMonth = now.substring(0, 7);
        const existingWoResult = db.exec(`SELECT pw.id FROM pm_wos pw
       JOIN work_orders w ON pw.woId = w.id
       WHERE pw.pmId = ? AND w.createdAt >= ? AND w.createdAt < ?`, [pmId, `${currentMonth}-01`, `${currentMonth}-32`]);
        const existingWo = formatRows(existingWoResult);
        if (existingWo.length > 0) {
            throw new errors_1.BadRequestError('A work order for this PM period has already been generated');
        }
        db.run("BEGIN");
        try {
            const woCountResult = db.exec("SELECT COUNT(*) as count FROM work_orders WHERE woNumber LIKE ?", [`WO-${new Date().getFullYear()}%`]);
            const woNumber = (0, utils_1.generateWoNumber)(woCountResult[0]?.values[0]?.[0] || 0);
            const woId = (0, utils_1.generateId)();
            db.run(`INSERT INTO work_orders (id, woNumber, title, description, assetId, location, reportedById, assignedToId, priority, status, dueDate, problemDescription, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'MEDIUM', 'OPEN', ?, ?, ?)`, [
                woId, woNumber,
                `PM: ${pm.title}`,
                `Preventive Maintenance scheduled for ${pm.assetName || pm.assetCode}`,
                pm.assetId, pm.location || null,
                pm.assignedToId || 'system', pm.assignedToId || null,
                pm.nextDueDate,
                'Auto-generated from preventive maintenance schedule',
                now
            ]);
            db.run(`INSERT INTO pm_wos (id, pmId, woId, createdAt) VALUES (?, ?, ?, ?)`, [(0, utils_1.generateId)(), pmId, woId, now]);
            const checklistsResult = db.exec('SELECT * FROM pm_checklists WHERE pmId = ?', [pmId]);
            const checklists = formatRows(checklistsResult);
            for (const checklist of checklists) {
                db.run(`INSERT INTO work_order_checklists (id, woId, title, description, required, completed)
           VALUES (?, ?, ?, ?, ?, 0)`, [(0, utils_1.generateId)(), woId, checklist.title, checklist.description || null, checklist.required]);
            }
            db.run(`INSERT INTO pm_logs (id, pmId, woId, completedAt, notes) VALUES (?, ?, ?, ?, ?)`, [(0, utils_1.generateId)(), pmId, woId, now, 'Work order generated']);
            const newNextDue = this.calculateNextDueDate(pm.frequency, pm.startDate, pm.customIntervalDays);
            db.run('UPDATE preventive_maintenance SET nextDueDate = ?, updatedAt = ? WHERE id = ?', [newNextDue, now, pmId]);
            db.run("COMMIT");
            (0, connection_1.saveDb)();
            const woResult = db.exec(`SELECT wo.*, a.assetName, a.assetCode FROM work_orders wo
         LEFT JOIN assets a ON wo.assetId = a.id WHERE wo.id = ?`, [woId]);
            return formatRow(woResult);
        }
        catch (e) {
            db.run("ROLLBACK");
            throw e;
        }
    }
    async checkDuePMs() {
        const now = (0, utils_1.nowISO)();
        const db = await (0, connection_1.getDb)();
        const duePMsResult = db.exec(`SELECT pm.*, a.assetName, a.assetCode
       FROM preventive_maintenance pm
       LEFT JOIN assets a ON pm.assetId = a.id
       WHERE pm.status = 'ACTIVE' AND pm.nextDueDate <= ?`, [now]);
        const duePMs = formatRows(duePMsResult);
        if (duePMs.length === 0) {
            return [];
        }
        const generated = [];
        for (const pm of duePMs) {
            const currentMonth = now.substring(0, 7);
            const existingWoResult = db.exec(`SELECT pw.id FROM pm_wos pw
         JOIN work_orders w ON pw.woId = w.id
         WHERE pw.pmId = ? AND w.createdAt >= ? AND w.createdAt < ?`, [pm.id, `${currentMonth}-01`, `${currentMonth}-32`]);
            const existingWo = formatRows(existingWoResult);
            if (existingWo.length === 0) {
                try {
                    const wo = await this.generateWorkOrder(pm.id);
                    generated.push(wo);
                }
                catch (err) {
                    console.error(`Failed to generate WO for PM ${pm.id}:`, err);
                }
            }
        }
        return generated;
    }
    calculateNextDueDate(frequency, startDate, customIntervalDays) {
        const start = startDate ? new Date(startDate) : new Date();
        const next = new Date(start);
        switch (frequency) {
            case 'DAILY':
                next.setDate(start.getDate() + 1);
                break;
            case 'WEEKLY':
                next.setDate(start.getDate() + 7);
                break;
            case 'MONTHLY':
                next.setMonth(start.getMonth() + 1);
                break;
            case 'QUARTERLY':
                next.setMonth(start.getMonth() + 3);
                break;
            case 'YEARLY':
                next.setFullYear(start.getFullYear() + 1);
                break;
            case 'CUSTOM':
                const days = customIntervalDays || 30;
                next.setDate(start.getDate() + days);
                break;
            default:
                next.setMonth(start.getMonth() + 1);
        }
        return next.toISOString().split('T')[0];
    }
}
exports.PmService = PmService;
exports.pmService = new PmService();
