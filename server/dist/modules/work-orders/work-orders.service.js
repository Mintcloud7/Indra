"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workOrderService = exports.WorkOrderService = void 0;
const connection_1 = require("../../database/connection");
const utils_1 = require("../../shared/utils");
const errors_1 = require("../../shared/errors");
const VALID_TRANSITIONS = {
    OPEN: ['ASSIGNED'],
    ASSIGNED: ['IN_PROGRESS'],
    IN_PROGRESS: ['ON_HOLD', 'CLOSED'],
    ON_HOLD: ['IN_PROGRESS'],
    CLOSED: []
};
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
class WorkOrderService {
    async list(page = 1, limit = 20, filters = {}) {
        const db = await (0, connection_1.getDb)();
        let where = 'WHERE 1=1';
        const params = [];
        if (filters.status) {
            where += ' AND wo.status = ?';
            params.push(filters.status);
        }
        if (filters.priority) {
            where += ' AND wo.priority = ?';
            params.push(filters.priority);
        }
        if (filters.assignedToId) {
            where += ' AND wo.assignedToId = ?';
            params.push(filters.assignedToId);
        }
        if (filters.assetId) {
            where += ' AND wo.assetId = ?';
            params.push(filters.assetId);
        }
        if (filters.search) {
            where += ` AND (wo.woNumber LIKE ? OR wo.title LIKE ?)`;
            params.push(`%${filters.search}%`, `%${filters.search}%`);
        }
        const countResult = db.exec(`SELECT COUNT(*) as count FROM work_orders wo ${where}`, params);
        const total = countResult[0]?.values[0]?.[0] || 0;
        const { offset, limit: lim } = (0, utils_1.paginate)(page, limit);
        params.push(lim, offset);
        const dataResult = db.exec(`SELECT wo.*,
        a.assetName as assetName, a.assetCode as assetCode,
        u1.name as reportedByName,
        u2.name as supervisorName,
        u3.name as assignedToName
       FROM work_orders wo
       LEFT JOIN assets a ON wo.assetId = a.id
       LEFT JOIN users u1 ON wo.reportedById = u1.id
       LEFT JOIN users u2 ON wo.supervisorId = u2.id
       LEFT JOIN users u3 ON wo.assignedToId = u3.id
       ${where} ORDER BY wo.createdAt DESC LIMIT ? OFFSET ?`, params);
        return { data: formatRows(dataResult), total };
    }
    async getById(id) {
        const db = await (0, connection_1.getDb)();
        const woResult = db.exec(`SELECT wo.*, a.assetName, a.assetCode, u1.name as reportedByName, u2.name as supervisorName, u3.name as assignedToName
       FROM work_orders wo
       LEFT JOIN assets a ON wo.assetId = a.id
       LEFT JOIN users u1 ON wo.reportedById = u1.id
       LEFT JOIN users u2 ON wo.supervisorId = u2.id
       LEFT JOIN users u3 ON wo.assignedToId = u3.id
       WHERE wo.id = ?`, [id]);
        const wo = formatRow(woResult);
        if (!wo)
            throw new errors_1.NotFoundError('Work Order not found');
        const histResult = db.exec(`SELECT h.*, u.name as changedByName FROM work_order_status_history h
       LEFT JOIN users u ON h.changedBy = u.id WHERE h.woId = ? ORDER BY h.createdAt ASC`, [id]);
        wo.statusHistory = formatRows(histResult);
        const clResult = db.exec(`SELECT c.*, u.name as completedByName FROM work_order_checklists c
       LEFT JOIN users u ON c.completedBy = u.id WHERE c.woId = ? ORDER BY c.id`, [id]);
        wo.checklists = formatRows(clResult);
        const attResult = db.exec(`SELECT a.*, u.name as uploadedByName FROM work_order_attachments a
       LEFT JOIN users u ON a.uploadedBy = u.id WHERE a.woId = ? ORDER BY a.createdAt`, [id]);
        wo.attachments = formatRows(attResult);
        const spResult = db.exec(`SELECT wsp.*, sp.itemCode, sp.itemName FROM work_order_spare_parts wsp
       LEFT JOIN spare_parts sp ON wsp.itemId = sp.id WHERE wsp.woId = ?`, [id]);
        wo.spareParts = formatRows(spResult);
        return wo;
    }
    async update(id, data) {
        const db = await (0, connection_1.getDb)();
        await this.getById(id);
        const fields = [];
        const params = [];
        if (data.title !== undefined) {
            fields.push('title = ?');
            params.push(data.title);
        }
        if (data.description !== undefined) {
            fields.push('description = ?');
            params.push(data.description);
        }
        if (data.assetId !== undefined) {
            fields.push('assetId = ?');
            params.push(data.assetId);
        }
        if (data.location !== undefined) {
            fields.push('location = ?');
            params.push(data.location);
        }
        if (data.priority !== undefined) {
            fields.push('priority = ?');
            params.push(data.priority);
        }
        if (data.dueDate !== undefined) {
            fields.push('dueDate = ?');
            params.push(data.dueDate);
        }
        if (data.problemDescription !== undefined) {
            fields.push('problemDescription = ?');
            params.push(data.problemDescription);
        }
        if (data.repairInstruction !== undefined) {
            fields.push('repairInstruction = ?');
            params.push(data.repairInstruction);
        }
        if (data.workPerformed !== undefined) {
            fields.push('workPerformed = ?');
            params.push(data.workPerformed);
        }
        if (data.rootCause !== undefined) {
            fields.push('rootCause = ?');
            params.push(data.rootCause);
        }
        if (data.resolution !== undefined) {
            fields.push('resolution = ?');
            params.push(data.resolution);
        }
        if (data.notes !== undefined) {
            fields.push('notes = ?');
            params.push(data.notes);
        }
        if (fields.length > 0) {
            params.push(id);
            db.run(`UPDATE work_orders SET ${fields.join(', ')} WHERE id = ?`, params);
            (0, connection_1.saveDb)();
        }
        return this.getById(id);
    }
    async remove(id) {
        const db = await (0, connection_1.getDb)();
        db.run('DELETE FROM work_orders WHERE id = ?', [id]);
        (0, connection_1.saveDb)();
    }
    async create(data, userId) {
        const db = await (0, connection_1.getDb)();
        const id = (0, utils_1.generateId)();
        const countResult = db.exec("SELECT COUNT(*) as count FROM work_orders WHERE woNumber LIKE ?", [`WO-${new Date().getFullYear()}%`]);
        const woNumber = (0, utils_1.generateWoNumber)(countResult[0]?.values[0]?.[0] || 0);
        const now = (0, utils_1.nowISO)();
        db.run(`INSERT INTO work_orders (id, woNumber, title, description, assetId, location, reportedById, priority, status, dueDate, problemDescription, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?)`, [id, woNumber, data.title, data.description || null, data.assetId || null, data.location || null,
            userId, data.priority || 'MEDIUM', data.dueDate || null, data.problemDescription || null, now]);
        db.run("INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes) VALUES (?, ?, NULL, 'OPEN', ?, 'Work Order created')", [(0, utils_1.generateId)(), id, userId]);
        const supervisorsResult = db.exec("SELECT ur.userId FROM user_roles ur JOIN roles r ON ur.roleId = r.id WHERE r.name = 'SUPERVISOR'");
        const supervisors = formatRows(supervisorsResult);
        for (const row of supervisors) {
            db.run("INSERT INTO notifications (id, userId, type, title, message, referenceType, referenceId) VALUES (?, ?, 'NEW_WO', ?, ?, 'WORK_ORDER', ?)", [(0, utils_1.generateId)(), row.userId, `New Work Order: ${woNumber}`, `${data.title} has been reported`, id]);
        }
        (0, connection_1.saveDb)();
        return this.getById(id);
    }
    async assign(id, data, supervisorId) {
        const db = await (0, connection_1.getDb)();
        const wo = await this.getById(id);
        const isReassign = wo.status === 'ASSIGNED';
        if (!isReassign) {
            this.validateTransition(wo.status, 'ASSIGNED');
        }
        const now = (0, utils_1.nowISO)();
        db.run("UPDATE work_orders SET assignedToId = ?, supervisorId = ?, repairInstruction = ?, dueDate = COALESCE(?, dueDate), assignedAt = ?, status = 'ASSIGNED' WHERE id = ?", [data.assignedToId, supervisorId, data.repairInstruction || null, data.dueDate || null, now, id]);
        db.run("INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes) VALUES (?, ?, ?, 'ASSIGNED', ?, ?)", [(0, utils_1.generateId)(), id, wo.status, supervisorId, data.notes || 'Work Order assigned']);
        db.run("INSERT INTO notifications (id, userId, type, title, message, referenceType, referenceId) VALUES (?, ?, 'WO_ASSIGNED', ?, ?, 'WORK_ORDER', ?)", [(0, utils_1.generateId)(), data.assignedToId, `Work Order Assigned: ${wo.woNumber}`, `${wo.title} has been assigned to you`, id]);
        (0, connection_1.saveDb)();
        return this.getById(id);
    }
    async start(id, userId) {
        const db = await (0, connection_1.getDb)();
        const wo = await this.getById(id);
        this.validateTransition(wo.status, 'IN_PROGRESS');
        db.run("UPDATE work_orders SET status = 'IN_PROGRESS', startedAt = ? WHERE id = ?", [(0, utils_1.nowISO)(), id]);
        db.run("INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes) VALUES (?, ?, ?, 'IN_PROGRESS', ?, 'Work started')", [(0, utils_1.generateId)(), id, wo.status, userId]);
        (0, connection_1.saveDb)();
        return this.getById(id);
    }
    async hold(id, userId, notes) {
        const db = await (0, connection_1.getDb)();
        const wo = await this.getById(id);
        this.validateTransition(wo.status, 'ON_HOLD');
        db.run("UPDATE work_orders SET status = 'ON_HOLD' WHERE id = ?", [id]);
        db.run("INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes) VALUES (?, ?, ?, 'ON_HOLD', ?, ?)", [(0, utils_1.generateId)(), id, wo.status, userId, notes || 'Work on hold']);
        (0, connection_1.saveDb)();
        return this.getById(id);
    }
    async resume(id, userId) {
        const db = await (0, connection_1.getDb)();
        const wo = await this.getById(id);
        this.validateTransition(wo.status, 'IN_PROGRESS');
        db.run("UPDATE work_orders SET status = 'IN_PROGRESS' WHERE id = ?", [id]);
        db.run("INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes) VALUES (?, ?, ?, 'IN_PROGRESS', ?, 'Work resumed')", [(0, utils_1.generateId)(), id, wo.status, userId]);
        (0, connection_1.saveDb)();
        return this.getById(id);
    }
    async close(id, userId, data) {
        const db = await (0, connection_1.getDb)();
        const wo = await this.getById(id);
        this.validateTransition(wo.status, 'CLOSED');
        const incompleteChecklistsResult = db.exec("SELECT id, title FROM work_order_checklists WHERE woId = ? AND required = 1 AND completed = 0", [id]);
        const incompleteChecklists = formatRows(incompleteChecklistsResult);
        if (incompleteChecklists.length > 0) {
            throw new errors_1.BadRequestError(`Mandatory checklist items not completed: ${incompleteChecklists.map(r => r.title).join(', ')}`);
        }
        db.run("BEGIN");
        try {
            const now = (0, utils_1.nowISO)();
            const usedPartsResult = db.exec("SELECT id, itemId, usedQuantity, unitCost, unit FROM work_order_spare_parts WHERE woId = ? AND usedQuantity > 0", [id]);
            const usedParts = formatRows(usedPartsResult);
            for (const part of usedParts) {
                const spResult = db.exec("SELECT warehouseId FROM spare_parts WHERE id = ?", [part.itemId]);
                const spRow = formatRow(spResult);
                const warehouseId = spRow?.warehouseId;
                if (warehouseId && part.usedQuantity > 0) {
                    db.run(`INSERT INTO inventory_transactions (id, itemId, warehouseId, transactionType, quantity, unitCost, referenceType, referenceId, notes, createdBy, createdAt)
             VALUES (?, ?, ?, 'OUT', ?, ?, 'WORK_ORDER', ?, ?, ?, ?)`, [(0, utils_1.generateId)(), part.itemId, warehouseId, part.usedQuantity, part.unitCost || 0, id, `WO ${wo.woNumber} spare part usage`, userId, now]);
                    db.run("UPDATE spare_parts SET currentStock = currentStock - ? WHERE id = ?", [part.usedQuantity, part.itemId]);
                    const spDataResult = db.exec("SELECT currentStock, minimumStock, itemCode, itemName, unit, warehouseId FROM spare_parts WHERE id = ?", [part.itemId]);
                    const spData = formatRow(spDataResult);
                    if (spData) {
                        if (spData.currentStock <= spData.minimumStock && spData.minimumStock > 0) {
                            const adminsResult = db.exec("SELECT ur.userId FROM user_roles ur JOIN roles r ON ur.roleId = r.id WHERE r.name = 'ADMIN'");
                            const admins = formatRows(adminsResult);
                            for (const adminRow of admins) {
                                db.run("INSERT INTO notifications (id, userId, type, title, message, referenceType, referenceId) VALUES (?, ?, 'LOW_STOCK', ?, ?, 'SPARE_PART', ?)", [(0, utils_1.generateId)(), adminRow.userId, `Low Stock Alert: ${spData.itemName}`, `Stock for ${spData.itemCode} is below minimum (${spData.currentStock}/${spData.minimumStock})`, part.itemId]);
                            }
                            db.run(`INSERT INTO purchase_requisitions (id, itemId, quantity, unit, reason, currentStock, minimumStock, status, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`, [(0, utils_1.generateId)(), part.itemId, spData.minimumStock * 2 - spData.currentStock, spData.unit || 'PCS',
                                'Auto-generated from low stock alert', spData.currentStock, spData.minimumStock, now]);
                        }
                    }
                }
                db.run("UPDATE work_order_spare_parts SET totalCost = usedQuantity * unitCost WHERE id = ?", [part.id]);
            }
            db.run("UPDATE work_orders SET status = 'CLOSED', closedAt = ?, completedAt = ?, workPerformed = ?, rootCause = ?, resolution = ?, notes = COALESCE(?, notes) WHERE id = ?", [now, now, data.workPerformed || null, data.rootCause || null, data.resolution || null, data.notes || null, id]);
            db.run("INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes) VALUES (?, ?, ?, 'CLOSED', ?, ?)", [(0, utils_1.generateId)(), id, wo.status, userId, data.notes || 'Work Order closed']);
            db.run(`INSERT INTO integration_jobs (id, type, provider, referenceType, referenceId, payload, status, idempotencyKey, createdAt)
         VALUES (?, 'WO_CLOSE', 'zahir', 'WORK_ORDER', ?, ?, 'PENDING', ?, ?)`, [(0, utils_1.generateId)(), id, JSON.stringify({ woId: id, woNumber: wo.woNumber }), `CMMS-WO-${id}-CLOSE`, now]);
            db.run("INSERT INTO audit_logs (id, userId, action, entity, entityId, newValue, createdAt) VALUES (?, ?, 'CLOSE', 'WORK_ORDER', ?, ?, ?)", [(0, utils_1.generateId)(), userId, id, JSON.stringify({ status: 'CLOSED', workPerformed: data.workPerformed }), now]);
            db.run("INSERT INTO notifications (id, userId, type, title, message, referenceType, referenceId) VALUES (?, ?, 'WO_CLOSED', ?, ?, 'WORK_ORDER', ?)", [(0, utils_1.generateId)(), wo.reportedById, `Work Order Closed: ${wo.woNumber}`, `${wo.title} has been completed`, id]);
            db.run("COMMIT");
            (0, connection_1.saveDb)();
        }
        catch (e) {
            db.run("ROLLBACK");
            throw e;
        }
        return this.getById(id);
    }
    validateTransition(currentStatus, newStatus) {
        const allowed = VALID_TRANSITIONS[currentStatus];
        if (!allowed || !allowed.includes(newStatus)) {
            throw new errors_1.BadRequestError(`Cannot transition from ${currentStatus} to ${newStatus}`);
        }
    }
    async addChecklist(woId, data) {
        const db = await (0, connection_1.getDb)();
        const id = (0, utils_1.generateId)();
        const title = data.title || data.description || 'Untitled';
        db.run("INSERT INTO work_order_checklists (id, woId, title, description, required) VALUES (?, ?, ?, ?, ?)", [id, woId, title, data.description || null, data.required !== false ? 1 : 0]);
        (0, connection_1.saveDb)();
        return { id, woId, title, description: data.description || null, required: data.required !== false, completed: false };
    }
    async updateChecklist(woId, checklistId, data, userId) {
        const db = await (0, connection_1.getDb)();
        const existingResult = db.exec("SELECT id FROM work_order_checklists WHERE id = ? AND woId = ?", [checklistId, woId]);
        const existing = formatRow(existingResult);
        if (!existing) {
            throw new errors_1.NotFoundError('Checklist item not found');
        }
        const isCompleted = data.isCompleted !== undefined ? data.isCompleted : data.completed;
        const now = (0, utils_1.nowISO)();
        if (isCompleted) {
            db.run("UPDATE work_order_checklists SET completed = 1, completedBy = ?, completedAt = ?, notes = COALESCE(?, notes) WHERE id = ? AND woId = ?", [userId, now, data.notes || null, checklistId, woId]);
        }
        else {
            db.run("UPDATE work_order_checklists SET completed = 0, completedBy = NULL, completedAt = NULL, notes = COALESCE(?, notes) WHERE id = ? AND woId = ?", [data.notes || null, checklistId, woId]);
        }
        const result = db.exec("SELECT * FROM work_order_checklists WHERE id = ?", [checklistId]);
        const row = formatRow(result);
        if (!row)
            throw new errors_1.NotFoundError('Checklist item not found');
        (0, connection_1.saveDb)();
        return row;
    }
    async addAttachment(woId, file, userId) {
        const db = await (0, connection_1.getDb)();
        const id = (0, utils_1.generateId)();
        const now = (0, utils_1.nowISO)();
        db.run("INSERT INTO work_order_attachments (id, woId, filename, originalName, mimeType, path, size, uploadedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, woId, file.filename, file.originalname, file.mimetype, file.path, file.size, userId, now]);
        (0, connection_1.saveDb)();
        return { id, woId, filename: file.filename, originalName: file.originalname };
    }
    async addSparePart(woId, data) {
        const db = await (0, connection_1.getDb)();
        const id = (0, utils_1.generateId)();
        db.run("INSERT INTO work_order_spare_parts (id, woId, itemId, plannedQuantity, unit, unitCost, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)", [id, woId, data.itemId, data.plannedQuantity || 0, data.unit || 'PCS', data.unitCost || 0, (0, utils_1.nowISO)()]);
        const result = db.exec("SELECT wsp.*, sp.itemCode, sp.itemName FROM work_order_spare_parts wsp LEFT JOIN spare_parts sp ON wsp.itemId = sp.id WHERE wsp.id = ?", [id]);
        (0, connection_1.saveDb)();
        return formatRow(result);
    }
    async updateSparePart(woId, sparePartId, data) {
        const db = await (0, connection_1.getDb)();
        const existingResult = db.exec("SELECT id FROM work_order_spare_parts WHERE id = ? AND woId = ?", [sparePartId, woId]);
        const existing = formatRow(existingResult);
        if (!existing) {
            throw new errors_1.NotFoundError('Spare part not found');
        }
        if (data.usedQuantity !== undefined) {
            db.run("UPDATE work_order_spare_parts SET usedQuantity = ?, totalCost = ? * unitCost WHERE id = ? AND woId = ?", [data.usedQuantity, data.usedQuantity, sparePartId, woId]);
        }
        if (data.plannedQuantity !== undefined) {
            db.run("UPDATE work_order_spare_parts SET plannedQuantity = ? WHERE id = ? AND woId = ?", [data.plannedQuantity, sparePartId, woId]);
        }
        const result = db.exec("SELECT wsp.*, sp.itemCode, sp.itemName FROM work_order_spare_parts wsp LEFT JOIN spare_parts sp ON wsp.itemId = sp.id WHERE wsp.id = ?", [sparePartId]);
        (0, connection_1.saveDb)();
        return formatRow(result);
    }
}
exports.WorkOrderService = WorkOrderService;
exports.workOrderService = new WorkOrderService();
