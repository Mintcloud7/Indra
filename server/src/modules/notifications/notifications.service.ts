import { getDb, saveDb } from '../../database/connection';
import { generateId, nowISO, paginate } from '../../shared/utils';
import { NotFoundError } from '../../shared/errors';

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

export class NotificationService {
  async list(userId: string, page: number = 1, limit: number = 20, unreadOnly: boolean = false): Promise<{ data: any[]; total: number }> {
    const db = await getDb();
    let where = 'WHERE n.userId = ?';
    const params: any[] = [userId];

    if (unreadOnly) {
      where += ' AND n.read = 0';
    }

    const countResult = db.exec(`SELECT COUNT(*) as count FROM notifications n ${where}`, params);
    const total = (countResult[0]?.values[0]?.[0] as number) || 0;

    const { offset, limit: lim } = paginate(page, limit);
    params.push(lim, offset);
    const dataResult = db.exec(
      `SELECT n.* FROM notifications n ${where} ORDER BY n.createdAt DESC LIMIT ? OFFSET ?`,
      params
    );

    return { data: formatRows(dataResult), total };
  }

  async getById(id: string): Promise<any> {
    const db = await getDb();
    const result = db.exec('SELECT * FROM notifications WHERE id = ?', [id]);
    const row = formatRow(result);
    if (!row) {
      throw new NotFoundError('Notification not found');
    }
    return row;
  }

  async markAsRead(id: string, userId: string): Promise<any> {
    const db = await getDb();
    const existingResult = db.exec('SELECT * FROM notifications WHERE id = ? AND userId = ?', [id, userId]);
    const existing = formatRow(existingResult);
    if (!existing) {
      throw new NotFoundError('Notification not found');
    }

    db.run('UPDATE notifications SET read = 1 WHERE id = ? AND userId = ?', [id, userId]);
    saveDb();
    return this.getById(id);
  }

  async markAllAsRead(userId: string): Promise<void> {
    const db = await getDb();
    db.run('UPDATE notifications SET read = 1 WHERE userId = ? AND read = 0', [userId]);
    saveDb();
  }

  async create(userId: string, type: string, title: string, message: string, referenceType?: string, referenceId?: string): Promise<any> {
    const db = await getDb();
    const id = generateId();
    const now = nowISO();

    db.run(
      `INSERT INTO notifications (id, userId, type, title, message, referenceType, referenceId, read, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [id, userId, type, title, message, referenceType || null, referenceId || null, now]
    );

    saveDb();
    const result = db.exec('SELECT * FROM notifications WHERE id = ?', [id]);
    return formatRow(result);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const db = await getDb();
    const result = db.exec('SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND read = 0', [userId]);
    return (result[0]?.values[0]?.[0] as number) || 0;
  }
}

export const notificationService = new NotificationService();
