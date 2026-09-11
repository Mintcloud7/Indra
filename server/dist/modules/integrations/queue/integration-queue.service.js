"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrationQueueService = exports.IntegrationQueueService = void 0;
const connection_1 = require("../../../database/connection");
const utils_1 = require("../../../shared/utils");
const errors_1 = require("../../../shared/errors");
const adapter_registry_1 = require("../adapters/adapter-registry");
const RETRY_SCHEDULE_SECONDS = [60, 300, 900, 1800, 3600];
const MAX_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 30_000;
function formatRow(result, index = 0) {
    if (!result[0] || !result[0].values[index])
        return null;
    const obj = {};
    result[0].columns.forEach((col, i) => {
        obj[col] = result[0].values[index][i];
    });
    return obj;
}
function formatRows(result) {
    if (!result[0])
        return [];
    return result[0].values.map((row) => {
        const obj = {};
        result[0].columns.forEach((col, i) => {
            obj[col] = row[i];
        });
        return obj;
    });
}
class IntegrationQueueService {
    schedulerTimer = null;
    async createJob(type, referenceType, referenceId, payload, idempotencyKey, provider) {
        const db = await (0, connection_1.getDb)();
        const now = (0, utils_1.nowISO)();
        if (idempotencyKey) {
            const existingResult = await db.exec("SELECT * FROM integration_jobs WHERE idempotencyKey = ? AND status NOT IN ('FAILED', 'DEAD_LETTER')", [idempotencyKey]);
            const existing = formatRow(existingResult);
            if (existing)
                return existing;
        }
        const id = (0, utils_1.generateId)();
        const nextRetry = new Date(Date.now() + RETRY_SCHEDULE_SECONDS[0] * 1000).toISOString();
        const jobProvider = provider || 'zahir';
        await db.run(`INSERT INTO integration_jobs (id, type, provider, referenceType, referenceId, payload, status, attempts, maxAttempts, nextRetryAt, idempotencyKey, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?, ?, ?)`, [id, type, jobProvider, referenceType || null, referenceId || null, JSON.stringify(payload), MAX_ATTEMPTS, nextRetry, idempotencyKey || null, now]);
        await this.createLog(type, jobProvider, referenceType, referenceId, 'CREATED', null, null, 200, `Job created: ${type}`);
        const result = db.exec('SELECT * FROM integration_jobs WHERE id = ?', [id]);
        (0, connection_1.saveDb)();
        return formatRow(result);
    }
    async processNextJob() {
        const db = await (0, connection_1.getDb)();
        const now = (0, utils_1.nowISO)();
        const jobResult = db.exec(`SELECT * FROM integration_jobs
       WHERE status = 'PENDING' AND nextRetryAt <= ?
       ORDER BY createdAt ASC LIMIT 1`, [now]);
        const job = formatRow(jobResult);
        if (!job)
            return null;
        db.run("UPDATE integration_jobs SET status = 'PROCESSING', processedAt = ? WHERE id = ?", [now, job.id]);
        try {
            const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
            const provider = job.provider || 'zahir';
            const adapter = await adapter_registry_1.adapterRegistry.getAdapter(provider);
            let result;
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
                db.run("UPDATE integration_jobs SET status = 'SUCCESS', attempts = ?, processedAt = ?, externalId = ? WHERE id = ?", [newAttempts, now, result.externalId || null, job.id]);
                await this.createLog(job.type, provider, job.referenceType, job.referenceId, 'SUCCESS', result.externalId, null, 200, `Synced successfully`);
            }
            else {
                if (newAttempts >= job.maxAttempts) {
                    db.run("UPDATE integration_jobs SET status = 'DEAD_LETTER', attempts = ?, lastError = ?, processedAt = ? WHERE id = ?", [newAttempts, result.error || 'Max attempts reached', now, job.id]);
                    await this.createLog(job.type, provider, job.referenceType, job.referenceId, 'DEAD_LETTER', null, result.error, 500, result.error || 'Max attempts reached');
                }
                else {
                    const nextRetrySeconds = RETRY_SCHEDULE_SECONDS[Math.min(newAttempts, RETRY_SCHEDULE_SECONDS.length - 1)];
                    const nextRetry = new Date(Date.now() + nextRetrySeconds * 1000).toISOString();
                    db.run("UPDATE integration_jobs SET status = 'PENDING', attempts = ?, lastError = ?, nextRetryAt = ? WHERE id = ?", [newAttempts, result.error || null, nextRetry, job.id]);
                    await this.createLog(job.type, provider, job.referenceType, job.referenceId, 'RETRY', null, result.error, 500, result.error || `Retry ${newAttempts}/${job.maxAttempts}`);
                }
            }
            (0, connection_1.saveDb)();
            return { jobId: job.id, status: result.success ? 'SUCCESS' : 'FAILED', error: result.error };
        }
        catch (err) {
            const newAttempts = job.attempts + 1;
            const provider = job.provider || 'zahir';
            if (newAttempts >= job.maxAttempts) {
                db.run("UPDATE integration_jobs SET status = 'DEAD_LETTER', attempts = ?, lastError = ?, processedAt = ? WHERE id = ?", [newAttempts, err.message, now, job.id]);
                await this.createLog(job.type, provider, job.referenceType, job.referenceId, 'DEAD_LETTER', null, err.message, 500, err.message);
            }
            else {
                const nextRetrySeconds = RETRY_SCHEDULE_SECONDS[Math.min(newAttempts, RETRY_SCHEDULE_SECONDS.length - 1)];
                const nextRetry = new Date(Date.now() + nextRetrySeconds * 1000).toISOString();
                db.run("UPDATE integration_jobs SET status = 'PENDING', attempts = ?, lastError = ?, nextRetryAt = ? WHERE id = ?", [newAttempts, err.message, nextRetry, job.id]);
                await this.createLog(job.type, provider, job.referenceType, job.referenceId, 'ERROR', null, err.message, 500, err.message);
            }
            (0, connection_1.saveDb)();
            return { jobId: job.id, status: 'FAILED', error: err.message };
        }
    }
    async retryJob(id) {
        const db = await (0, connection_1.getDb)();
        const jobResult = db.exec("SELECT * FROM integration_jobs WHERE id = ?", [id]);
        const job = formatRow(jobResult);
        if (!job)
            throw new errors_1.NotFoundError('Integration job not found');
        if (job.status !== 'FAILED' && job.status !== 'DEAD_LETTER') {
            throw new errors_1.BadRequestError('Only FAILED or DEAD_LETTER jobs can be retried');
        }
        const nextRetry = new Date(Date.now() + RETRY_SCHEDULE_SECONDS[0] * 1000).toISOString();
        db.run("UPDATE integration_jobs SET status = 'PENDING', attempts = 0, nextRetryAt = ?, lastError = NULL WHERE id = ?", [nextRetry, id]);
        await this.createLog(job.type, job.provider || 'zahir', job.referenceType, job.referenceId, 'MANUAL_RETRY', null, null, 200, 'Manually queued for retry');
        (0, connection_1.saveDb)();
        const result = db.exec('SELECT * FROM integration_jobs WHERE id = ?', [id]);
        return formatRow(result);
    }
    async processAllPending() {
        const results = [];
        let processed = 0;
        const maxBatch = 50;
        for (let i = 0; i < maxBatch; i++) {
            const result = await this.processNextJob();
            if (!result)
                break;
            results.push(result);
            processed++;
        }
        return { processed, results };
    }
    startScheduler(intervalMs = POLL_INTERVAL_MS) {
        if (this.schedulerTimer)
            return;
        this.schedulerTimer = setInterval(async () => {
            try {
                await this.processAllPending();
            }
            catch (err) {
                console.error('Integration queue scheduler error:', err);
            }
        }, intervalMs);
        console.log(`Integration queue scheduler started (interval: ${intervalMs}ms)`);
    }
    stopScheduler() {
        if (this.schedulerTimer) {
            clearInterval(this.schedulerTimer);
            this.schedulerTimer = null;
            console.log('Integration queue scheduler stopped');
        }
    }
    async getJobs(filters = {}) {
        const db = await (0, connection_1.getDb)();
        let where = 'WHERE 1=1';
        const params = [];
        if (filters.status) {
            where += ' AND status = ?';
            params.push(filters.status);
        }
        if (filters.type) {
            where += ' AND type = ?';
            params.push(filters.type);
        }
        if (filters.provider) {
            where += ' AND provider = ?';
            params.push(filters.provider);
        }
        const result = db.exec(`SELECT * FROM integration_jobs ${where} ORDER BY createdAt DESC`, params);
        return formatRows(result);
    }
    async getLogs(filters = {}) {
        const db = await (0, connection_1.getDb)();
        let where = 'WHERE 1=1';
        const params = [];
        if (filters.type) {
            where += ' AND type = ?';
            params.push(filters.type);
        }
        if (filters.status) {
            where += ' AND status = ?';
            params.push(filters.status);
        }
        if (filters.provider) {
            where += ' AND provider = ?';
            params.push(filters.provider);
        }
        if (filters.referenceType) {
            where += ' AND referenceType = ?';
            params.push(filters.referenceType);
        }
        const result = db.exec(`SELECT * FROM integration_logs ${where} ORDER BY createdAt DESC`, params);
        return formatRows(result);
    }
    async getDeadLetterJobs() {
        const db = await (0, connection_1.getDb)();
        const result = db.exec("SELECT * FROM integration_jobs WHERE status = 'DEAD_LETTER' ORDER BY createdAt DESC");
        return formatRows(result);
    }
    async createLog(type, provider, referenceType, referenceId, status, externalId, error, responseStatus, responseMessage) {
        try {
            const db = await (0, connection_1.getDb)();
            db.run(`INSERT INTO integration_logs (id, type, provider, referenceType, referenceId, status, externalId, error, responseStatus, responseMessage, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                (0, utils_1.generateId)(), type, provider, referenceType || null, referenceId || null,
                status, externalId || null, error || null,
                responseStatus || null, responseMessage || null, (0, utils_1.nowISO)()
            ]);
        }
        catch (err) {
            console.error('Failed to create integration log:', err);
        }
    }
}
exports.IntegrationQueueService = IntegrationQueueService;
exports.integrationQueueService = new IntegrationQueueService();
