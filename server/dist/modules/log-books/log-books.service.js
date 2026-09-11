"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listLogBooks = listLogBooks;
exports.getLogBookById = getLogBookById;
exports.createLogBook = createLogBook;
exports.updateLogBook = updateLogBook;
exports.deleteLogBook = deleteLogBook;
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
async function listLogBooks(page = 1, limit = 20, userId, startDate, endDate, search) {
    const db = await (0, connection_1.getDb)();
    const { offset, limit: lim } = (0, utils_1.paginate)(page, limit);
    let whereClause = 'WHERE 1=1';
    const params = [];
    if (userId) {
        whereClause += ' AND lb.userId = ?';
        params.push(userId);
    }
    if (startDate) {
        whereClause += ' AND lb.workDate >= ?';
        params.push(startDate);
    }
    if (endDate) {
        whereClause += ' AND lb.workDate <= ?';
        params.push(endDate);
    }
    if (search) {
        whereClause += ' AND (lb.description LIKE ? OR lb.location LIKE ? OR EXISTS (SELECT 1 FROM log_book_items lbi WHERE lbi.logBookId = lb.id AND lbi.description LIKE ?))';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const countResult = db.exec(`SELECT COUNT(*) as c FROM log_books lb ${whereClause}`, params);
    const total = countResult[0]?.values[0]?.[0] || 0;
    const dataResult = db.exec(`SELECT lb.*, u.name as userName
     FROM log_books lb
     LEFT JOIN users u ON lb.userId = u.id
     ${whereClause}
     ORDER BY lb.workDate DESC, lb.createdAt DESC
     LIMIT ? OFFSET ?`, [...params, lim, offset]);
    const logs = formatRows(dataResult);
    for (const log of logs) {
        log.items = formatRows(db.exec('SELECT * FROM log_book_items WHERE logBookId = ? ORDER BY createdAt ASC', [log.id]));
        log.spareParts = formatRows(db.exec(`SELECT lbs.*, sp.itemCode, sp.itemName, sp.unit
       FROM log_book_spare_parts lbs
       LEFT JOIN spare_parts sp ON lbs.sparePartId = sp.id
       WHERE lbs.logBookId = ?`, [log.id]));
    }
    return { data: logs, total, page, limit: lim, totalPages: Math.ceil(total / lim) };
}
async function getLogBookById(id) {
    const db = await (0, connection_1.getDb)();
    const result = db.exec(`SELECT lb.*, u.name as userName
     FROM log_books lb
     LEFT JOIN users u ON lb.userId = u.id
     WHERE lb.id = ?`, [id]);
    const log = formatRow(result);
    if (!log)
        throw new errors_1.NotFoundError('Log book not found');
    log.items = formatRows(db.exec('SELECT * FROM log_book_items WHERE logBookId = ? ORDER BY createdAt ASC', [id]));
    log.spareParts = formatRows(db.exec(`SELECT lbs.*, sp.itemCode, sp.itemName, sp.unit
     FROM log_book_spare_parts lbs
     LEFT JOIN spare_parts sp ON lbs.sparePartId = sp.id
     WHERE lbs.logBookId = ?`, [id]));
    return log;
}
async function createLogBook(data) {
    const db = await (0, connection_1.getDb)();
    const id = (0, utils_1.generateId)();
    const now = (0, utils_1.nowISO)();
    db.run('BEGIN');
    try {
        db.run(`INSERT INTO log_books (id, userId, workDate, location, description, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`, [id, data.userId, data.workDate, data.location || null,
            data.description || null, now, now]);
        for (const item of data.items) {
            const itemId = (0, utils_1.generateId)();
            db.run(`INSERT INTO log_book_items (id, logBookId, description, activityType, location, assetId, workOrderNo, durationMinutes, notes, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [itemId, id, item.description, item.activityType || 'CORRECTIVE',
                item.location || null, item.assetId || null, item.workOrderNo || null,
                item.durationMinutes || null, item.notes || null, now]);
            if (item.spareParts && item.spareParts.length > 0) {
                for (const sp of item.spareParts) {
                    if (!sp.sparePartId || !sp.quantity || sp.quantity <= 0)
                        continue;
                    const itemResult = db.exec('SELECT id, currentStock, warehouseId FROM spare_parts WHERE id = ?', [sp.sparePartId]);
                    const spData = formatRow(itemResult);
                    if (!spData)
                        throw new errors_1.NotFoundError(`Spare part ${sp.sparePartId} not found`);
                    if (spData.currentStock < sp.quantity) {
                        throw new errors_1.BadRequestError(`Insufficient stock for ${sp.sparePartId}. Available: ${spData.currentStock}, requested: ${sp.quantity}`);
                    }
                    const spId = (0, utils_1.generateId)();
                    db.run(`INSERT INTO log_book_spare_parts (id, logBookId, logBookItemId, sparePartId, quantity, unitCost, notes, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [spId, id, itemId, sp.sparePartId, sp.quantity, sp.unitCost || 0, sp.notes || null, now]);
                    db.run(`UPDATE spare_parts SET currentStock = currentStock - ?, updatedAt = ? WHERE id = ?`, [sp.quantity, now, sp.sparePartId]);
                    const txnId = (0, utils_1.generateId)();
                    db.run(`INSERT INTO inventory_transactions (id, itemId, warehouseId, transactionType, quantity, unitCost, referenceType, referenceId, notes, createdBy, createdAt)
             VALUES (?, ?, ?, 'OUT', ?, ?, 'LOG_BOOK', ?, ?, ?, ?)`, [txnId, sp.sparePartId, spData.warehouseId, sp.quantity, sp.unitCost || 0, id,
                        sp.notes || `Log book: ${item.description}`, data.userId, now]);
                }
            }
        }
        db.run('COMMIT');
        (0, connection_1.saveDb)();
        return await getLogBookById(id);
    }
    catch (e) {
        db.run('ROLLBACK');
        throw e;
    }
}
async function updateLogBook(id, data) {
    const db = await (0, connection_1.getDb)();
    const existing = formatRow(db.exec('SELECT * FROM log_books WHERE id = ?', [id]));
    if (!existing)
        throw new errors_1.NotFoundError('Log book not found');
    const now = (0, utils_1.nowISO)();
    const fields = [];
    const params = [];
    if (data.workDate !== undefined) {
        fields.push('workDate = ?');
        params.push(data.workDate);
    }
    if (data.location !== undefined) {
        fields.push('location = ?');
        params.push(data.location);
    }
    if (data.description !== undefined) {
        fields.push('description = ?');
        params.push(data.description);
    }
    if (fields.length > 0) {
        fields.push('updatedAt = ?');
        params.push(now);
        params.push(id);
        db.run(`UPDATE log_books SET ${fields.join(', ')} WHERE id = ?`, params);
    }
    if (data.items && Array.isArray(data.items)) {
        const oldSpares = formatRows(db.exec('SELECT * FROM log_book_spare_parts WHERE logBookId = ?', [id]));
        for (const sp of oldSpares) {
            db.run(`UPDATE spare_parts SET currentStock = currentStock + ?, updatedAt = ? WHERE id = ?`, [sp.quantity, now, sp.sparePartId]);
        }
        db.run('DELETE FROM log_book_spare_parts WHERE logBookId = ?', [id]);
        db.run('DELETE FROM log_book_items WHERE logBookId = ?', [id]);
        for (const item of data.items) {
            const itemId = generateUUID();
            db.run(`INSERT INTO log_book_items (id, logBookId, description, activityType, location, workOrderNo, durationMinutes, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [itemId, id, item.description, item.activityType || 'CORRECTIVE', item.location || data.location || '', item.workOrderNo || '', item.durationMinutes || 0, item.notes || '']);
            if (item.spareParts && Array.isArray(item.spareParts)) {
                for (const sp of item.spareParts) {
                    if (!sp.sparePartId || !sp.quantity)
                        continue;
                    const spId = generateUUID();
                    const part = formatRow(db.exec('SELECT * FROM spare_parts WHERE id = ?', [sp.sparePartId]));
                    db.run(`INSERT INTO log_book_spare_parts (id, logBookId, logBookItemId, sparePartId, quantity, unitCost, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`, [spId, id, itemId, sp.sparePartId, sp.quantity, sp.unitCost || (part?.unitCost ?? 0), sp.notes || '']);
                    db.run(`UPDATE spare_parts SET currentStock = currentStock - ?, updatedAt = ? WHERE id = ?`, [sp.quantity, now, sp.sparePartId]);
                }
            }
        }
    }
    (0, connection_1.saveDb)();
    return await getLogBookById(id);
}
async function deleteLogBook(id) {
    const db = await (0, connection_1.getDb)();
    const existing = formatRow(db.exec('SELECT * FROM log_books WHERE id = ?', [id]));
    if (!existing)
        throw new errors_1.NotFoundError('Log book not found');
    db.run('BEGIN');
    try {
        const spItems = formatRows(db.exec('SELECT * FROM log_book_spare_parts WHERE logBookId = ?', [id]));
        for (const sp of spItems) {
            db.run(`UPDATE spare_parts SET currentStock = currentStock + ?, updatedAt = ? WHERE id = ?`, [sp.quantity, (0, utils_1.nowISO)(), sp.sparePartId]);
        }
        db.run('DELETE FROM log_book_spare_parts WHERE logBookId = ?', [id]);
        db.run('DELETE FROM log_book_items WHERE logBookId = ?', [id]);
        db.run('DELETE FROM log_books WHERE id = ?', [id]);
        db.run('COMMIT');
        (0, connection_1.saveDb)();
    }
    catch (e) {
        db.run('ROLLBACK');
        throw e;
    }
}
