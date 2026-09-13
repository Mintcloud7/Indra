import { getDb } from '../../database/connection';
import { generateId, generateWoNumber, nowISO, paginate } from '../../shared/utils';
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

export class PmService {
  async getChecklistStats(): Promise<Record<string, { total: number; completed: number }>> {
    const db = await getDb();
    const result = await db.exec(
      `SELECT pmId, COUNT(*) as total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
       FROM pm_checklists GROUP BY pmId`
    );
    const stats: Record<string, { total: number; completed: number }> = {};
    if (result[0]) {
      for (const row of result[0].values) {
        stats[row[0] as string] = { total: row[1] as number, completed: row[2] as number };
      }
    }
    return stats;
  }

  async list(page: number = 1, limit: number = 20, filters: any = {}): Promise<{ data: any[]; total: number }> {
    const db = await getDb();
    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (filters.status) { where += ' AND pm.status = ?'; params.push(filters.status); }
    if (filters.frequency) { where += ' AND pm.frequency = ?'; params.push(filters.frequency); }
    if (filters.assetId) { where += ' AND pm.assetId = ?'; params.push(filters.assetId); }
    if (filters.assignedToId) { where += ' AND pm.assignedToId = ?'; params.push(filters.assignedToId); }
    if (filters.search) { where += ` AND (pm.title LIKE ? OR pm.description LIKE ?)`; params.push(`%${filters.search}%`, `%${filters.search}%`); }

    const countResult = await db.exec(`SELECT COUNT(*) as count FROM preventive_maintenance pm ${where}`, params);
    const total = (countResult[0]?.values[0]?.[0] as number) || 0;

    const { offset, limit: lim } = paginate(page, limit);
    params.push(lim, offset);
    const dataResult = await db.exec(
      `SELECT pm.*, a.assetName, a.assetCode, u.name as assignedToName
       FROM preventive_maintenance pm
       LEFT JOIN assets a ON pm.assetId = a.id
       LEFT JOIN users u ON pm.assignedToId = u.id
       ${where} ORDER BY pm.createdAt DESC LIMIT ? OFFSET ?`,
      params
    );

    return { data: formatRows(dataResult), total };
  }

  async getById(id: string): Promise<any> {
    const db = await getDb();
    const pmResult = await db.exec(
      `SELECT pm.*, a.assetName, a.assetCode, u.name as assignedToName
       FROM preventive_maintenance pm
       LEFT JOIN assets a ON pm.assetId = a.id
       LEFT JOIN users u ON pm.assignedToId = u.id
       WHERE pm.id = ?`, [id]
    );
    const pm = formatRow(pmResult);
    if (!pm) throw new NotFoundError('Preventive Maintenance not found');

    const clResult = await db.exec(
      `SELECT c.*, u.name as completedByName FROM pm_checklists c
       LEFT JOIN users u ON c.completedBy = u.id
       WHERE c.pmId = ? ORDER BY c.createdAt`, [id]
    );
    pm.checklists = formatRows(clResult);

    const logsResult = await db.exec(
      `SELECT pl.*, w.woNumber FROM pm_logs pl
       LEFT JOIN work_orders w ON pl.woId = w.id
       WHERE pl.pmId = ? ORDER BY pl.completedAt DESC`, [id]
    );
    pm.logs = formatRows(logsResult);

    const woResult = await db.exec(
      `SELECT pw.*, w.woNumber, w.status as woStatus FROM pm_wos pw
       LEFT JOIN work_orders w ON pw.woId = w.id
       WHERE pw.pmId = ? ORDER BY pw.createdAt DESC`, [id]
    );
    pm.generatedWorkOrders = formatRows(woResult);

    return pm;
  }

  async getWorkOrders(id: string): Promise<any[]> {
    const db = await getDb();
    const result = await db.exec(
      `SELECT w.* FROM pm_wos pw
       LEFT JOIN work_orders w ON pw.woId = w.id
       WHERE pw.pmId = ? ORDER BY w.createdAt DESC`, [id]
    );
    return formatRows(result);
  }

  async create(data: any): Promise<any> {
    const db = await getDb();
    const id = generateId();
    const now = nowISO();

    if (!data.title) throw new BadRequestError('Title is required');
    if (!data.assetId) throw new BadRequestError('Asset is required');
    if (!data.frequency) throw new BadRequestError('Frequency is required');

    const validFrequencies = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM'];
    if (!validFrequencies.includes(data.frequency)) {
      throw new BadRequestError(`Invalid frequency. Must be one of: ${validFrequencies.join(', ')}`);
    }

    const assetResult = await db.exec('SELECT id FROM assets WHERE id = ?', [String(data.assetId)]);
    const asset = formatRow(assetResult);
    if (!asset) {
      throw new NotFoundError('Asset not found');
    }

    const assignedToId = data.assignedToId || data.assignedTo || null;

    if (assignedToId) {
      const userResult = await db.exec('SELECT id FROM users WHERE id = ?', [assignedToId]);
      const user = formatRow(userResult);
      if (!user) {
        throw new NotFoundError('Assigned user not found');
      }
    }

    const nextDueDate = data.nextDueDate || this.calculateNextDueDate(data.frequency, data.startDate, data.customIntervalDays);

    await db.run(
      `INSERT INTO preventive_maintenance (id, assetId, title, description, frequency, customIntervalDays, startDate, nextDueDate, meterType, meterThreshold, assignedToId, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
      [
        id, data.assetId, data.title, data.description || null,
        data.frequency, data.customIntervalDays || null,
        data.startDate || data.nextDueDate || now, nextDueDate,
        data.meterType || null, data.meterThreshold || null,
        assignedToId, now, now
      ]
    );

    if (data.checklists && Array.isArray(data.checklists)) {
      for (const item of data.checklists) {
        await db.run(
          `INSERT INTO pm_checklists (id, pmId, title, description, required) VALUES (?, ?, ?, ?, ?)`,
          [generateId(), id, item.title, item.description || null, item.required !== false ? 1 : 0]
        );
      }
    }

    
    return this.getById(id);
  }

  async update(id: string, data: any): Promise<any> {
    const db = await getDb();
    const existingResult = await db.exec('SELECT * FROM preventive_maintenance WHERE id = ?', [id]);
    const existing = formatRow(existingResult);
    if (!existing) {
      throw new NotFoundError('Preventive Maintenance not found');
    }

    if (data.assignedToId) {
      const userResult = await db.exec('SELECT id FROM users WHERE id = ?', [data.assignedToId]);
      const user = formatRow(userResult);
      if (!user) {
        throw new NotFoundError('Assigned user not found');
      }
    }

    const fields: string[] = [];
    const params: any[] = [];

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
    params.push(nowISO());
    params.push(id);

    await db.run(`UPDATE preventive_maintenance SET ${fields.join(', ')} WHERE id = ?`, params);

    // Reset checklist completions when rescheduled to a new date
    if (data.nextDueDate && data.nextDueDate !== existing.nextDueDate) {
      await db.run(
        `UPDATE pm_checklists SET completed = 0, completedBy = NULL, completedAt = NULL WHERE pmId = ?`,
        [id]
      );
    }

    if (data.checklists && Array.isArray(data.checklists)) {
      await db.run('DELETE FROM pm_checklists WHERE pmId = ?', [id]);
      for (const item of data.checklists) {
        await db.run(
          `INSERT INTO pm_checklists (id, pmId, title, description, required) VALUES (?, ?, ?, ?, ?)`,
          [generateId(), id, item.title, item.description || null, item.required !== false ? 1 : 0]
        );
      }
    }

    
    return this.getById(id);
  }

  async delete(id: string): Promise<void> {
    const db = await getDb();
    const existingResult = await db.exec('SELECT id FROM preventive_maintenance WHERE id = ?', [id]);
    const existing = formatRow(existingResult);
    if (!existing) {
      throw new NotFoundError('Preventive Maintenance not found');
    }

    await db.run('DELETE FROM pm_checklists WHERE pmId = ?', [id]);
    await db.run('DELETE FROM pm_logs WHERE pmId = ?', [id]);
    await db.run('DELETE FROM pm_wos WHERE pmId = ?', [id]);
    await db.run('DELETE FROM preventive_maintenance WHERE id = ?', [id]);
    
  }

  async toggleChecklist(checklistId: string, userId: string): Promise<any> {
    const db = await getDb();
    const existing = formatRow(await db.exec('SELECT * FROM pm_checklists WHERE id = ?', [checklistId]));
    if (!existing) throw new NotFoundError('Checklist item not found');

    const newCompleted = existing.completed ? 0 : 1;
    const now = nowISO();

    await db.run(
      `UPDATE pm_checklists SET completed = ?, completedBy = ?, completedAt = ? WHERE id = ?`,
      [newCompleted, newCompleted ? userId : null, newCompleted ? now : null, checklistId]
    );
    

    return formatRow(await db.exec('SELECT * FROM pm_checklists WHERE id = ?', [checklistId]));
  }

  async submitToLogbook(userId: string, workDate: string): Promise<any> {
    const db = await getDb();
    const now = nowISO();

    const pmsResult = await db.exec(
      `SELECT pm.*, a.assetName, a.assetCode, a.location as assetLocation
       FROM preventive_maintenance pm
       LEFT JOIN assets a ON pm.assetId = a.id
       WHERE pm.status = 'ACTIVE' AND (
         pm.nextDueDate = ?
         OR SUBSTR(pm.nextDueDate, 1, 10) = ?
         OR (pm.nextDueDate IS NULL AND pm.id IN (
           SELECT pmId FROM pm_checklists WHERE completed = 1
         ))
       )`,
      [workDate, workDate]
    );
    const pms = formatRows(pmsResult);
    if (pms.length === 0) throw new BadRequestError('Tidak ada PM schedule untuk tanggal ini');

    const logBookId = generateId();
    await db.run(
      `INSERT INTO log_books (id, userId, workDate, location, description, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
      [logBookId, userId, workDate, 'PM Schedule', `Preventive maintenance activities for ${workDate}`, now, now]
    );

    for (const pm of pms) {
      const checklists = formatRows(await db.exec('SELECT * FROM pm_checklists WHERE pmId = ? ORDER BY createdAt', [pm.id]));
      const completed = checklists.filter((c: any) => c.completed);
      const incomplete = checklists.filter((c: any) => !c.completed);

      let detailNotes = `PM: ${pm.title}`;
      if (pm.assetName) detailNotes += `\nAsset: ${pm.assetCode} - ${pm.assetName}`;
      if (pm.description) detailNotes += `\nDeskripsi: ${pm.description}`;

      if (checklists.length > 0) {
        detailNotes += `\n\nChecklist (${completed.length}/${checklists.length} selesai):`;
        for (const cl of checklists) {
          const status = cl.completed ? '✓' : '✗';
          const time = cl.completedAt ? ` (${new Date(cl.completedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})` : '';
          detailNotes += `\n  ${status} ${cl.title}${time}`;
        }
      }

      const itemId = generateId();
      await db.run(
        `INSERT INTO log_book_items (id, logBookId, description, activityType, location, assetId, workOrderNo, durationMinutes, notes, createdAt)
         VALUES (?, ?, ?, 'PREVENTIVE', ?, ?, ?, ?, ?, ?)`,
        [itemId, logBookId, pm.title, pm.assetLocation || pm.assetName || null,
         pm.assetId || null, null, null, detailNotes, now]
      );
    }

    

    const result = await db.exec(
      `SELECT lb.*, u.name as userName FROM log_books lb LEFT JOIN users u ON lb.userId = u.id WHERE lb.id = ?`,
      [logBookId]
    );
    const log = formatRow(result);
    log.items = formatRows(await db.exec('SELECT * FROM log_book_items WHERE logBookId = ?', [logBookId]));
    log.spareParts = [];
    return log;
  }

  async generateWorkOrder(pmId: string): Promise<any> {
    const db = await getDb();
    const pmResult = await db.exec(
      `SELECT pm.*, a.assetName, a.assetCode, a.location
       FROM preventive_maintenance pm
       LEFT JOIN assets a ON pm.assetId = a.id
       WHERE pm.id = ?`, [pmId]
    );
    const pm = formatRow(pmResult);
    if (!pm) {
      throw new NotFoundError('Preventive Maintenance not found');
    }

    if (pm.status !== 'ACTIVE') {
      throw new BadRequestError('Can only generate work orders for ACTIVE preventive maintenance');
    }

    const now = nowISO();
    const currentMonth = now.substring(0, 7);
    const existingWoResult = await db.exec(
      `SELECT pw.id FROM pm_wos pw
       JOIN work_orders w ON pw.woId = w.id
       WHERE pw.pmId = ? AND w.createdAt >= ? AND w.createdAt < ?`,
      [pmId, `${currentMonth}-01`, `${currentMonth}-32`]
    );
    const existingWo = formatRows(existingWoResult);

    if (existingWo.length > 0) {
      throw new BadRequestError('A work order for this PM period has already been generated');
    }

    const woCountResult = await db.exec("SELECT COUNT(*) as count FROM work_orders WHERE woNumber LIKE ?", [`WO-${new Date().getFullYear()}%`]);
    const woNumber = generateWoNumber((woCountResult[0]?.values[0]?.[0] as number) || 0);

    const woId = generateId();
    await db.run(
      `INSERT INTO work_orders (id, woNumber, title, description, assetId, location, reportedById, assignedToId, priority, status, dueDate, problemDescription, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'MEDIUM', 'OPEN', ?, ?, ?)`,
      [
        woId, woNumber,
        `PM: ${pm.title}`,
        `Preventive Maintenance scheduled for ${pm.assetName || pm.assetCode}`,
        pm.assetId, pm.location || null,
        pm.assignedToId || 'system', pm.assignedToId || null,
        pm.nextDueDate,
        'Auto-generated from preventive maintenance schedule',
        now
      ]
    );

    await db.run(
      `INSERT INTO pm_wos (id, pmId, woId, createdAt) VALUES (?, ?, ?, ?)`,
      [generateId(), pmId, woId, now]
    );

    const checklistsResult = await db.exec('SELECT * FROM pm_checklists WHERE pmId = ?', [pmId]);
    const checklists = formatRows(checklistsResult);
    for (const checklist of checklists) {
      await db.run(
        `INSERT INTO work_order_checklists (id, woId, title, description, required, completed)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [generateId(), woId, checklist.title, checklist.description || null, checklist.required]
      );
    }

    await db.run(
      `INSERT INTO pm_logs (id, pmId, woId, completedAt, notes) VALUES (?, ?, ?, ?, ?)`,
      [generateId(), pmId, woId, now, 'Work order generated']
    );

    const newNextDue = this.calculateNextDueDate(pm.frequency, pm.startDate, pm.customIntervalDays);
    await db.run('UPDATE preventive_maintenance SET nextDueDate = ?, updatedAt = ? WHERE id = ?', [newNextDue, now, pmId]);

    const woResult = await db.exec(
      `SELECT wo.*, a.assetName, a.assetCode FROM work_orders wo
       LEFT JOIN assets a ON wo.assetId = a.id WHERE wo.id = ?`, [woId]
    );
    return formatRow(woResult);
  }

  async checkDuePMs(): Promise<any[]> {
    const now = nowISO();
    const db = await getDb();

    const duePMsResult = await db.exec(
      `SELECT pm.*, a.assetName, a.assetCode
       FROM preventive_maintenance pm
       LEFT JOIN assets a ON pm.assetId = a.id
       WHERE pm.status = 'ACTIVE' AND pm.nextDueDate <= ?`,
      [now]
    );
    const duePMs = formatRows(duePMsResult);

    if (duePMs.length === 0) {
      return [];
    }

    const generated: any[] = [];

    for (const pm of duePMs) {
      const currentMonth = now.substring(0, 7);
      const existingWoResult = await db.exec(
        `SELECT pw.id FROM pm_wos pw
         JOIN work_orders w ON pw.woId = w.id
         WHERE pw.pmId = ? AND w.createdAt >= ? AND w.createdAt < ?`,
        [pm.id, `${currentMonth}-01`, `${currentMonth}-32`]
      );
      const existingWo = formatRows(existingWoResult);

      if (existingWo.length === 0) {
        try {
          const wo = await this.generateWorkOrder(pm.id);
          generated.push(wo);
        } catch (err) {
          console.error(`Failed to generate WO for PM ${pm.id}:`, err);
        }
      }
    }

    return generated;
  }

  calculateNextDueDate(frequency: string, startDate?: string, customIntervalDays?: number): string {
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

export const pmService = new PmService();
