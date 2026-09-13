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

export class PrService {
  async list(page: number = 1, limit: number = 20, status?: string, itemId?: string): Promise<{ data: any[]; total: number }> {
    const db = await getDb();
    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (status) { where += ` AND pr.status = ?`; params.push(status); }
    if (itemId) { where += ` AND pr.itemId = ?`; params.push(itemId); }

    const countResult = await db.exec(`SELECT COUNT(*) as count FROM purchase_requisitions pr ${where}`, params);
    const total = (countResult[0]?.values[0]?.[0] as number) || 0;

    const { offset, limit: lim } = paginate(page, limit);
    params.push(lim, offset);
    const dataResult = await db.exec(
      `SELECT pr.*, 
              COALESCE(sp.itemCode, pr.customItemCode) as "itemCode",
              COALESCE(sp.itemName, pr.customItemName) as "itemName",
              COALESCE(sp.unit, pr.unit) as "sparePartUnit",
              sp.warehouseId, w.name as "warehouseName"
       FROM purchase_requisitions pr
       LEFT JOIN spare_parts sp ON pr.itemId = sp.id
       LEFT JOIN warehouses w ON sp.warehouseId = w.id
       ${where} ORDER BY pr.createdAt DESC LIMIT ? OFFSET ?`,
      params
    );

    return { data: formatRows(dataResult), total };
  }

  async getById(id: string): Promise<any> {
    const db = await getDb();
    const result = await db.exec(
      `SELECT pr.*, 
              COALESCE(sp.itemCode, pr.customItemCode) as "itemCode",
              COALESCE(sp.itemName, pr.customItemName) as "itemName",
              COALESCE(sp.unit, pr.unit) as "sparePartUnit",
              sp.warehouseId, w.name as "warehouseName"
       FROM purchase_requisitions pr
       LEFT JOIN spare_parts sp ON pr.itemId = sp.id
       LEFT JOIN warehouses w ON sp.warehouseId = w.id
       WHERE pr.id = ?`, [id]
    );
    const row = formatRow(result);
    if (!row) {
      throw new NotFoundError('Purchase Requisition not found');
    }
    return row;
  }

  async create(data: any): Promise<any> {
    const db = await getDb();
    const id = generateId();
    const now = nowISO();

    const isCustom = !data.itemId;
    let unit = data.unit || 'PCS';
    let currentStock = 0;
    let minimumStock = 0;
    let itemCode = '';
    let itemName = '';

    if (isCustom) {
      if (!data.customItemName) throw new BadRequestError('Item name is required');
      itemName = data.customItemName;
      itemCode = data.customItemCode || 'CUSTOM';
    } else {
      if (!data.quantity || data.quantity <= 0) throw new BadRequestError('Quantity must be greater than 0');
      const itemResult = await db.exec('SELECT * FROM spare_parts WHERE id = ?', [data.itemId]);
      const item = formatRow(itemResult);
      if (!item) throw new NotFoundError('Spare part not found');
      unit = data.unit || item.unit || 'PCS';
      currentStock = data.currentStock !== undefined ? data.currentStock : item.currentStock;
      minimumStock = data.minimumStock !== undefined ? data.minimumStock : item.minimumStock;
      itemCode = item.itemCode;
      itemName = item.itemName;
    }

    const reason = data.reason || (isCustom ? 'Custom purchase' : 'Low stock alert');

    await db.run(
      `INSERT INTO purchase_requisitions (id, itemId, customItemName, customItemCode, quantity, unit, reason, currentStock, minimumStock, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)`,
      [id, data.itemId || null, data.customItemName || null, data.customItemCode || null, data.quantity, unit, reason, currentStock, minimumStock, now, now]
    );

    return this.getById(id);
  }

  async update(id: string, data: any): Promise<any> {
    const db = await getDb();
    const existingResult = await db.exec('SELECT * FROM purchase_requisitions WHERE id = ?', [id]);
    const existing = formatRow(existingResult);
    if (!existing) {
      throw new NotFoundError('Purchase Requisition not found');
    }

    const validStatuses = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'ORDERED', 'COMPLETED'];
    if (data.status && !validStatuses.includes(data.status)) {
      throw new BadRequestError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const fields: string[] = [];
    const params: any[] = [];

    if (data.status !== undefined) {
      fields.push('status = ?');
      params.push(data.status);
    }

    if (data.receivedAt !== undefined) {
      fields.push('receivedAt = ?');
      params.push(data.receivedAt);
    }

    if (data.quantity !== undefined) {
      fields.push('quantity = ?');
      params.push(data.quantity);
    }

    if (data.reason !== undefined) {
      fields.push('reason = ?');
      params.push(data.reason);
    }

    if (fields.length === 0) {
      return this.getById(id);
    }

    fields.push('updatedAt = ?');
    params.push(nowISO());
    params.push(id);

    await db.run(`UPDATE purchase_requisitions SET ${fields.join(', ')} WHERE id = ?`, params);

    if (data.status === 'COMPLETED' && existing.status !== 'COMPLETED' && existing.itemId) {
      const spResult = await db.exec('SELECT currentStock FROM spare_parts WHERE id = ?', [existing.itemId]);
      const sp = formatRow(spResult);
      if (sp) {
        const newStock = (sp.currentStock || 0) + (existing.quantity || 0);
        await db.run('UPDATE spare_parts SET currentStock = ? WHERE id = ?', [newStock, existing.itemId]);

        const txId = generateId();
        const warehouseResult = await db.exec('SELECT warehouseId FROM spare_parts WHERE id = ?', [existing.itemId]);
        const wh = formatRow(warehouseResult);
        await db.run(
          `INSERT INTO inventory_transactions (id, itemId, warehouseId, transactionType, quantity, unitCost, referenceType, referenceId, notes, createdBy, createdAt)
           VALUES (?, ?, ?, 'PR_RECEIVED', ?, 0, 'PURCHASE_REQUISITION', ?, ?, NULL, ?)`,
          [txId, existing.itemId, wh?.warehouseId || null, existing.quantity, id, `PR ${id.substring(0, 8).toUpperCase()} - barang diterima`, nowISO()]
        );
      }
    }

    return this.getById(id);
  }

  async remove(id: string): Promise<void> {
    const db = await getDb();
    const existing = formatRow(await db.exec('SELECT id FROM purchase_requisitions WHERE id = ?', [id]));
    if (!existing) throw new NotFoundError('Purchase Requisition not found');
    await db.run('DELETE FROM purchase_requisitions WHERE id = ?', [id]);
  }

  async syncToZahir(id: string): Promise<any> {
    const db = await getDb();
    const existingResult = await db.exec('SELECT * FROM purchase_requisitions WHERE id = ?', [id]);
    const existing = formatRow(existingResult);
    if (!existing) {
      throw new NotFoundError('Purchase Requisition not found');
    }

    if (existing.status !== 'APPROVED') {
      throw new BadRequestError('Only APPROVED purchase requisitions can be synced to Zahir');
    }

    const now = nowISO();

    const existingJobResult = await db.exec(
      `SELECT id FROM integration_jobs 
       WHERE referenceType = 'PURCHASE_REQUISITION' AND referenceId = ? AND status IN ('PENDING', 'PROCESSING')`,
      [id]
    );
    const existingJob = formatRow(existingJobResult);

    if (existingJob) {
      throw new BadRequestError('A sync job is already in progress for this purchase requisition');
    }

    const jobId = generateId();
    const payload = JSON.stringify({
      prId: id,
      itemId: existing.itemId,
      quantity: existing.quantity,
      unit: existing.unit,
      reason: existing.reason
    });

    await db.run(
      `INSERT INTO integration_jobs (id, type, provider, referenceType, referenceId, payload, status, idempotencyKey, createdAt)
       VALUES (?, 'PURCHASE_REQ_SYNC', 'zahir', 'PURCHASE_REQUISITION', ?, ?, 'PENDING', ?, ?)`,
      [jobId, id, payload, `CMMS-PR-${id}-SYNC`, now]
    );

    await db.run(
      `UPDATE purchase_requisitions SET syncStatus = 'PENDING', updatedAt = ? WHERE id = ?`,
      [now, id]
    );

    const result = await db.exec('SELECT * FROM integration_jobs WHERE id = ?', [jobId]);
    return formatRow(result);
  }
}

export const prService = new PrService();
