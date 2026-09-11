import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockZahirAdapter } from '../modules/integrations/zahir/zahir.adapter';
import { integrationQueueService } from '../modules/integrations/queue/integration-queue.service';
import { seedDatabase, startServer, stopServer } from './helpers';

beforeAll(async () => {
  await seedDatabase();
  await startServer();
});

afterAll(async () => {
  await stopServer();
});

describe('Zahir Integration', () => {
  describe('MockZahirAdapter', () => {
    it('testConnection should return true', async () => {
      const adapter = new MockZahirAdapter();
      const result = await adapter.testConnection();
      expect(result).toBe(true);
    });

    it('syncInventoryItem should return success with externalId', async () => {
      const adapter = new MockZahirAdapter();
      const result = await adapter.syncInventoryItem({ itemCode: 'SP-001', itemName: 'Test Item' });
      expect(result.success).toBe(true);
      expect(result.externalId).toBe('MOCK-SP-001');
    });

    it('syncPurchaseRequisition should return success', async () => {
      const adapter = new MockZahirAdapter();
      const result = await adapter.syncPurchaseRequisition({ id: 'pr-001', quantity: 10 });
      expect(result.success).toBe(true);
      expect(result.externalId).toBe('MOCK-PR-pr-001');
    });

    it('syncFixedAsset should return success', async () => {
      const adapter = new MockZahirAdapter();
      const result = await adapter.syncFixedAsset({ id: 'asset-001', name: 'Test Asset' });
      expect(result.success).toBe(true);
      expect(result.externalId).toBe('MOCK-ASSET-asset-001');
    });

    it('sendStockAdjustment should return success', async () => {
      const adapter = new MockZahirAdapter();
      const result = await adapter.sendStockAdjustment({ id: 'txn-001', quantity: 5 });
      expect(result.success).toBe(true);
      expect(result.externalId).toBe('MOCK-TXN-txn-001');
    });
  });

  describe('Integration Queue', () => {
    it('should create job with PENDING status', async () => {
      const job = await integrationQueueService.createJob(
        'INVENTORY_SYNC',
        'SPARE_PART',
        null,
        { itemCode: 'SP-TEST', itemName: 'Test Part' }
      );

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.status).toBe('PENDING');
      expect(job.type).toBe('INVENTORY_SYNC');
      expect(job.attempts).toBe(0);
    });

    it('should process job and set status to SUCCESS', async () => {
      const { getDb: getDbFn } = await import('../database/connection');
      const { generateId, nowISO } = await import('../shared/utils');
      const { saveDb: saveFn } = await import('../database/connection');

      const db = await getDbFn();
      const id = generateId();
      const now = nowISO();

      db.run(
        `INSERT INTO integration_jobs (id, type, referenceType, referenceId, payload, status, attempts, maxAttempts, nextRetryAt, createdAt)
         VALUES (?, 'INVENTORY_SYNC', 'SPARE_PART', 'process-test-item', '{\"itemCode\":\"SP-PROCESS\",\"itemName\":\"Process Test\"}', 'PENDING', 0, 5, ?, ?)`,
        [id, now, now]
      );
      saveFn();

      const result = await integrationQueueService.processNextJob();

      expect(result).toBeDefined();
      expect(result.status).toBe('SUCCESS');
      expect(result.jobId).toBe(id);
    });

    it('should handle idempotency - duplicate key prevents duplicate job', async () => {
      const idempotencyKey = `TEST-IDEMPOTENCY-${Date.now()}`;

      const job1 = await integrationQueueService.createJob(
        'INVENTORY_SYNC',
        'SPARE_PART',
        null,
        { itemCode: 'SP-TEST-3' },
        idempotencyKey
      );

      const job2 = await integrationQueueService.createJob(
        'INVENTORY_SYNC',
        'SPARE_PART',
        null,
        { itemCode: 'SP-TEST-3' },
        idempotencyKey
      );

      expect(job1.id).toBe(job2.id);
    });

    it('should set status to DEAD_LETTER after max retries', async () => {
      const { getDb: getDbFn } = await import('../database/connection');
      const { generateId, nowISO } = await import('../shared/utils');
      const { saveDb: saveFn } = await import('../database/connection');

      const db = await getDbFn();
      const id = generateId();
      const now = nowISO();

      db.run(
        `INSERT INTO integration_jobs (id, type, referenceType, referenceId, payload, status, attempts, maxAttempts, nextRetryAt, createdAt)
         VALUES (?, 'UNKNOWN_FAIL_TYPE', 'SPARE_PART', 'dead-letter-item', '{}', 'PENDING', 4, 5, ?, ?)`,
        [id, now, now]
      );
      saveFn();

      const result = await integrationQueueService.processNextJob();

      expect(result).toBeDefined();
      expect(result.status).toBe('FAILED');
      expect(result.jobId).toBe(id);
      const jobs = await integrationQueueService.getJobs({ status: 'DEAD_LETTER' });
      const deadJob = jobs.find((j: any) => j.id === id);
      expect(deadJob).toBeDefined();
    });
  });
});
