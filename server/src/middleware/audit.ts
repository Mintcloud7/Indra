import { Request } from 'express';
import { getDb } from '../database/connection';
import { generateId, nowISO, sanitizeForLog } from '../shared/utils';

export async function logAudit(
  userId: string | undefined,
  action: string,
  entity: string,
  entityId: string | undefined,
  oldValue: any,
  newValue: any,
  req: Request
): Promise<void> {
  try {
    const db = await getDb();
    db.run(
      `INSERT INTO audit_logs (id, userId, action, entity, entityId, oldValue, newValue, ipAddress, userAgent, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        userId || null,
        action,
        entity,
        entityId || null,
        oldValue ? JSON.stringify(sanitizeForLog(oldValue)) : null,
        newValue ? JSON.stringify(sanitizeForLog(newValue)) : null,
        req.ip || req.socket.remoteAddress || null,
        req.headers['user-agent'] || null,
        nowISO()
      ]
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
}
