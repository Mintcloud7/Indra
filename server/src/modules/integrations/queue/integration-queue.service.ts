import { getDb } from '../../../database/connection';
import { generateId, nowISO } from '../../../shared/utils';
import { NotFoundError, BadRequestError } from '../../../shared/errors';
import { adapterRegistry, SUPPORTED_PROVIDERS } from '../adapters/adapter-registry';
import { IIntegrationAdapter } from '../adapters/integration-adapter';

const RETRY_SCHEDULE_SECONDS = [60, 300, 900, 1800, 3600];
const MAX_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 30_000;

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

export class IntegrationQueueService {
  private schedulerTimer: NodeJS.Timeout | null = null;

  async createJob(
    type: string,
    referenceType: string | null,
    referenceId: string | null,
    payload: any,
    idempotencyKey?: string,
    provider?: string
  ): Promise<any> {
    const db = await getDb();
    const now = nowISO();

    if (idempotencyKey) {
      const existingResult = await db.exec(
        "SELECT * FROM integration_jobs WHERE idempotencyKey = ? AND status NOT IN ('FAILED', 'DEAD_LETTER')",
        [idempotencyKey]
      );
      const existing = formatRow(existingResult);
      if (existing) return existing;
    }

    const id = generateId();
    const nextRetry = new Date(Date.now() + RETRY_SCHEDULE_SECONDS[0] * 1000).toISOString();
    const jobProvider = provider || 'zahir';

    await db.run(
      `INSERT INTO integration_jobs (id, type, provider, referenceType, referenceId, payload, status, attempts, maxAttempts, nextRetryAt, idempotencyKey, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?, ?, ?)`,
      [id, type, jobProvider, referenceType || null, referenceId || null, JSON.stringify(payload), MAX_ATTEMPTS, nextRetry, idempotencyKey || null, now]
    );

    await this.createLog(type, jobProvider, referenceType, referenceId, 'CREATED', null, null, 200, `Job created: ${type}`);

    const result = await db.exec('SELECT * FROM integration_jobs WHERE id = ?', [id]);
    return formatRow(result);
  }

  async processNextJob(): Promise<any> {
    const db = await getDb();
    const now = nowISO();

    const jobResult = await db.exec(
      `SELECT * FROM integration_jobs
       WHERE status = 'PENDING' AND nextRetryAt <= ?
       ORDER BY createdAt ASC LIMIT 1`,
      [now]
    );
    const job = formatRow(jobResult);
    if (!job) return null;

    await db.run(
      "UPDATE integration_jobs SET status = 'PROCESSING', processedAt = ? WHERE id = ?",
      [now, job.id]
    );

    try {
      const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
      const provider = job.provider || 'zahir';
      const adapter = await adapterRegistry.getAdapter(provider);

      let result: { success: boolean; externalId?: string; error?: string };

      switch (job.type) {
        case 'INVENTORY_SYNC':
          result = await adapter.syncInventoryItem(payload);
          break;
        case 'PURCHASE_REQ_SYNC':
          result = await adapter.syncPurchaseRequisition(payload);
          break;
        case 'ASSET_SYNC':
          result = await adapter.syncFixedAsset(payload);
          break;
        case 'STOCK_ADJUSTMENT':
          result = await adapter.sendStockAdjustment(payload);
          break;
        case 'WO_CLOSE':
          result = await adapter.syncWorkOrderClose(payload);
          break;
        default:
          result = { success: false, error: `Unknown job type: ${job.type}` };
      }

      const newAttempts = job.attempts + 1;

      if (result.success) {
        await db.run(
          "UPDATE integration_jobs SET status = 'SUCCESS', attempts = ?, processedAt = ?, externalId = ? WHERE id = ?",
          [newAttempts, now, result.externalId || null, job.id]
        );
        await this.createLog(job.type, provider, job.referenceType, job.referenceId, 'SUCCESS', result.externalId, null, 200, `Synced successfully`);
      } else {
        if (newAttempts >= job.maxAttempts) {
          await db.run(
            "UPDATE integration_jobs SET status = 'DEAD_LETTER', attempts = ?, lastError = ?, processedAt = ? WHERE id = ?",
            [newAttempts, result.error || 'Max attempts reached', now, job.id]
          );
          await this.createLog(job.type, provider, job.referenceType, job.referenceId, 'DEAD_LETTER', null, result.error, 500, result.error || 'Max attempts reached');
        } else {
          const nextRetrySeconds = RETRY_SCHEDULE_SECONDS[Math.min(newAttempts, RETRY_SCHEDULE_SECONDS.length - 1)];
          const nextRetry = new Date(Date.now() + nextRetrySeconds * 1000).toISOString();
          await db.run(
            "UPDATE integration_jobs SET status = 'PENDING', attempts = ?, lastError = ?, nextRetryAt = ? WHERE id = ?",
            [newAttempts, result.error || null, nextRetry, job.id]
          );
          await this.createLog(job.type, provider, job.referenceType, job.referenceId, 'RETRY', null, result.error, 500, result.error || `Retry ${newAttempts}/${job.maxAttempts}`);
        }
      }

      return { jobId: job.id, status: result.success ? 'SUCCESS' : 'FAILED', error: result.error };
    } catch (err: any) {
      const newAttempts = job.attempts + 1;
      const provider = job.provider || 'zahir';
      if (newAttempts >= job.maxAttempts) {
        await db.run(
          "UPDATE integration_jobs SET status = 'DEAD_LETTER', attempts = ?, lastError = ?, processedAt = ? WHERE id = ?",
          [newAttempts, err.message, now, job.id]
        );
        await this.createLog(job.type, provider, job.referenceType, job.referenceId, 'DEAD_LETTER', null, err.message, 500, err.message);
      } else {
        const nextRetrySeconds = RETRY_SCHEDULE_SECONDS[Math.min(newAttempts, RETRY_SCHEDULE_SECONDS.length - 1)];
        const nextRetry = new Date(Date.now() + nextRetrySeconds * 1000).toISOString();
        await db.run(
          "UPDATE integration_jobs SET status = 'PENDING', attempts = ?, lastError = ?, nextRetryAt = ? WHERE id = ?",
          [newAttempts, err.message, nextRetry, job.id]
        );
        await this.createLog(job.type, provider, job.referenceType, job.referenceId, 'ERROR', null, err.message, 500, err.message);
      }
      return { jobId: job.id, status: 'FAILED', error: err.message };
    }
  }

  async retryJob(id: string): Promise<any> {
    const db = await getDb();
    const jobResult = await db.exec("SELECT * FROM integration_jobs WHERE id = ?", [id]);
    const job = formatRow(jobResult);
    if (!job) throw new NotFoundError('Integration job not found');
    if (job.status !== 'FAILED' && job.status !== 'DEAD_LETTER') {
      throw new BadRequestError('Only FAILED or DEAD_LETTER jobs can be retried');
    }

    const nextRetry = new Date(Date.now() + RETRY_SCHEDULE_SECONDS[0] * 1000).toISOString();
    await db.run(
      "UPDATE integration_jobs SET status = 'PENDING', attempts = 0, nextRetryAt = ?, lastError = NULL WHERE id = ?",
      [nextRetry, id]
    );

    await this.createLog(job.type, job.provider || 'zahir', job.referenceType, job.referenceId, 'MANUAL_RETRY', null, null, 200, 'Manually queued for retry');

    const result = await db.exec('SELECT * FROM integration_jobs WHERE id = ?', [id]);
    return formatRow(result);
  }

  async processAllPending(): Promise<{ processed: number; results: any[] }> {
    const results: any[] = [];
    let processed = 0;
    const maxBatch = 50;

    for (let i = 0; i < maxBatch; i++) {
      const result = await this.processNextJob();
      if (!result) break;
      results.push(result);
      processed++;
    }

    return { processed, results };
  }

  startScheduler(intervalMs: number = POLL_INTERVAL_MS): void {
    if (this.schedulerTimer) return;
    this.schedulerTimer = setInterval(async () => {
      try {
        await this.processAllPending();
      } catch (err) {
        console.error('Integration queue scheduler error:', err);
      }
    }, intervalMs);
    console.log(`Integration queue scheduler started (interval: ${intervalMs}ms)`);
  }

  stopScheduler(): void {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
      console.log('Integration queue scheduler stopped');
    }
  }

  async getJobs(filters: any = {}): Promise<any[]> {
    const db = await getDb();
    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (filters.status) { where += ' AND status = ?'; params.push(filters.status); }
    if (filters.type) { where += ' AND type = ?'; params.push(filters.type); }
    if (filters.provider) { where += ' AND provider = ?'; params.push(filters.provider); }

    const result = await db.exec(
      `SELECT * FROM integration_jobs ${where} ORDER BY createdAt DESC`,
      params
    );
    return formatRows(result);
  }

  async getLogs(filters: any = {}): Promise<any[]> {
    const db = await getDb();
    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (filters.type) { where += ' AND type = ?'; params.push(filters.type); }
    if (filters.status) { where += ' AND status = ?'; params.push(filters.status); }
    if (filters.provider) { where += ' AND provider = ?'; params.push(filters.provider); }
    if (filters.referenceType) { where += ' AND referenceType = ?'; params.push(filters.referenceType); }

    const result = await db.exec(
      `SELECT * FROM integration_logs ${where} ORDER BY createdAt DESC`,
      params
    );
    return formatRows(result);
  }

  async getDeadLetterJobs(): Promise<any[]> {
    const db = await getDb();
    const result = await db.exec(
      "SELECT * FROM integration_jobs WHERE status = 'DEAD_LETTER' ORDER BY createdAt DESC"
    );
    return formatRows(result);
  }

  private async createLog(
    type: string,
    provider: string,
    referenceType: string | null,
    referenceId: string | null,
    status: string,
    externalId: string | null,
    error: string | null,
    responseStatus: number | null,
    responseMessage: string | null
  ): Promise<void> {
    try {
      const db = await getDb();
      await db.run(
        `INSERT INTO integration_logs (id, type, provider, referenceType, referenceId, status, externalId, error, responseStatus, responseMessage, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(), type, provider, referenceType || null, referenceId || null,
          status, externalId || null, error || null,
          responseStatus || null, responseMessage || null, nowISO()
        ]
      );
    } catch (err) {
      console.error('Failed to create integration log:', err);
    }
  }
}

export const integrationQueueService = new IntegrationQueueService();
