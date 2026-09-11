"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = list;
exports.getById = getById;
exports.create = create;
exports.update = update;
exports.remove = remove;
exports.getDocuments = getDocuments;
exports.createDocument = createDocument;
exports.getMeters = getMeters;
exports.createMeter = createMeter;
exports.addMeterReading = addMeterReading;
exports.getHistory = getHistory;
exports.getWorkOrders = getWorkOrders;
exports.getPreventiveMaintenance = getPreventiveMaintenance;
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
async function list(page = 1, limit = 20, search, assetType, status) {
    const { offset, limit: lim } = (0, utils_1.paginate)(page, limit);
    const db = await (0, connection_1.getDb)();
    let whereClause = 'WHERE 1=1';
    const params = [];
    if (search) {
        whereClause += ' AND (assetCode LIKE ? OR assetName LIKE ? OR location LIKE ?)';
        const term = `%${search}%`;
        params.push(term, term, term);
    }
    if (assetType) {
        whereClause += ' AND assetType = ?';
        params.push(assetType);
    }
    if (status) {
        whereClause += ' AND status = ?';
        params.push(status);
    }
    const countResult = db.exec(`SELECT COUNT(*) as total FROM assets ${whereClause}`, params);
    const total = countResult[0]?.values[0]?.[0] || 0;
    params.push(lim, offset);
    const dataResult = db.exec(`SELECT * FROM assets ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`, params);
    return { data: formatRows(dataResult), total };
}
async function getById(id) {
    const db = await (0, connection_1.getDb)();
    const result = db.exec('SELECT * FROM assets WHERE id = ?', [id]);
    const asset = formatRow(result);
    if (!asset) {
        throw new errors_1.NotFoundError('Asset not found');
    }
    const docsResult = db.exec('SELECT * FROM asset_documents WHERE assetId = ? ORDER BY uploadedAt DESC', [id]);
    asset.documents = formatRows(docsResult);
    const metersResult = db.exec('SELECT * FROM asset_meters WHERE assetId = ? ORDER BY createdAt DESC', [id]);
    asset.meters = formatRows(metersResult);
    return asset;
}
async function create(data) {
    const db = await (0, connection_1.getDb)();
    const existingResult = db.exec('SELECT id FROM assets WHERE assetCode = ?', [data.assetCode]);
    const existing = formatRow(existingResult);
    if (existing) {
        throw new errors_1.ConflictError('Asset code already exists');
    }
    const id = (0, utils_1.generateId)();
    const now = (0, utils_1.nowISO)();
    db.run(`INSERT INTO assets (id, assetCode, assetName, assetType, location, serialNumber, manufacturer, model, purchaseDate, warrantyStart, warrantyEnd, status, description, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        id, data.assetCode, data.assetName, data.assetType, data.location,
        data.serialNumber || null, data.manufacturer || null, data.model || null,
        data.purchaseDate || null, data.warrantyStart || null, data.warrantyEnd || null,
        data.status || 'ACTIVE', data.description || null, now, now
    ]);
    (0, connection_1.saveDb)();
    return getById(id);
}
async function update(id, data) {
    const db = await (0, connection_1.getDb)();
    const existingResult = db.exec('SELECT * FROM assets WHERE id = ?', [id]);
    const existing = formatRow(existingResult);
    if (!existing) {
        throw new errors_1.NotFoundError('Asset not found');
    }
    if (data.assetCode) {
        const codeCheckResult = db.exec('SELECT id FROM assets WHERE assetCode = ? AND id != ?', [data.assetCode, id]);
        const codeCheck = formatRow(codeCheckResult);
        if (codeCheck) {
            throw new errors_1.ConflictError('Asset code already exists');
        }
    }
    const oldValue = { ...existing };
    const fields = [];
    const params = [];
    const allowedFields = [
        'assetCode', 'assetName', 'assetType', 'location', 'serialNumber',
        'manufacturer', 'model', 'purchaseDate', 'warrantyStart', 'warrantyEnd',
        'status', 'description'
    ];
    for (const field of allowedFields) {
        if (data[field] !== undefined) {
            fields.push(`${field} = ?`);
            params.push(data[field]);
        }
    }
    if (fields.length === 0) {
        return { newValue: existing, oldValue, asset: existing };
    }
    fields.push('updatedAt = ?');
    params.push((0, utils_1.nowISO)());
    params.push(id);
    db.run(`UPDATE assets SET ${fields.join(', ')} WHERE id = ?`, params);
    const newValueResult = db.exec('SELECT * FROM assets WHERE id = ?', [id]);
    const newValue = formatRow(newValueResult);
    (0, connection_1.saveDb)();
    return { newValue, oldValue, asset: newValue };
}
async function remove(id) {
    const db = await (0, connection_1.getDb)();
    const existingResult = db.exec('SELECT * FROM assets WHERE id = ?', [id]);
    const existing = formatRow(existingResult);
    if (!existing) {
        throw new errors_1.NotFoundError('Asset not found');
    }
    db.run('DELETE FROM assets WHERE id = ?', [id]);
    (0, connection_1.saveDb)();
    return existing;
}
async function getDocuments(assetId) {
    const db = await (0, connection_1.getDb)();
    const assetResult = db.exec('SELECT id FROM assets WHERE id = ?', [assetId]);
    const asset = formatRow(assetResult);
    if (!asset) {
        throw new errors_1.NotFoundError('Asset not found');
    }
    const result = db.exec('SELECT * FROM asset_documents WHERE assetId = ? ORDER BY uploadedAt DESC', [assetId]);
    return formatRows(result);
}
async function createDocument(assetId, data, uploadedBy) {
    const db = await (0, connection_1.getDb)();
    const assetResult = db.exec('SELECT id FROM assets WHERE id = ?', [assetId]);
    const asset = formatRow(assetResult);
    if (!asset) {
        throw new errors_1.NotFoundError('Asset not found');
    }
    const id = (0, utils_1.generateId)();
    db.run(`INSERT INTO asset_documents (id, assetId, filename, type, path, size, uploadedBy, uploadedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [id, assetId, data.filename, data.type, data.path, data.size, uploadedBy, (0, utils_1.nowISO)()]);
    const result = db.exec('SELECT * FROM asset_documents WHERE id = ?', [id]);
    (0, connection_1.saveDb)();
    return formatRow(result);
}
async function getMeters(assetId) {
    const db = await (0, connection_1.getDb)();
    const assetResult = db.exec('SELECT id FROM assets WHERE id = ?', [assetId]);
    const asset = formatRow(assetResult);
    if (!asset) {
        throw new errors_1.NotFoundError('Asset not found');
    }
    const result = db.exec('SELECT * FROM asset_meters WHERE assetId = ? ORDER BY createdAt DESC', [assetId]);
    return formatRows(result);
}
async function createMeter(assetId, data) {
    const db = await (0, connection_1.getDb)();
    const assetResult = db.exec('SELECT id FROM assets WHERE id = ?', [assetId]);
    const asset = formatRow(assetResult);
    if (!asset) {
        throw new errors_1.NotFoundError('Asset not found');
    }
    const id = (0, utils_1.generateId)();
    db.run(`INSERT INTO asset_meters (id, assetId, meterType, unit, description, createdAt)
     VALUES (?, ?, ?, ?, ?, ?)`, [id, assetId, data.meterType, data.unit, data.description || null, (0, utils_1.nowISO)()]);
    const result = db.exec('SELECT * FROM asset_meters WHERE id = ?', [id]);
    (0, connection_1.saveDb)();
    return formatRow(result);
}
async function addMeterReading(meterId, assetId, value, recordedBy) {
    const db = await (0, connection_1.getDb)();
    const meterResult = db.exec('SELECT id FROM asset_meters WHERE id = ? AND assetId = ?', [meterId, assetId]);
    const meter = formatRow(meterResult);
    if (!meter) {
        throw new errors_1.NotFoundError('Meter not found for this asset');
    }
    const id = (0, utils_1.generateId)();
    db.run(`INSERT INTO asset_meter_readings (id, meterId, assetId, value, readingDate, recordedBy)
     VALUES (?, ?, ?, ?, ?, ?)`, [id, meterId, assetId, value, (0, utils_1.nowISO)(), recordedBy]);
    const result = db.exec('SELECT * FROM asset_meter_readings WHERE id = ?', [id]);
    (0, connection_1.saveDb)();
    return formatRow(result);
}
async function getHistory(assetId) {
    const db = await (0, connection_1.getDb)();
    const assetResult = db.exec('SELECT id FROM assets WHERE id = ?', [assetId]);
    const asset = formatRow(assetResult);
    if (!asset) {
        throw new errors_1.NotFoundError('Asset not found');
    }
    const result = db.exec(`SELECT wo.*, u.name as assignedToName, r.name as reporterName
     FROM work_orders wo
     LEFT JOIN users u ON wo.assignedToId = u.id
     LEFT JOIN users r ON wo.reportedById = r.id
     WHERE wo.assetId = ?
     ORDER BY wo.createdAt DESC`, [assetId]);
    return formatRows(result);
}
async function getWorkOrders(assetId) {
    const db = await (0, connection_1.getDb)();
    const result = db.exec(`SELECT wo.*, u.name as assignedToName
     FROM work_orders wo
     LEFT JOIN users u ON wo.assignedToId = u.id
     WHERE wo.assetId = ?
     ORDER BY wo.createdAt DESC`, [assetId]);
    return formatRows(result);
}
async function getPreventiveMaintenance(assetId) {
    const db = await (0, connection_1.getDb)();
    const result = db.exec(`SELECT pm.* FROM preventive_maintenance pm
     WHERE pm.assetId = ?
     ORDER BY pm.nextDueDate ASC`, [assetId]);
    return formatRows(result);
}
