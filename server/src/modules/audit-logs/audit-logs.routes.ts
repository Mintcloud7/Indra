import { Router } from 'express';
import { AuthRequest } from '../../shared/types';
import { sendPaginated, sendSuccess } from '../../shared/response';
import { getDb } from '../../database/connection';
import { paginate } from '../../shared/utils';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

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

router.use(authenticate);

router.get('/', requirePermission('audit_logs', 'read'), async (req: AuthRequest, res, next) => {
  try {
    const db = await getDb();
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const { offset, limit: lim } = paginate(page, limit);

    let whereClause = '';
    const params: any[] = [];

    const action = req.query.action as string | undefined;
    const entity = req.query.entity as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    if (action) {
      whereClause += ' AND al.action = ?';
      params.push(action);
    }
    if (entity) {
      whereClause += ' AND al.entity = ?';
      params.push(entity);
    }
    if (startDate) {
      whereClause += ' AND al.createdAt >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND al.createdAt <= ?';
      params.push(endDate + 'T23:59:59');
    }

    const countParams = [...params];
    const countResult = await db.exec(
      `SELECT COUNT(*) as total FROM audit_logs al WHERE 1=1 ${whereClause}`,
      countParams
    );
    const total = (countResult[0]?.values[0]?.[0] as number) || 0;

    params.push(lim, offset);
    const dataResult = await db.exec(
      `SELECT al.*, u.name as userName, u.email as userEmail
       FROM audit_logs al
       LEFT JOIN users u ON al.userId = u.id
       WHERE 1=1 ${whereClause}
       ORDER BY al.createdAt DESC LIMIT ? OFFSET ?`,
      params
    );

    const data = formatRows(dataResult);

    for (const obj of data) {
      if (obj.oldValue && typeof obj.oldValue === 'string') {
        try { obj.oldValue = JSON.parse(obj.oldValue); } catch {}
      }
      if (obj.newValue && typeof obj.newValue === 'string') {
        try { obj.newValue = JSON.parse(obj.newValue); } catch {}
      }
      obj.user = obj.userName ? { name: obj.userName, email: obj.userEmail } : undefined;
    }

    sendPaginated(res, data, total, page, limit);
  } catch (err) {
    next(err);
  }
});

export default router;
