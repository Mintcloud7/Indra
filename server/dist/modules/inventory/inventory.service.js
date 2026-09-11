"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSpareParts = listSpareParts;
exports.getSparePartById = getSparePartById;
exports.createSparePart = createSparePart;
exports.updateSparePart = updateSparePart;
exports.listWarehouses = listWarehouses;
exports.createWarehouse = createWarehouse;
exports.updateWarehouse = updateWarehouse;
exports.deleteWarehouse = deleteWarehouse;
exports.listTransactions = listTransactions;
exports.updateStock = updateStock;
exports.stockIn = stockIn;
exports.stockOut = stockOut;
exports.adjustment = adjustment;
exports.returnStock = returnStock;
exports.getLowStockItems = getLowStockItems;
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
// ─── Spare Parts ─────────────────────────────────────────────────────────────
async function listSpareParts(page = 1, limit = 20, search, category, warehouseId) {
    const { offset, limit: lim } = (0, utils_1.paginate)(page, limit);
    const db = await (0, connection_1.getDb)();
    let whereClause = 'WHERE 1=1';
    const params = [];
    if (search) {
        whereClause += ` AND (sp.itemCode LIKE ? OR sp.itemName LIKE ?)`;
        const term = `%${search}%`;
        params.push(term, term);
    }
    if (category) {
        whereClause += ` AND sp.category = ?`;
        params.push(category);
    }
    if (warehouseId) {
        whereClause += ` AND sp.warehouseId = ?`;
        params.push(warehouseId);
    }
    const countResult = db.exec(`SELECT COUNT(*) as total FROM spare_parts sp ${whereClause}`, params);
    const total = countResult[0]?.values[0]?.[0] || 0;
    params.push(lim, offset);
    const dataResult = db.exec(`SELECT sp.*, w.name as warehouseName
     FROM spare_parts sp
     LEFT JOIN warehouses w ON sp.warehouseId = w.id
     ${whereClause}
     ORDER BY sp.createdAt DESC
     LIMIT ? OFFSET ?`, params);
    return { data: formatRows(dataResult), total };
}
async function getSparePartById(id) {
    const db = await (0, connection_1.getDb)();
    const result = db.exec(`SELECT sp.*, w.name as warehouseName
     FROM spare_parts sp
     LEFT JOIN warehouses w ON sp.warehouseId = w.id
     WHERE sp.id = ?`, [id]);
    const obj = formatRow(result);
    if (!obj) {
        throw new errors_1.NotFoundError('Spare part not found');
    }
    return obj;
}
async function createSparePart(data) {
    const db = await (0, connection_1.getDb)();
    const existingResult = db.exec('SELECT id FROM spare_parts WHERE itemCode = ?', [data.itemCode]);
    const existing = formatRow(existingResult);
    if (existing) {
        throw new errors_1.ConflictError('Item code already exists');
    }
    if (data.warehouseId) {
        const whResult = db.exec('SELECT id FROM warehouses WHERE id = ?', [data.warehouseId]);
        const wh = formatRow(whResult);
        if (!wh) {
            throw new errors_1.NotFoundError('Warehouse not found');
        }
    }
    const id = (0, utils_1.generateId)();
    const now = (0, utils_1.nowISO)();
    db.run(`INSERT INTO spare_parts (id, itemCode, itemName, category, specification, unit, warehouseId, stockLocation, currentStock, minimumStock, maximumStock, unitCost, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        id, data.itemCode, data.itemName,
        data.category || null, data.specification || null,
        data.unit || 'PCS', data.warehouseId || null,
        data.stockLocation || null,
        data.currentStock ?? 0, data.minimumStock ?? 0,
        data.maximumStock ?? 0, data.unitCost ?? 0,
        now, now
    ]);
    (0, connection_1.saveDb)();
    return getSparePartById(id);
}
async function updateSparePart(id, data) {
    const db = await (0, connection_1.getDb)();
    const existingResult = db.exec('SELECT * FROM spare_parts WHERE id = ?', [id]);
    const existing = formatRow(existingResult);
    if (!existing) {
        throw new errors_1.NotFoundError('Spare part not found');
    }
    if (data.itemCode) {
        const codeCheckResult = db.exec('SELECT id FROM spare_parts WHERE itemCode = ? AND id != ?', [data.itemCode, id]);
        const codeCheck = formatRow(codeCheckResult);
        if (codeCheck) {
            throw new errors_1.ConflictError('Item code already exists');
        }
    }
    if (data.warehouseId) {
        const whResult = db.exec('SELECT id FROM warehouses WHERE id = ?', [data.warehouseId]);
        const wh = formatRow(whResult);
        if (!wh) {
            throw new errors_1.NotFoundError('Warehouse not found');
        }
    }
    const fields = [];
    const params = [];
    const allowedFields = [
        'itemCode', 'itemName', 'category', 'specification', 'unit',
        'warehouseId', 'stockLocation', 'currentStock', 'minimumStock',
        'maximumStock', 'unitCost'
    ];
    for (const field of allowedFields) {
        if (data[field] !== undefined) {
            fields.push(`${field} = ?`);
            params.push(data[field]);
        }
    }
    if (fields.length === 0) {
        return getSparePartById(id);
    }
    fields.push('updatedAt = ?');
    params.push((0, utils_1.nowISO)());
    params.push(id);
    db.run(`UPDATE spare_parts SET ${fields.join(', ')} WHERE id = ?`, params);
    (0, connection_1.saveDb)();
    return getSparePartById(id);
}
// ─── Warehouses ──────────────────────────────────────────────────────────────
async function listWarehouses() {
    const db = await (0, connection_1.getDb)();
    const result = db.exec('SELECT * FROM warehouses ORDER BY name ASC');
    return formatRows(result);
}
async function createWarehouse(data) {
    const db = await (0, connection_1.getDb)();
    const existingResult = db.exec('SELECT id FROM warehouses WHERE name = ?', [data.name]);
    const existing = formatRow(existingResult);
    if (existing) {
        throw new errors_1.ConflictError('Warehouse name already exists');
    }
    const id = (0, utils_1.generateId)();
    const now = (0, utils_1.nowISO)();
    db.run(`INSERT INTO warehouses (id, name, location, description, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`, [id, data.name, data.location || null, data.description || null, now, now]);
    (0, connection_1.saveDb)();
    const result = db.exec('SELECT * FROM warehouses WHERE id = ?', [id]);
    return formatRow(result);
}
async function updateWarehouse(id, data) {
    const db = await (0, connection_1.getDb)();
    const existingResult = db.exec('SELECT * FROM warehouses WHERE id = ?', [id]);
    const existing = formatRow(existingResult);
    if (!existing) {
        throw new errors_1.NotFoundError('Warehouse not found');
    }
    if (data.name && data.name !== existing.name) {
        const nameCheck = db.exec('SELECT id FROM warehouses WHERE name = ? AND id != ?', [data.name, id]);
        const nameExists = formatRow(nameCheck);
        if (nameExists)
            throw new errors_1.ConflictError('Warehouse name already exists');
    }
    const now = (0, utils_1.nowISO)();
    const fields = [];
    const params = [];
    if (data.name !== undefined) {
        fields.push('name = ?');
        params.push(data.name);
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
        db.run(`UPDATE warehouses SET ${fields.join(', ')} WHERE id = ?`, params);
    }
    (0, connection_1.saveDb)();
    const result = db.exec('SELECT * FROM warehouses WHERE id = ?', [id]);
    return formatRow(result);
}
async function deleteWarehouse(id) {
    const db = await (0, connection_1.getDb)();
    const existingResult = db.exec('SELECT * FROM warehouses WHERE id = ?', [id]);
    const existing = formatRow(existingResult);
    if (!existing) {
        throw new errors_1.NotFoundError('Warehouse not found');
    }
    const sparePartsResult = db.exec('SELECT COUNT(*) as c FROM spare_parts WHERE warehouseId = ?', [id]);
    const sparePartsCount = sparePartsResult[0]?.values[0]?.[0] || 0;
    if (sparePartsCount > 0) {
        throw new errors_1.ConflictError('Cannot delete warehouse with existing spare parts');
    }
    db.run('DELETE FROM warehouses WHERE id = ?', [id]);
    (0, connection_1.saveDb)();
}
// ─── Transactions ────────────────────────────────────────────────────────────
async function listTransactions(page = 1, limit = 20, itemId, warehouseId, transactionType, startDate, endDate) {
    const { offset, limit: lim } = (0, utils_1.paginate)(page, limit);
    const db = await (0, connection_1.getDb)();
    let whereClause = 'WHERE 1=1';
    const params = [];
    if (itemId) {
        whereClause += ` AND it.itemId = ?`;
        params.push(itemId);
    }
    if (warehouseId) {
        whereClause += ` AND it.warehouseId = ?`;
        params.push(warehouseId);
    }
    if (transactionType) {
        whereClause += ` AND it.transactionType = ?`;
        params.push(transactionType);
    }
    if (startDate) {
        whereClause += ` AND it.createdAt >= ?`;
        params.push(startDate);
    }
    if (endDate) {
        whereClause += ` AND it.createdAt <= ?`;
        params.push(endDate);
    }
    const countResult = db.exec(`SELECT COUNT(*) as total FROM inventory_transactions it ${whereClause}`, params);
    const total = countResult[0]?.values[0]?.[0] || 0;
    params.push(lim, offset);
    const dataResult = db.exec(`SELECT it.*, sp.itemCode, sp.itemName, w.name as warehouseName, u.name as createdByName
     FROM inventory_transactions it
     LEFT JOIN spare_parts sp ON it.itemId = sp.id
     LEFT JOIN warehouses w ON it.warehouseId = w.id
     LEFT JOIN users u ON it.createdBy = u.id
     ${whereClause}
     ORDER BY it.createdAt DESC
     LIMIT ? OFFSET ?`, params);
    return { data: formatRows(dataResult), total };
}
async function updateStock(itemId, delta) {
    const db = await (0, connection_1.getDb)();
    db.run(`UPDATE spare_parts SET currentStock = currentStock + ?, updatedAt = ? WHERE id = ?`, [delta, (0, utils_1.nowISO)(), itemId]);
    (0, connection_1.saveDb)();
}
async function stockIn(itemId, warehouseId, quantity, unitCost, notes, createdBy) {
    const db = await (0, connection_1.getDb)();
    const itemResult = db.exec('SELECT id FROM spare_parts WHERE id = ?', [itemId]);
    const item = formatRow(itemResult);
    if (!item) {
        throw new errors_1.NotFoundError('Spare part not found');
    }
    const whResult = db.exec('SELECT id FROM warehouses WHERE id = ?', [warehouseId]);
    const wh = formatRow(whResult);
    if (!wh) {
        throw new errors_1.NotFoundError('Warehouse not found');
    }
    db.run("BEGIN");
    try {
        const id = (0, utils_1.generateId)();
        const now = (0, utils_1.nowISO)();
        db.run(`INSERT INTO inventory_transactions (id, itemId, warehouseId, transactionType, quantity, unitCost, notes, createdBy, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, itemId, warehouseId, 'IN', quantity, unitCost, notes || null, createdBy, now]);
        db.run(`UPDATE spare_parts SET currentStock = currentStock + ?, unitCost = ?, updatedAt = ? WHERE id = ?`, [quantity, unitCost, now, itemId]);
        db.run("COMMIT");
        (0, connection_1.saveDb)();
        const result = db.exec('SELECT * FROM inventory_transactions WHERE id = ?', [id]);
        return formatRow(result);
    }
    catch (e) {
        db.run("ROLLBACK");
        throw e;
    }
}
async function stockOut(itemId, warehouseId, quantity, unitCost, referenceType, referenceId, notes, createdBy) {
    const db = await (0, connection_1.getDb)();
    const itemResult = db.exec('SELECT id, currentStock FROM spare_parts WHERE id = ?', [itemId]);
    const item = formatRow(itemResult);
    if (!item) {
        throw new errors_1.NotFoundError('Spare part not found');
    }
    if (item.currentStock < quantity) {
        throw new errors_1.BadRequestError(`Insufficient stock. Available: ${item.currentStock}, requested: ${quantity}`);
    }
    const whResult = db.exec('SELECT id FROM warehouses WHERE id = ?', [warehouseId]);
    const wh = formatRow(whResult);
    if (!wh) {
        throw new errors_1.NotFoundError('Warehouse not found');
    }
    db.run("BEGIN");
    try {
        const id = (0, utils_1.generateId)();
        const now = (0, utils_1.nowISO)();
        db.run(`INSERT INTO inventory_transactions (id, itemId, warehouseId, transactionType, quantity, unitCost, referenceType, referenceId, notes, createdBy, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, itemId, warehouseId, 'OUT', quantity, unitCost, referenceType || null, referenceId || null, notes || null, createdBy, now]);
        db.run(`UPDATE spare_parts SET currentStock = currentStock - ?, updatedAt = ? WHERE id = ?`, [quantity, now, itemId]);
        db.run("COMMIT");
        (0, connection_1.saveDb)();
        const result = db.exec('SELECT * FROM inventory_transactions WHERE id = ?', [id]);
        return formatRow(result);
    }
    catch (e) {
        db.run("ROLLBACK");
        throw e;
    }
}
async function adjustment(itemId, warehouseId, quantity, unitCost, notes, createdBy) {
    const db = await (0, connection_1.getDb)();
    const itemResult = db.exec('SELECT id FROM spare_parts WHERE id = ?', [itemId]);
    const item = formatRow(itemResult);
    if (!item) {
        throw new errors_1.NotFoundError('Spare part not found');
    }
    const whResult = db.exec('SELECT id FROM warehouses WHERE id = ?', [warehouseId]);
    const wh = formatRow(whResult);
    if (!wh) {
        throw new errors_1.NotFoundError('Warehouse not found');
    }
    db.run("BEGIN");
    try {
        const id = (0, utils_1.generateId)();
        const now = (0, utils_1.nowISO)();
        db.run(`INSERT INTO inventory_transactions (id, itemId, warehouseId, transactionType, quantity, unitCost, notes, createdBy, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, itemId, warehouseId, 'ADJUSTMENT', quantity, unitCost, notes || null, createdBy, now]);
        db.run(`UPDATE spare_parts SET currentStock = currentStock + ?, unitCost = ?, updatedAt = ? WHERE id = ?`, [quantity, unitCost, now, itemId]);
        db.run("COMMIT");
        (0, connection_1.saveDb)();
        const result = db.exec('SELECT * FROM inventory_transactions WHERE id = ?', [id]);
        return formatRow(result);
    }
    catch (e) {
        db.run("ROLLBACK");
        throw e;
    }
}
async function returnStock(itemId, warehouseId, quantity, unitCost, notes, createdBy) {
    const db = await (0, connection_1.getDb)();
    const itemResult = db.exec('SELECT id FROM spare_parts WHERE id = ?', [itemId]);
    const item = formatRow(itemResult);
    if (!item) {
        throw new errors_1.NotFoundError('Spare part not found');
    }
    const whResult = db.exec('SELECT id FROM warehouses WHERE id = ?', [warehouseId]);
    const wh = formatRow(whResult);
    if (!wh) {
        throw new errors_1.NotFoundError('Warehouse not found');
    }
    db.run("BEGIN");
    try {
        const id = (0, utils_1.generateId)();
        const now = (0, utils_1.nowISO)();
        db.run(`INSERT INTO inventory_transactions (id, itemId, warehouseId, transactionType, quantity, unitCost, notes, createdBy, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, itemId, warehouseId, 'RETURN', quantity, unitCost, notes || null, createdBy, now]);
        db.run(`UPDATE spare_parts SET currentStock = currentStock + ?, unitCost = ?, updatedAt = ? WHERE id = ?`, [quantity, unitCost, now, itemId]);
        db.run("COMMIT");
        (0, connection_1.saveDb)();
        const result = db.exec('SELECT * FROM inventory_transactions WHERE id = ?', [id]);
        return formatRow(result);
    }
    catch (e) {
        db.run("ROLLBACK");
        throw e;
    }
}
async function getLowStockItems() {
    const db = await (0, connection_1.getDb)();
    const result = db.exec(`SELECT sp.*, w.name as warehouseName
     FROM spare_parts sp
     LEFT JOIN warehouses w ON sp.warehouseId = w.id
     WHERE sp.currentStock <= sp.minimumStock
     ORDER BY sp.currentStock ASC`);
    return formatRows(result);
}
