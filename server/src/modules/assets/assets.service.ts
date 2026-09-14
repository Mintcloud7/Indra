import { getDb } from '../../database/connection';
import { generateId, nowISO, paginate } from '../../shared/utils';
import { NotFoundError, BadRequestError, ConflictError } from '../../shared/errors';

function formatRow(result: any, index: number = 0): any {
  if (!result[0] || !result[0].values[index]) return null;
  const obj: any = {};
  result[0].columns.forEach((col: string, i: number) => {
    obj[col] = result[0].values[index][i];
  });
  return obj;
}

function formatRows(result: any): any[] {
  if (!result[0]) return [];
  return result[0].values.map((row: any[]) => {
    const obj: any = {};
    result[0].columns.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

export async function list(
  page: number = 1,
  limit: number = 20,
  search?: string,
  assetType?: string,
  status?: string
) {
  const { offset, limit: lim } = paginate(page, limit);
  const db = await getDb();

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

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

  const [countResult, dataResult] = await (db as any).execBatch([
    { sql: `SELECT COUNT(*) as total FROM assets ${whereClause}`, params },
    { sql: `SELECT assetCode, assetName, assetType, location, status, createdAt FROM assets ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`, params: [...params, lim, offset] },
  ]);

  const total = (countResult?.values?.[0]?.[0] as number) || 0;

  return { data: formatRows([dataResult]), total };
}

export async function getById(id: string) {
  const db = await getDb();
  const result = await db.exec('SELECT * FROM assets WHERE id = ?', [id]);
  const asset = formatRow(result);
  if (!asset) {
    throw new NotFoundError('Asset not found');
  }

  const docsResult = await db.exec(
    'SELECT * FROM asset_documents WHERE assetId = ? ORDER BY uploadedAt DESC',
    [id]
  );
  asset.documents = formatRows(docsResult);

  const metersResult = await db.exec(
    'SELECT * FROM asset_meters WHERE assetId = ? ORDER BY createdAt DESC',
    [id]
  );
  asset.meters = formatRows(metersResult);

  return asset;
}

export async function create(data: {
  assetCode: string;
  assetName: string;
  assetType: string;
  location: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  purchaseDate?: string;
  warrantyStart?: string;
  warrantyEnd?: string;
  status?: string;
  description?: string;
}) {
  const db = await getDb();
  const existingResult = await db.exec('SELECT id FROM assets WHERE assetCode = ?', [data.assetCode]);
  const existing = formatRow(existingResult);
  if (existing) {
    throw new ConflictError('Asset code already exists');
  }

  const id = generateId();
  const now = nowISO();

  await db.run(
    `INSERT INTO assets (id, assetCode, assetName, assetType, location, serialNumber, manufacturer, model, purchaseDate, warrantyStart, warrantyEnd, status, description, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, data.assetCode, data.assetName, data.assetType, data.location,
      data.serialNumber || null, data.manufacturer || null, data.model || null,
      data.purchaseDate || null, data.warrantyStart || null, data.warrantyEnd || null,
      data.status || 'ACTIVE', data.description || null, now, now
    ]
  );

  return getById(id);
}

export async function update(
  id: string,
  data: Partial<{
    assetCode: string;
    assetName: string;
    assetType: string;
    location: string;
    serialNumber: string;
    manufacturer: string;
    model: string;
    purchaseDate: string;
    warrantyStart: string;
    warrantyEnd: string;
    status: string;
    description: string;
  }>
) {
  const db = await getDb();
  const existingResult = await db.exec('SELECT * FROM assets WHERE id = ?', [id]);
  const existing = formatRow(existingResult);
  if (!existing) {
    throw new NotFoundError('Asset not found');
  }

  if (data.assetCode) {
    const codeCheckResult = await db.exec(
      'SELECT id FROM assets WHERE assetCode = ? AND id != ?',
      [data.assetCode, id]
    );
    const codeCheck = formatRow(codeCheckResult);
    if (codeCheck) {
      throw new ConflictError('Asset code already exists');
    }
  }

  const oldValue = { ...existing };

  const fields: string[] = [];
  const params: any[] = [];

  const allowedFields = [
    'assetCode', 'assetName', 'assetType', 'location', 'serialNumber',
    'manufacturer', 'model', 'purchaseDate', 'warrantyStart', 'warrantyEnd',
    'status', 'description'
  ];

  for (const field of allowedFields) {
    if ((data as any)[field] !== undefined) {
      fields.push(`${field} = ?`);
      params.push((data as any)[field]);
    }
  }

  if (fields.length === 0) {
    return { newValue: existing, oldValue, asset: existing };
  }

  fields.push('updatedAt = ?');
  params.push(nowISO());
  params.push(id);

  await db.run(`UPDATE assets SET ${fields.join(', ')} WHERE id = ?`, params);

  const newValueResult = await db.exec('SELECT * FROM assets WHERE id = ?', [id]);
  const newValue = formatRow(newValueResult);

  return { newValue, oldValue, asset: newValue };
}

export async function remove(id: string) {
  const db = await getDb();
  const existingResult = await db.exec('SELECT * FROM assets WHERE id = ?', [id]);
  const existing = formatRow(existingResult);
  if (!existing) {
    throw new NotFoundError('Asset not found');
  }

  await db.run('DELETE FROM assets WHERE id = ?', [id]);

  return existing;
}

export async function getDocuments(assetId: string) {
  const db = await getDb();
  const assetResult = await db.exec('SELECT id FROM assets WHERE id = ?', [assetId]);
  const asset = formatRow(assetResult);
  if (!asset) {
    throw new NotFoundError('Asset not found');
  }

  const result = await db.exec(
    'SELECT * FROM asset_documents WHERE assetId = ? ORDER BY uploadedAt DESC',
    [assetId]
  );
  return formatRows(result);
}

export async function createDocument(
  assetId: string,
  data: { filename: string; type: string; path: string; size: number },
  uploadedBy: string
) {
  const db = await getDb();
  const assetResult = await db.exec('SELECT id FROM assets WHERE id = ?', [assetId]);
  const asset = formatRow(assetResult);
  if (!asset) {
    throw new NotFoundError('Asset not found');
  }

  const id = generateId();

  await db.run(
    `INSERT INTO asset_documents (id, assetId, filename, type, path, size, uploadedBy, uploadedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, assetId, data.filename, data.type, data.path, data.size, uploadedBy, nowISO()]
  );

  const result = await db.exec('SELECT * FROM asset_documents WHERE id = ?', [id]);

  return formatRow(result);
}

export async function getMeters(assetId: string) {
  const db = await getDb();
  const assetResult = await db.exec('SELECT id FROM assets WHERE id = ?', [assetId]);
  const asset = formatRow(assetResult);
  if (!asset) {
    throw new NotFoundError('Asset not found');
  }

  const result = await db.exec(
    'SELECT * FROM asset_meters WHERE assetId = ? ORDER BY createdAt DESC',
    [assetId]
  );
  return formatRows(result);
}

export async function createMeter(
  assetId: string,
  data: { meterType: string; unit: string; description?: string }
) {
  const db = await getDb();
  const assetResult = await db.exec('SELECT id FROM assets WHERE id = ?', [assetId]);
  const asset = formatRow(assetResult);
  if (!asset) {
    throw new NotFoundError('Asset not found');
  }

  const id = generateId();

  await db.run(
    `INSERT INTO asset_meters (id, assetId, meterType, unit, description, createdAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, assetId, data.meterType, data.unit, data.description || null, nowISO()]
  );

  const result = await db.exec('SELECT * FROM asset_meters WHERE id = ?', [id]);

  return formatRow(result);
}

export async function addMeterReading(
  meterId: string,
  assetId: string,
  value: number,
  recordedBy: string
) {
  const db = await getDb();
  const meterResult = await db.exec('SELECT id FROM asset_meters WHERE id = ? AND assetId = ?', [meterId, assetId]);
  const meter = formatRow(meterResult);
  if (!meter) {
    throw new NotFoundError('Meter not found for this asset');
  }

  const id = generateId();

  await db.run(
    `INSERT INTO asset_meter_readings (id, meterId, assetId, value, readingDate, recordedBy)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, meterId, assetId, value, nowISO(), recordedBy]
  );

  const result = await db.exec('SELECT * FROM asset_meter_readings WHERE id = ?', [id]);

  return formatRow(result);
}

export async function getHistory(assetId: string) {
  const db = await getDb();
  const assetResult = await db.exec('SELECT id FROM assets WHERE id = ?', [assetId]);
  const asset = formatRow(assetResult);
  if (!asset) {
    throw new NotFoundError('Asset not found');
  }

  const result = await db.exec(
    `SELECT wo.*, u.name as assignedToName, r.name as reporterName
     FROM work_orders wo
     LEFT JOIN users u ON wo.assignedToId = u.id
     LEFT JOIN users r ON wo.reportedById = r.id
     WHERE wo.assetId = ?
     ORDER BY wo.createdAt DESC`,
    [assetId]
  );
  return formatRows(result);
}

export async function getWorkOrders(assetId: string) {
  const db = await getDb();
  const result = await db.exec(
    `SELECT wo.*, u.name as assignedToName
     FROM work_orders wo
     LEFT JOIN users u ON wo.assignedToId = u.id
     WHERE wo.assetId = ?
     ORDER BY wo.createdAt DESC`,
    [assetId]
  );
  return formatRows(result);
}

export async function getPreventiveMaintenance(assetId: string) {
  const db = await getDb();
  const result = await db.exec(
    `SELECT pm.* FROM preventive_maintenance pm
     WHERE pm.assetId = ?
     ORDER BY pm.nextDueDate ASC`,
    [assetId]
  );
  return formatRows(result);
}
