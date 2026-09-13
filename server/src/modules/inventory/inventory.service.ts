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

// ─── Spare Parts ─────────────────────────────────────────────────────────────

export async function listSpareParts(
  page: number = 1,
  limit: number = 20,
  search?: string,
  category?: string,
  warehouseId?: string
) {
  const { offset, limit: lim } = paginate(page, limit);
  const db = await getDb();

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

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

  const countResult = await db.exec(
    `SELECT COUNT(*) as total FROM spare_parts sp ${whereClause}`,
    params
  );
  const total = (countResult[0]?.values[0]?.[0] as number) || 0;

  params.push(lim, offset);
  const dataResult = await db.exec(
    `SELECT sp.*, w.name as warehouseName
     FROM spare_parts sp
     LEFT JOIN warehouses w ON sp.warehouseId = w.id
     ${whereClause}
     ORDER BY sp.createdAt DESC
     LIMIT ? OFFSET ?`,
    params
  );

  return { data: formatRows(dataResult), total };
}

export async function getSparePartById(id: string) {
  const db = await getDb();
  const result = await db.exec(
    `SELECT sp.*, w.name as warehouseName
     FROM spare_parts sp
     LEFT JOIN warehouses w ON sp.warehouseId = w.id
     WHERE sp.id = ?`,
    [id]
  );
  const obj = formatRow(result);
  if (!obj) {
    throw new NotFoundError('Spare part not found');
  }
  return obj;
}

export async function createSparePart(data: {
  itemCode: string;
  itemName: string;
  category?: string;
  specification?: string;
  unit?: string;
  warehouseId?: string;
  stockLocation?: string;
  currentStock?: number;
  minimumStock?: number;
  maximumStock?: number;
  unitCost?: number;
}) {
  const db = await getDb();
  const existingResult = await db.exec('SELECT id FROM spare_parts WHERE itemCode = ?', [data.itemCode]);
  const existing = formatRow(existingResult);
  if (existing) {
    throw new ConflictError('Item code already exists');
  }

  if (data.warehouseId) {
    const whResult = await db.exec('SELECT id FROM warehouses WHERE id = ?', [data.warehouseId]);
    const wh = formatRow(whResult);
    if (!wh) {
      throw new NotFoundError('Warehouse not found');
    }
  }

  const id = generateId();
  const now = nowISO();

  await db.run(
    `INSERT INTO spare_parts (id, itemCode, itemName, category, specification, unit, warehouseId, stockLocation, currentStock, minimumStock, maximumStock, unitCost, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, data.itemCode, data.itemName,
      data.category || null, data.specification || null,
      data.unit || 'PCS', data.warehouseId || null,
      data.stockLocation || null,
      data.currentStock ?? 0, data.minimumStock ?? 0,
      data.maximumStock ?? 0, data.unitCost ?? 0,
      now, now
    ]
  );

  return getSparePartById(id);
}

export async function updateSparePart(
  id: string,
  data: Partial<{
    itemCode: string;
    itemName: string;
    category: string;
    specification: string;
    unit: string;
    warehouseId: string;
    stockLocation: string;
    currentStock: number;
    minimumStock: number;
    maximumStock: number;
    unitCost: number;
  }>
) {
  const db = await getDb();
  const existingResult = await db.exec('SELECT * FROM spare_parts WHERE id = ?', [id]);
  const existing = formatRow(existingResult);
  if (!existing) {
    throw new NotFoundError('Spare part not found');
  }

  if (data.itemCode) {
    const codeCheckResult = await db.exec(
      'SELECT id FROM spare_parts WHERE itemCode = ? AND id != ?',
      [data.itemCode, id]
    );
    const codeCheck = formatRow(codeCheckResult);
    if (codeCheck) {
      throw new ConflictError('Item code already exists');
    }
  }

  if (data.warehouseId) {
    const whResult = await db.exec('SELECT id FROM warehouses WHERE id = ?', [data.warehouseId]);
    const wh = formatRow(whResult);
    if (!wh) {
      throw new NotFoundError('Warehouse not found');
    }
  }

  const fields: string[] = [];
  const params: any[] = [];

  const allowedFields = [
    'itemCode', 'itemName', 'category', 'specification', 'unit',
    'warehouseId', 'stockLocation', 'currentStock', 'minimumStock',
    'maximumStock', 'unitCost'
  ];

  for (const field of allowedFields) {
    if ((data as any)[field] !== undefined) {
      fields.push(`${field} = ?`);
      params.push((data as any)[field]);
    }
  }

  if (fields.length === 0) {
    return getSparePartById(id);
  }

  fields.push('updatedAt = ?');
  params.push(nowISO());
  params.push(id);

  await db.run(`UPDATE spare_parts SET ${fields.join(', ')} WHERE id = ?`, params);

  return getSparePartById(id);
}

// ─── Warehouses ──────────────────────────────────────────────────────────────

export async function listWarehouses() {
  const db = await getDb();
  const result = await db.exec('SELECT * FROM warehouses ORDER BY name ASC');
  return formatRows(result);
}

export async function createWarehouse(data: {
  name: string;
  location?: string;
  description?: string;
}) {
  const db = await getDb();
  const existingResult = await db.exec('SELECT id FROM warehouses WHERE name = ?', [data.name]);
  const existing = formatRow(existingResult);
  if (existing) {
    throw new ConflictError('Warehouse name already exists');
  }

  const id = generateId();
  const now = nowISO();

  await db.run(
    `INSERT INTO warehouses (id, name, location, description, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.name, data.location || null, data.description || null, now, now]
  );

  const result = await db.exec('SELECT * FROM warehouses WHERE id = ?', [id]);
  return formatRow(result);
}

export async function updateWarehouse(id: string, data: {
  name?: string;
  location?: string;
  description?: string;
}) {
  const db = await getDb();
  const existingResult = await db.exec('SELECT * FROM warehouses WHERE id = ?', [id]);
  const existing = formatRow(existingResult);
  if (!existing) {
    throw new NotFoundError('Warehouse not found');
  }

  if (data.name && data.name !== existing.name) {
    const nameCheck = await db.exec('SELECT id FROM warehouses WHERE name = ? AND id != ?', [data.name, id]);
    const nameExists = formatRow(nameCheck);
    if (nameExists) throw new ConflictError('Warehouse name already exists');
  }

  const now = nowISO();
  const fields: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
  if (data.location !== undefined) { fields.push('location = ?'); params.push(data.location); }
  if (data.description !== undefined) { fields.push('description = ?'); params.push(data.description); }

  if (fields.length > 0) {
    fields.push('updatedAt = ?');
    params.push(now);
    params.push(id);
    await db.run(`UPDATE warehouses SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  const result = await db.exec('SELECT * FROM warehouses WHERE id = ?', [id]);
  return formatRow(result);
}

export async function deleteWarehouse(id: string) {
  const db = await getDb();
  const existingResult = await db.exec('SELECT * FROM warehouses WHERE id = ?', [id]);
  const existing = formatRow(existingResult);
  if (!existing) {
    throw new NotFoundError('Warehouse not found');
  }

  const sparePartsResult = await db.exec('SELECT COUNT(*) as c FROM spare_parts WHERE warehouseId = ?', [id]);
  const sparePartsCount = (sparePartsResult[0]?.values[0]?.[0] as number) || 0;
  if (sparePartsCount > 0) {
    throw new ConflictError('Cannot delete warehouse with existing spare parts');
  }

  await db.run('DELETE FROM warehouses WHERE id = ?', [id]);
}

// ─── Transactions ────────────────────────────────────────────────────────────

export async function listTransactions(
  page: number = 1,
  limit: number = 20,
  itemId?: string,
  warehouseId?: string,
  transactionType?: string,
  startDate?: string,
  endDate?: string
) {
  const { offset, limit: lim } = paginate(page, limit);
  const db = await getDb();

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

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

  const countResult = await db.exec(
    `SELECT COUNT(*) as total FROM inventory_transactions it ${whereClause}`,
    params
  );
  const total = (countResult[0]?.values[0]?.[0] as number) || 0;

  params.push(lim, offset);
  const dataResult = await db.exec(
    `SELECT it.*, sp.itemCode, sp.itemName, w.name as warehouseName, u.name as createdByName
     FROM inventory_transactions it
     LEFT JOIN spare_parts sp ON it.itemId = sp.id
     LEFT JOIN warehouses w ON it.warehouseId = w.id
     LEFT JOIN users u ON it.createdBy = u.id
     ${whereClause}
     ORDER BY it.createdAt DESC
     LIMIT ? OFFSET ?`,
    params
  );

  return { data: formatRows(dataResult), total };
}

export async function updateStock(itemId: string, delta: number) {
  const db = await getDb();
  await db.run(
    `UPDATE spare_parts SET currentStock = currentStock + ?, updatedAt = ? WHERE id = ?`,
    [delta, nowISO(), itemId]
  );
}

export async function stockIn(
  itemId: string,
  warehouseId: string,
  quantity: number,
  unitCost: number,
  notes: string | undefined,
  createdBy: string
) {
  const db = await getDb();
  const itemResult = await db.exec('SELECT id FROM spare_parts WHERE id = ?', [itemId]);
  const item = formatRow(itemResult);
  if (!item) {
    throw new NotFoundError('Spare part not found');
  }

  const whResult = await db.exec('SELECT id FROM warehouses WHERE id = ?', [warehouseId]);
  const wh = formatRow(whResult);
  if (!wh) {
    throw new NotFoundError('Warehouse not found');
  }

    const id = generateId();
    const now = nowISO();

    await db.run(
      `INSERT INTO inventory_transactions (id, itemId, warehouseId, transactionType, quantity, unitCost, notes, createdBy, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, itemId, warehouseId, 'IN', quantity, unitCost, notes || null, createdBy, now]
    );

    await db.run(
      `UPDATE spare_parts SET currentStock = currentStock + ?, unitCost = ?, updatedAt = ? WHERE id = ?`,
      [quantity, unitCost, now, itemId]
    );

    const result = await db.exec('SELECT * FROM inventory_transactions WHERE id = ?', [id]);
    return formatRow(result);
}

export async function stockOut(
  itemId: string,
  warehouseId: string,
  quantity: number,
  unitCost: number,
  referenceType: string | undefined,
  referenceId: string | undefined,
  notes: string | undefined,
  createdBy: string
) {
  const db = await getDb();
  const itemResult = await db.exec('SELECT id, currentStock FROM spare_parts WHERE id = ?', [itemId]);
  const item = formatRow(itemResult);
  if (!item) {
    throw new NotFoundError('Spare part not found');
  }

  if ((item.currentStock as number) < quantity) {
    throw new BadRequestError(`Insufficient stock. Available: ${item.currentStock}, requested: ${quantity}`);
  }

  const whResult = await db.exec('SELECT id FROM warehouses WHERE id = ?', [warehouseId]);
  const wh = formatRow(whResult);
  if (!wh) {
    throw new NotFoundError('Warehouse not found');
  }

    const id = generateId();
    const now = nowISO();

    await db.run(
      `INSERT INTO inventory_transactions (id, itemId, warehouseId, transactionType, quantity, unitCost, referenceType, referenceId, notes, createdBy, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, itemId, warehouseId, 'OUT', quantity, unitCost, referenceType || null, referenceId || null, notes || null, createdBy, now]
    );

    await db.run(
      `UPDATE spare_parts SET currentStock = currentStock - ?, updatedAt = ? WHERE id = ?`,
      [quantity, now, itemId]
    );

    const result = await db.exec('SELECT * FROM inventory_transactions WHERE id = ?', [id]);
    return formatRow(result);
}

export async function adjustment(
  itemId: string,
  warehouseId: string,
  quantity: number,
  unitCost: number,
  notes: string | undefined,
  createdBy: string
) {
  const db = await getDb();
  const itemResult = await db.exec('SELECT id FROM spare_parts WHERE id = ?', [itemId]);
  const item = formatRow(itemResult);
  if (!item) {
    throw new NotFoundError('Spare part not found');
  }

  const whResult = await db.exec('SELECT id FROM warehouses WHERE id = ?', [warehouseId]);
  const wh = formatRow(whResult);
  if (!wh) {
    throw new NotFoundError('Warehouse not found');
  }

    const id = generateId();
    const now = nowISO();

    await db.run(
      `INSERT INTO inventory_transactions (id, itemId, warehouseId, transactionType, quantity, unitCost, notes, createdBy, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, itemId, warehouseId, 'ADJUSTMENT', quantity, unitCost, notes || null, createdBy, now]
    );

    await db.run(
      `UPDATE spare_parts SET currentStock = currentStock + ?, unitCost = ?, updatedAt = ? WHERE id = ?`,
      [quantity, unitCost, now, itemId]
    );

    const result = await db.exec('SELECT * FROM inventory_transactions WHERE id = ?', [id]);
    return formatRow(result);
}

export async function returnStock(
  itemId: string,
  warehouseId: string,
  quantity: number,
  unitCost: number,
  notes: string | undefined,
  createdBy: string
) {
  const db = await getDb();
  const itemResult = await db.exec('SELECT id FROM spare_parts WHERE id = ?', [itemId]);
  const item = formatRow(itemResult);
  if (!item) {
    throw new NotFoundError('Spare part not found');
  }

  const whResult = await db.exec('SELECT id FROM warehouses WHERE id = ?', [warehouseId]);
  const wh = formatRow(whResult);
  if (!wh) {
    throw new NotFoundError('Warehouse not found');
  }

    const id = generateId();
    const now = nowISO();

    await db.run(
      `INSERT INTO inventory_transactions (id, itemId, warehouseId, transactionType, quantity, unitCost, notes, createdBy, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, itemId, warehouseId, 'RETURN', quantity, unitCost, notes || null, createdBy, now]
    );

    await db.run(
      `UPDATE spare_parts SET currentStock = currentStock + ?, unitCost = ?, updatedAt = ? WHERE id = ?`,
      [quantity, unitCost, now, itemId]
    );

    const result = await db.exec('SELECT * FROM inventory_transactions WHERE id = ?', [id]);
    return formatRow(result);
}

export async function getLowStockItems() {
  const db = await getDb();
  const result = await db.exec(
    `SELECT sp.*, w.name as warehouseName
     FROM spare_parts sp
     LEFT JOIN warehouses w ON sp.warehouseId = w.id
     WHERE sp.currentStock <= sp.minimumStock
     ORDER BY sp.currentStock ASC`
  );
  return formatRows(result);
}
