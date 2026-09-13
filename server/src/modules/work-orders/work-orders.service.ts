import { getDb } from '../../database/connection';
import { generateId, generateWoNumber, nowISO, paginate } from '../../shared/utils';
import { NotFoundError, BadRequestError, ConflictError } from '../../shared/errors';

const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['ON_HOLD', 'CLOSED'],
  ON_HOLD: ['IN_PROGRESS'],
  CLOSED: []
};

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

export class WorkOrderService {
  async list(page: number = 1, limit: number = 20, filters: any = {}): Promise<{ data: any[]; total: number }> {
    const db = await getDb();
    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (filters.status) { where += ' AND wo.status = ?'; params.push(filters.status); }
    if (filters.priority) { where += ' AND wo.priority = ?'; params.push(filters.priority); }
    if (filters.assignedToId) { where += ' AND wo.assignedToId = ?'; params.push(filters.assignedToId); }
    if (filters.assetId) { where += ' AND wo.assetId = ?'; params.push(filters.assetId); }
    if (filters.search) { where += ` AND (wo.woNumber LIKE ? OR wo.title LIKE ?)`; params.push(`%${filters.search}%`, `%${filters.search}%`); }

    const countResult = await db.exec(`SELECT COUNT(*) as count FROM work_orders wo ${where}`, params);
    const total = (countResult[0]?.values[0]?.[0] as number) || 0;

    const { offset, limit: lim } = paginate(page, limit);
    params.push(lim, offset);
    const dataResult = await db.exec(
      `SELECT wo.*,
        a.assetName as assetName, a.assetCode as assetCode,
        u1.name as reportedByName,
        u2.name as supervisorName,
        u3.name as assignedToName
       FROM work_orders wo
       LEFT JOIN assets a ON wo.assetId = a.id
       LEFT JOIN users u1 ON wo.reportedById = u1.id
       LEFT JOIN users u2 ON wo.supervisorId = u2.id
       LEFT JOIN users u3 ON wo.assignedToId = u3.id
       ${where} ORDER BY wo.createdAt DESC LIMIT ? OFFSET ?`,
      params
    );

    return { data: formatRows(dataResult), total };
  }

  async getById(id: string): Promise<any> {
    const db = await getDb();
    const woResult = await db.exec(
      `SELECT wo.*, a.assetName, a.assetCode, u1.name as reportedByName, u2.name as supervisorName, u3.name as assignedToName
       FROM work_orders wo
       LEFT JOIN assets a ON wo.assetId = a.id
       LEFT JOIN users u1 ON wo.reportedById = u1.id
       LEFT JOIN users u2 ON wo.supervisorId = u2.id
       LEFT JOIN users u3 ON wo.assignedToId = u3.id
       WHERE wo.id = ?`, [id]
    );
    const wo = formatRow(woResult);
    if (!wo) throw new NotFoundError('Work Order not found');

    const histResult = await db.exec(
      `SELECT h.*, u.name as changedByName FROM work_order_status_history h
       LEFT JOIN users u ON h.changedBy = u.id WHERE h.woId = ? ORDER BY h.createdAt ASC`, [id]
    );
    wo.statusHistory = formatRows(histResult);

    const clResult = await db.exec(
      `SELECT c.*, u.name as completedByName FROM work_order_checklists c
       LEFT JOIN users u ON c.completedBy = u.id WHERE c.woId = ? ORDER BY c.id`, [id]
    );
    wo.checklists = formatRows(clResult);

    const attResult = await db.exec(
      `SELECT a.*, u.name as uploadedByName FROM work_order_attachments a
       LEFT JOIN users u ON a.uploadedBy = u.id WHERE a.woId = ? ORDER BY a.createdAt`, [id]
    );
    wo.attachments = formatRows(attResult);

    const spResult = await db.exec(
      `SELECT wsp.*, sp.itemCode, sp.itemName FROM work_order_spare_parts wsp
       LEFT JOIN spare_parts sp ON wsp.itemId = sp.id WHERE wsp.woId = ?`, [id]
    );
    wo.spareParts = formatRows(spResult);

    return wo;
  }

  async update(id: string, data: any): Promise<any> {
    const db = await getDb();
    await this.getById(id);

    const fields: string[] = [];
    const params: any[] = [];

    if (data.title !== undefined) { fields.push('title = ?'); params.push(data.title); }
    if (data.description !== undefined) { fields.push('description = ?'); params.push(data.description); }
    if (data.assetId !== undefined) { fields.push('assetId = ?'); params.push(data.assetId); }
    if (data.location !== undefined) { fields.push('location = ?'); params.push(data.location); }
    if (data.priority !== undefined) { fields.push('priority = ?'); params.push(data.priority); }
    if (data.dueDate !== undefined) { fields.push('dueDate = ?'); params.push(data.dueDate); }
    if (data.problemDescription !== undefined) { fields.push('problemDescription = ?'); params.push(data.problemDescription); }
    if (data.repairInstruction !== undefined) { fields.push('repairInstruction = ?'); params.push(data.repairInstruction); }
    if (data.workPerformed !== undefined) { fields.push('workPerformed = ?'); params.push(data.workPerformed); }
    if (data.rootCause !== undefined) { fields.push('rootCause = ?'); params.push(data.rootCause); }
    if (data.resolution !== undefined) { fields.push('resolution = ?'); params.push(data.resolution); }
    if (data.notes !== undefined) { fields.push('notes = ?'); params.push(data.notes); }

    if (fields.length > 0) {
      params.push(id);
      await db.run(`UPDATE work_orders SET ${fields.join(', ')} WHERE id = ?`, params);
  
    }

    return this.getById(id);
  }

  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.run('DELETE FROM work_orders WHERE id = ?', [id]);

  }

  async create(data: any, userId: string): Promise<any> {
    const db = await getDb();
    const id = generateId();

    const countResult = await db.exec("SELECT COUNT(*) as count FROM work_orders WHERE woNumber LIKE ?", [`WO-${new Date().getFullYear()}%`]);
    const woNumber = generateWoNumber((countResult[0]?.values[0]?.[0] as number) || 0);

    const now = nowISO();
    await db.run(
      `INSERT INTO work_orders (id, woNumber, title, description, assetId, location, reportedById, priority, status, dueDate, problemDescription, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?)`,
      [id, woNumber, data.title, data.description || null, data.assetId || null, data.location || null,
       userId, data.priority || 'MEDIUM', data.dueDate || null, data.problemDescription || null, now]
    );

    await db.run(
      "INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes) VALUES (?, ?, NULL, 'OPEN', ?, 'Work Order created')",
      [generateId(), id, userId]
    );

    const supervisorsResult = await db.exec("SELECT ur.userId FROM user_roles ur JOIN roles r ON ur.roleId = r.id WHERE r.name = 'SUPERVISOR'");
    const supervisors = formatRows(supervisorsResult);
    for (const row of supervisors) {
      await db.run(
        "INSERT INTO notifications (id, userId, type, title, message, referenceType, referenceId) VALUES (?, ?, 'NEW_WO', ?, ?, 'WORK_ORDER', ?)",
        [generateId(), row.userId, `New Work Order: ${woNumber}`, `${data.title} has been reported`, id]
      );
    }


    return this.getById(id);
  }

  async assign(id: string, data: any, supervisorId: string): Promise<any> {
    const db = await getDb();
    const wo = await this.getById(id);
    const isReassign = wo.status === 'ASSIGNED';
    if (!isReassign) {
      this.validateTransition(wo.status, 'ASSIGNED');
    }

    const now = nowISO();
    await db.run(
      "UPDATE work_orders SET assignedToId = ?, supervisorId = ?, repairInstruction = ?, dueDate = COALESCE(?, dueDate), assignedAt = ?, status = 'ASSIGNED' WHERE id = ?",
      [data.assignedToId, supervisorId, data.repairInstruction || null, data.dueDate || null, now, id]
    );

    await db.run(
      "INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes) VALUES (?, ?, ?, 'ASSIGNED', ?, ?)",
      [generateId(), id, wo.status, supervisorId, data.notes || 'Work Order assigned']
    );

    await db.run(
      "INSERT INTO notifications (id, userId, type, title, message, referenceType, referenceId) VALUES (?, ?, 'WO_ASSIGNED', ?, ?, 'WORK_ORDER', ?)",
      [generateId(), data.assignedToId, `Work Order Assigned: ${wo.woNumber}`, `${wo.title} has been assigned to you`, id]
    );


    return this.getById(id);
  }

  async start(id: string, userId: string): Promise<any> {
    const db = await getDb();
    const wo = await this.getById(id);
    this.validateTransition(wo.status, 'IN_PROGRESS');

    await db.run("UPDATE work_orders SET status = 'IN_PROGRESS', startedAt = ? WHERE id = ?", [nowISO(), id]);
    await db.run(
      "INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes) VALUES (?, ?, ?, 'IN_PROGRESS', ?, 'Work started')",
      [generateId(), id, wo.status, userId]
    );


    return this.getById(id);
  }

  async hold(id: string, userId: string, notes?: string): Promise<any> {
    const db = await getDb();
    const wo = await this.getById(id);
    this.validateTransition(wo.status, 'ON_HOLD');

    await db.run("UPDATE work_orders SET status = 'ON_HOLD' WHERE id = ?", [id]);
    await db.run(
      "INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes) VALUES (?, ?, ?, 'ON_HOLD', ?, ?)",
      [generateId(), id, wo.status, userId, notes || 'Work on hold']
    );


    return this.getById(id);
  }

  async resume(id: string, userId: string): Promise<any> {
    const db = await getDb();
    const wo = await this.getById(id);
    this.validateTransition(wo.status, 'IN_PROGRESS');

    await db.run("UPDATE work_orders SET status = 'IN_PROGRESS' WHERE id = ?", [id]);
    await db.run(
      "INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes) VALUES (?, ?, ?, 'IN_PROGRESS', ?, 'Work resumed')",
      [generateId(), id, wo.status, userId]
    );


    return this.getById(id);
  }

  async close(id: string, userId: string, data: any): Promise<any> {
    const db = await getDb();
    const wo = await this.getById(id);
    this.validateTransition(wo.status, 'CLOSED');

    const incompleteChecklistsResult = await db.exec(
      "SELECT id, title FROM work_order_checklists WHERE woId = ? AND required = 1 AND completed = 0", [id]
    );
    const incompleteChecklists = formatRows(incompleteChecklistsResult);
    if (incompleteChecklists.length > 0) {
      throw new BadRequestError(`Mandatory checklist items not completed: ${incompleteChecklists.map(r => r.title).join(', ')}`);
    }

    const now = nowISO();

    const usedPartsResult = await db.exec(
      "SELECT id, itemId, usedQuantity, unitCost, unit FROM work_order_spare_parts WHERE woId = ? AND usedQuantity > 0", [id]
    );
    const usedParts = formatRows(usedPartsResult);

    for (const part of usedParts) {
      const spResult = await db.exec("SELECT warehouseId FROM spare_parts WHERE id = ?", [part.itemId]);
      const spRow = formatRow(spResult);
      const warehouseId = spRow?.warehouseId;

      if (warehouseId && part.usedQuantity > 0) {
        await db.run(
          `INSERT INTO inventory_transactions (id, itemId, warehouseId, transactionType, quantity, unitCost, referenceType, referenceId, notes, createdBy, createdAt)
           VALUES (?, ?, ?, 'OUT', ?, ?, 'WORK_ORDER', ?, ?, ?, ?)`,
          [generateId(), part.itemId, warehouseId, part.usedQuantity, part.unitCost || 0, id, `WO ${wo.woNumber} spare part usage`, userId, now]
        );

        await db.run("UPDATE spare_parts SET currentStock = currentStock - ? WHERE id = ?", [part.usedQuantity, part.itemId]);

        const spDataResult = await db.exec("SELECT currentStock, minimumStock, itemCode, itemName, unit, warehouseId FROM spare_parts WHERE id = ?", [part.itemId]);
        const spData = formatRow(spDataResult);
        if (spData) {
          if ((spData.currentStock as number) <= (spData.minimumStock as number) && (spData.minimumStock as number) > 0) {
            const adminsResult = await db.exec("SELECT ur.userId FROM user_roles ur JOIN roles r ON ur.roleId = r.id WHERE r.name = 'ADMIN'");
            const admins = formatRows(adminsResult);
            for (const adminRow of admins) {
              await db.run(
                "INSERT INTO notifications (id, userId, type, title, message, referenceType, referenceId) VALUES (?, ?, 'LOW_STOCK', ?, ?, 'SPARE_PART', ?)",
                [generateId(), adminRow.userId, `Low Stock Alert: ${spData.itemName}`, `Stock for ${spData.itemCode} is below minimum (${spData.currentStock}/${spData.minimumStock})`, part.itemId]
              );
            }

            await db.run(
              `INSERT INTO purchase_requisitions (id, itemId, quantity, unit, reason, currentStock, minimumStock, status, createdAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
              [generateId(), part.itemId, (spData.minimumStock as number) * 2 - (spData.currentStock as number), spData.unit || 'PCS',
               'Auto-generated from low stock alert', spData.currentStock, spData.minimumStock, now]
            );
          }
        }
      }

      await db.run("UPDATE work_order_spare_parts SET totalCost = usedQuantity * unitCost WHERE id = ?", [part.id]);
    }

    await db.run(
      "UPDATE work_orders SET status = 'CLOSED', closedAt = ?, completedAt = ?, workPerformed = ?, rootCause = ?, resolution = ?, notes = COALESCE(?, notes) WHERE id = ?",
      [now, now, data.workPerformed || null, data.rootCause || null, data.resolution || null, data.notes || null, id]
    );

    await db.run(
      "INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes) VALUES (?, ?, ?, 'CLOSED', ?, ?)",
      [generateId(), id, wo.status, userId, data.notes || 'Work Order closed']
    );

    await db.run(
      `INSERT INTO integration_jobs (id, type, provider, referenceType, referenceId, payload, status, idempotencyKey, createdAt)
       VALUES (?, 'WO_CLOSE', 'zahir', 'WORK_ORDER', ?, ?, 'PENDING', ?, ?)`,
      [generateId(), id, JSON.stringify({ woId: id, woNumber: wo.woNumber }), `CMMS-WO-${id}-CLOSE`, now]
    );

    await db.run(
      "INSERT INTO audit_logs (id, userId, action, entity, entityId, newValue, createdAt) VALUES (?, ?, 'CLOSE', 'WORK_ORDER', ?, ?, ?)",
      [generateId(), userId, id, JSON.stringify({ status: 'CLOSED', workPerformed: data.workPerformed }), now]
    );

    await db.run(
      "INSERT INTO notifications (id, userId, type, title, message, referenceType, referenceId) VALUES (?, ?, 'WO_CLOSED', ?, ?, 'WORK_ORDER', ?)",
      [generateId(), wo.reportedById, `Work Order Closed: ${wo.woNumber}`, `${wo.title} has been completed`, id]
    );

    return this.getById(id);
  }

  private validateTransition(currentStatus: string, newStatus: string): void {
    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BadRequestError(`Cannot transition from ${currentStatus} to ${newStatus}`);
    }
  }

  async addChecklist(woId: string, data: any): Promise<any> {
    const db = await getDb();
    const id = generateId();
    const title = data.title || data.description || 'Untitled';
    await db.run(
      "INSERT INTO work_order_checklists (id, woId, title, description, required) VALUES (?, ?, ?, ?, ?)",
      [id, woId, title, data.description || null, data.required !== false ? 1 : 0]
    );

    return { id, woId, title, description: data.description || null, required: data.required !== false, completed: false };
  }

  async getChecklist(woId: string): Promise<any[]> {
    const db = await getDb();
    const result = await db.exec(
      `SELECT c.*, u.name as completedByName FROM work_order_checklists c
       LEFT JOIN users u ON c.completedBy = u.id WHERE c.woId = ? ORDER BY c.id`, [woId]
    );
    return formatRows(result);
  }

  async updateChecklist(woId: string, checklistId: string, data: any, userId: string): Promise<any> {
    const db = await getDb();
    const existingResult = await db.exec("SELECT id FROM work_order_checklists WHERE id = ? AND woId = ?", [checklistId, woId]);
    const existing = formatRow(existingResult);
    if (!existing) {
      throw new NotFoundError('Checklist item not found');
    }

    const isCompleted = data.isCompleted !== undefined ? data.isCompleted : data.completed;
    const now = nowISO();

    if (isCompleted) {
      await db.run(
        "UPDATE work_order_checklists SET completed = 1, completedBy = ?, completedAt = ?, notes = COALESCE(?, notes) WHERE id = ? AND woId = ?",
        [userId, now, data.notes || null, checklistId, woId]
      );
    } else {
      await db.run(
        "UPDATE work_order_checklists SET completed = 0, completedBy = NULL, completedAt = NULL, notes = COALESCE(?, notes) WHERE id = ? AND woId = ?",
        [data.notes || null, checklistId, woId]
      );
    }

    const result = await db.exec("SELECT * FROM work_order_checklists WHERE id = ?", [checklistId]);
    const row = formatRow(result);
    if (!row) throw new NotFoundError('Checklist item not found');

    return row;
  }

  async deleteChecklist(woId: string, checklistId: string): Promise<void> {
    const db = await getDb();
    const existing = await db.exec("SELECT id FROM work_order_checklists WHERE id = ? AND woId = ?", [checklistId, woId]);
    if (!existing[0] || !existing[0].values.length) {
      throw new NotFoundError('Checklist item not found');
    }
    await db.run("DELETE FROM work_order_checklists WHERE id = ? AND woId = ?", [checklistId, woId]);

  }

  async addAttachment(woId: string, file: any, userId: string): Promise<any> {
    const db = await getDb();
    const id = generateId();
    const now = nowISO();
    await db.run(
      "INSERT INTO work_order_attachments (id, woId, filename, originalName, mimeType, path, size, uploadedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, woId, file.filename, file.originalname, file.mimetype, file.path, file.size, userId, now]
    );

    return { id, woId, filename: file.filename, originalName: file.originalname };
  }

  async getAttachments(woId: string): Promise<any[]> {
    const db = await getDb();
    const result = await db.exec(
      `SELECT a.*, u.name as uploadedByName FROM work_order_attachments a
       LEFT JOIN users u ON a.uploadedBy = u.id WHERE a.woId = ? ORDER BY a.createdAt DESC`, [woId]
    );
    return formatRows(result);
  }

  async deleteAttachment(woId: string, attachmentId: string): Promise<void> {
    const db = await getDb();
    const existing = await db.exec("SELECT id FROM work_order_attachments WHERE id = ? AND woId = ?", [attachmentId, woId]);
    if (!existing[0] || !existing[0].values.length) {
      throw new NotFoundError('Attachment not found');
    }
    await db.run("DELETE FROM work_order_attachments WHERE id = ? AND woId = ?", [attachmentId, woId]);

  }

  async addSparePart(woId: string, data: any): Promise<any> {
    const db = await getDb();
    const id = generateId();
    await db.run(
      "INSERT INTO work_order_spare_parts (id, woId, itemId, plannedQuantity, unit, unitCost, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, woId, data.itemId, data.plannedQuantity || 0, data.unit || 'PCS', data.unitCost || 0, nowISO()]
    );
    const result = await db.exec("SELECT wsp.*, sp.itemCode, sp.itemName FROM work_order_spare_parts wsp LEFT JOIN spare_parts sp ON wsp.itemId = sp.id WHERE wsp.id = ?", [id]);

    return formatRow(result);
  }

  async updateSparePart(woId: string, sparePartId: string, data: any): Promise<any> {
    const db = await getDb();
    const existingResult = await db.exec("SELECT id FROM work_order_spare_parts WHERE id = ? AND woId = ?", [sparePartId, woId]);
    const existing = formatRow(existingResult);
    if (!existing) {
      throw new NotFoundError('Spare part not found');
    }

    if (data.usedQuantity !== undefined) {
      await db.run("UPDATE work_order_spare_parts SET usedQuantity = ?, totalCost = ? * unitCost WHERE id = ? AND woId = ?",
        [data.usedQuantity, data.usedQuantity, sparePartId, woId]);
    }
    if (data.plannedQuantity !== undefined) {
      await db.run("UPDATE work_order_spare_parts SET plannedQuantity = ? WHERE id = ? AND woId = ?",
        [data.plannedQuantity, sparePartId, woId]);
    }

    const result = await db.exec("SELECT wsp.*, sp.itemCode, sp.itemName FROM work_order_spare_parts wsp LEFT JOIN spare_parts sp ON wsp.itemId = sp.id WHERE wsp.id = ?", [sparePartId]);

    return formatRow(result);
  }
}

export const workOrderService = new WorkOrderService();
