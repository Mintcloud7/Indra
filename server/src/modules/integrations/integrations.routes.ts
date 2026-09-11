import { Router } from 'express';
import { AuthRequest } from '../../shared/types';
import { sendSuccess, sendPaginated } from '../../shared/response';
import { getDb } from '../../database/connection';
import { paginate, generateId } from '../../shared/utils';
import { adapterRegistry, SUPPORTED_PROVIDERS } from './adapters/adapter-registry';
import { integrationQueueService } from './queue/integration-queue.service';

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

router.get('/providers', (req: AuthRequest, res, next) => {
  try {
    sendSuccess(res, SUPPORTED_PROVIDERS);
  } catch (err) { next(err); }
});

router.get('/:provider/config', async (req: AuthRequest, res, next) => {
  try {
    const { provider } = req.params;
    const db = await getDb();
    const prefix = `${provider}_`;
    const result = db.exec(
      "SELECT key, value, description FROM integration_configs WHERE key LIKE ?",
      [`${prefix}%`]
    );
    const rows = formatRows(result);
    const configs: Record<string, any> = {};
    for (const row of rows) {
      const field = row.key.replace(prefix, '');
      configs[field] = { value: row.value, description: row.description };
    }
    sendSuccess(res, configs);
  } catch (err) { next(err); }
});

router.put('/:provider/config', async (req: AuthRequest, res, next) => {
  try {
    const { provider } = req.params;
    const db = await getDb();
    const now = new Date().toISOString();
    const body = req.body;

    const fieldMap: Record<string, string> = {
      apiUrl: 'api_url',
      apiKey: 'api_key',
      companyId: 'company_id',
      tenantId: 'tenant_id',
      realmId: 'realm_id',
      accessToken: 'access_token',
      useMock: 'use_mock',
    };

    const descMap: Record<string, string> = {
      api_url: `${provider} API URL`,
      api_key: `${provider} API Key`,
      company_id: `${provider} Company ID`,
      tenant_id: `${provider} Tenant ID`,
      realm_id: `${provider} Realm ID`,
      access_token: `${provider} Access Token`,
      use_mock: 'Use mock adapter',
    };

    for (const [jsKey, dbKey] of Object.entries(fieldMap)) {
      if (body[jsKey] !== undefined) {
        const key = `${provider}_${dbKey}`;
        const value = String(body[jsKey]);
        const desc = descMap[dbKey] || key;

        const existingResult = db.exec("SELECT key FROM integration_configs WHERE key = ?", [key]);
        const existing = formatRow(existingResult);
        if (existing) {
          db.run("UPDATE integration_configs SET value = ?, updatedAt = ? WHERE key = ?", [value, now, key]);
        } else {
          db.run(
            "INSERT INTO integration_configs (id, key, value, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
            [generateId(), key, value, desc, now, now]
          );
        }
      }
    }

    adapterRegistry.invalidateCache(provider);
    sendSuccess(res, { message: `${provider} configuration saved` });
  } catch (err) { next(err); }
});

router.post('/:provider/test', async (req: AuthRequest, res, next) => {
  try {
    const { provider } = req.params;
    const adapter = await adapterRegistry.getAdapter(provider);
    const success = await adapter.testConnection();
    sendSuccess(res, { success, message: success ? 'Connection successful' : 'Connection failed' });
  } catch (err) { next(err); }
});

router.get('/jobs', async (req: AuthRequest, res, next) => {
  try {
    const jobs = await integrationQueueService.getJobs({
      status: req.query.status,
      type: req.query.type,
      provider: req.query.provider,
    });
    sendSuccess(res, jobs);
  } catch (err) { next(err); }
});

router.post('/jobs/:id/retry', async (req: AuthRequest, res, next) => {
  try {
    const job = await integrationQueueService.retryJob(req.params.id);
    sendSuccess(res, job);
  } catch (err) { next(err); }
});

router.post('/process', async (req: AuthRequest, res, next) => {
  try {
    const result = await integrationQueueService.processAllPending();
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

router.get('/logs', async (req: AuthRequest, res, next) => {
  try {
    const db = await getDb();
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const { offset, limit: lim } = paginate(page, limit);

    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (req.query.provider) { where += ' AND provider = ?'; params.push(req.query.provider); }
    if (req.query.type) { where += ' AND type = ?'; params.push(req.query.type); }
    if (req.query.status) { where += ' AND status = ?'; params.push(req.query.status); }

    const countResult = db.exec(`SELECT COUNT(*) as total FROM integration_logs ${where}`, params);
    const total = (countResult[0]?.values[0]?.[0] as number) || 0;

    const dataResult = db.exec(
      `SELECT * FROM integration_logs ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      [...params, lim, offset]
    );
    const data = formatRows(dataResult);

    sendPaginated(res, data, total, page, limit);
  } catch (err) { next(err); }
});

router.get('/failed-jobs', async (req: AuthRequest, res, next) => {
  try {
    const db = await getDb();
    let where = "WHERE status IN ('FAILED', 'DEAD_LETTER')";
    const params: any[] = [];
    if (req.query.provider) { where += ' AND provider = ?'; params.push(req.query.provider); }

    const dataResult = db.exec(
      `SELECT * FROM integration_jobs ${where} ORDER BY createdAt DESC LIMIT 50`,
      params
    );
    const data = formatRows(dataResult);

    for (const obj of data) {
      if (obj.payload && typeof obj.payload === 'string') {
        try { obj.payload = JSON.parse(obj.payload); } catch {}
      }
    }

    sendSuccess(res, data);
  } catch (err) { next(err); }
});

export default router;
