import { getDb } from '../../database/connection';
import { generateId, nowISO, paginate } from '../../shared/utils';
import { NotFoundError, BadRequestError } from '../../shared/errors';

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

export async function listLogBooks(
  page: number = 1,
  limit: number = 20,
  userId?: string,
  startDate?: string,
  endDate?: string,
  search?: string
) {
  const db = await getDb();
  const { offset, limit: lim } = paginate(page, limit);

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (userId) { whereClause += ' AND lb.userId = ?'; params.push(userId); }
  if (startDate) { whereClause += ' AND lb.workDate >= ?'; params.push(startDate); }
  if (endDate) { whereClause += ' AND lb.workDate <= ?'; params.push(endDate); }
  if (search) {
    whereClause += ' AND (lb.description LIKE ? OR lb.location LIKE ? OR EXISTS (SELECT 1 FROM log_book_items lbi WHERE lbi.logBookId = lb.id AND lbi.description LIKE ?))';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const countResult = await db.exec(`SELECT COUNT(*) as c FROM log_books lb ${whereClause}`, params);
  const total = (countResult[0]?.values[0]?.[0] as number) || 0;

  const dataResult = await db.exec(
    `SELECT lb.*, u.name as userName
     FROM log_books lb
     LEFT JOIN users u ON lb.userId = u.id
     ${whereClause}
     ORDER BY lb.workDate DESC, lb.createdAt DESC
     LIMIT ? OFFSET ?`,
    [...params, lim, offset]
  );

  const logs = formatRows(dataResult);

  for (const log of logs) {
    log.items = formatRows(await db.exec(
      'SELECT * FROM log_book_items WHERE logBookId = ? ORDER BY createdAt ASC',
      [log.id]
    ));
    log.spareParts = formatRows(await db.exec(
      `SELECT lbs.*, sp.itemCode, sp.itemName, sp.unit
       FROM log_book_spare_parts lbs
       LEFT JOIN spare_parts sp ON lbs.sparePartId = sp.id
       WHERE lbs.logBookId = ?`,
      [log.id]
    ));
  }

  return { data: logs, total, page, limit: lim, totalPages: Math.ceil(total / lim) };
}

export async function getLogBookById(id: string) {
  const db = await getDb();
  const result = await db.exec(
    `SELECT lb.*, u.name as userName
     FROM log_books lb
     LEFT JOIN users u ON lb.userId = u.id
     WHERE lb.id = ?`,
    [id]
  );
  const log = formatRow(result);
  if (!log) throw new NotFoundError('Log book not found');

  log.items = formatRows(await db.exec(
    'SELECT * FROM log_book_items WHERE logBookId = ? ORDER BY createdAt ASC',
    [id]
  ));
  log.spareParts = formatRows(await db.exec(
    `SELECT lbs.*, sp.itemCode, sp.itemName, sp.unit
     FROM log_book_spare_parts lbs
     LEFT JOIN spare_parts sp ON lbs.sparePartId = sp.id
     WHERE lbs.logBookId = ?`,
    [id]
  ));

  return log;
}

export async function createLogBook(data: {
  userId: string;
  workDate: string;
  location?: string;
  description?: string;
  items: {
    description: string;
    activityType?: string;
    location?: string;
    assetId?: string;
    workOrderNo?: string;
    durationMinutes?: number;
    notes?: string;
    spareParts?: { sparePartId: string; quantity: number; unitCost?: number; notes?: string }[];
  }[];
}) {
  const db = await getDb();
  const id = generateId();
  const now = nowISO();

  await db.run(
    `INSERT INTO log_books (id, userId, workDate, location, description, status, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
    [id, data.userId, data.workDate, data.location || null,
     data.description || null, now, now]
  );

  for (const item of data.items) {
    const itemId = generateId();
    await db.run(
      `INSERT INTO log_book_items (id, logBookId, description, activityType, location, assetId, workOrderNo, durationMinutes, notes, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemId, id, item.description, item.activityType || 'CORRECTIVE',
       item.location || null, item.assetId || null, item.workOrderNo || null,
       item.durationMinutes || null, item.notes || null, now]
    );

    if (item.spareParts && item.spareParts.length > 0) {
      for (const sp of item.spareParts) {
        if (!sp.sparePartId || !sp.quantity || sp.quantity <= 0) continue;

        const itemResult = await db.exec('SELECT id, currentStock, warehouseId FROM spare_parts WHERE id = ?', [sp.sparePartId]);
        const spData = formatRow(itemResult);
        if (!spData) throw new NotFoundError(`Spare part ${sp.sparePartId} not found`);
        if ((spData.currentStock as number) < sp.quantity) {
          throw new BadRequestError(`Insufficient stock for ${sp.sparePartId}. Available: ${spData.currentStock}, requested: ${sp.quantity}`);
        }

        const spId = generateId();
        await db.run(
          `INSERT INTO log_book_spare_parts (id, logBookId, logBookItemId, sparePartId, quantity, unitCost, notes, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [spId, id, itemId, sp.sparePartId, sp.quantity, sp.unitCost || 0, sp.notes || null, now]
        );

        await db.run(
          `UPDATE spare_parts SET currentStock = currentStock - ?, updatedAt = ? WHERE id = ?`,
          [sp.quantity, now, sp.sparePartId]
        );

        const txnId = generateId();
        await db.run(
          `INSERT INTO inventory_transactions (id, itemId, warehouseId, transactionType, quantity, unitCost, referenceType, referenceId, notes, createdBy, createdAt)
           VALUES (?, ?, ?, 'OUT', ?, ?, 'LOG_BOOK', ?, ?, ?, ?)`,
          [txnId, sp.sparePartId, spData.warehouseId, sp.quantity, sp.unitCost || 0, id,
           sp.notes || `Log book: ${item.description}`, data.userId, now]
        );
      }
    }
  }

  return await getLogBookById(id);
}

export async function updateLogBook(id: string, data: {
  workDate?: string;
  location?: string;
  description?: string;
  items?: any[];
}) {
  const db = await getDb();
  const existing = formatRow(await db.exec('SELECT * FROM log_books WHERE id = ?', [id]));
  if (!existing) throw new NotFoundError('Log book not found');

  const now = nowISO();
  const fields: string[] = [];
  const params: any[] = [];

  if (data.workDate !== undefined) { fields.push('workDate = ?'); params.push(data.workDate); }
  if (data.location !== undefined) { fields.push('location = ?'); params.push(data.location); }
  if (data.description !== undefined) { fields.push('description = ?'); params.push(data.description); }

  if (fields.length > 0) {
    fields.push('updatedAt = ?');
    params.push(now);
    params.push(id);
    await db.run(`UPDATE log_books SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  if (data.items && Array.isArray(data.items)) {
    const oldSpares = formatRows(await db.exec('SELECT * FROM log_book_spare_parts WHERE logBookId = ?', [id]));
    for (const sp of oldSpares) {
      await db.run(
        `UPDATE spare_parts SET currentStock = currentStock + ?, updatedAt = ? WHERE id = ?`,
        [sp.quantity, now, sp.sparePartId]
      );
    }
    await db.run('DELETE FROM log_book_spare_parts WHERE logBookId = ?', [id]);
    await db.run('DELETE FROM log_book_items WHERE logBookId = ?', [id]);

    for (const item of data.items) {
      const itemId = generateId();
      await db.run(
        `INSERT INTO log_book_items (id, logBookId, description, activityType, location, workOrderNo, durationMinutes, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [itemId, id, item.description, item.activityType || 'CORRECTIVE', item.location || data.location || '', item.workOrderNo || '', item.durationMinutes || 0, item.notes || '']
      );

      if (item.spareParts && Array.isArray(item.spareParts)) {
        for (const sp of item.spareParts) {
          if (!sp.sparePartId || !sp.quantity) continue;
          const spId = generateId();
          const part = formatRow(await db.exec('SELECT * FROM spare_parts WHERE id = ?', [sp.sparePartId]));
          await db.run(
            `INSERT INTO log_book_spare_parts (id, logBookId, logBookItemId, sparePartId, quantity, unitCost, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [spId, id, itemId, sp.sparePartId, sp.quantity, sp.unitCost || (part?.unitCost ?? 0), sp.notes || '']
          );
          await db.run(
            `UPDATE spare_parts SET currentStock = currentStock - ?, updatedAt = ? WHERE id = ?`,
            [sp.quantity, now, sp.sparePartId]
          );
        }
      }
    }
  }

  return await getLogBookById(id);
}

export async function deleteLogBook(id: string) {
  const db = await getDb();
  const existing = formatRow(await db.exec('SELECT * FROM log_books WHERE id = ?', [id]));
  if (!existing) throw new NotFoundError('Log book not found');

  const spItems = formatRows(await db.exec('SELECT * FROM log_book_spare_parts WHERE logBookId = ?', [id]));
  for (const sp of spItems) {
    await db.run(
      `UPDATE spare_parts SET currentStock = currentStock + ?, updatedAt = ? WHERE id = ?`,
      [sp.quantity, nowISO(), sp.sparePartId]
    );
  }

  await db.run('DELETE FROM log_book_spare_parts WHERE logBookId = ?', [id]);
  await db.run('DELETE FROM log_book_items WHERE logBookId = ?', [id]);
  await db.run('DELETE FROM log_books WHERE id = ?', [id]);
}
