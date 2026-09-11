import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BASE_URL, seedDatabase, startServer, stopServer, loginAs, authHeader } from './helpers';

let adminToken: string;
let supervisorToken: string;

beforeAll(async () => {
  await seedDatabase();
  await startServer();
  adminToken = await loginAs('admin@example.com');
  supervisorToken = await loginAs('supervisor@example.com');
});

afterAll(async () => {
  await stopServer();
});

describe('Inventory Module', () => {
  describe('GET /api/spare-parts', () => {
    it('should return paginated list of spare parts', async () => {
      const res = await fetch(`${BASE_URL}/api/spare-parts?page=1&limit=10`, {
        headers: authHeader(adminToken)
      });
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.total).toBeGreaterThan(0);
    });
  });

  describe('POST /api/spare-parts', () => {
    it('should create spare part with itemCode', async () => {
      const res = await fetch(`${BASE_URL}/api/spare-parts`, {
        method: 'POST',
        headers: authHeader(adminToken),
        body: JSON.stringify({
          itemCode: 'SP-TEST-001',
          itemName: 'Test Bearing',
          category: 'Mechanical',
          unit: 'PCS',
          currentStock: 10,
          minimumStock: 5,
          maximumStock: 50,
          unitCost: 150000
        })
      });
      const body = await res.json() as any;

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.itemCode).toBe('SP-TEST-001');
      expect(body.data.itemName).toBe('Test Bearing');
      expect(body.data.currentStock).toBe(10);
    });
  });

  describe('POST /api/stock-in', () => {
    it('should create IN transaction and increase stock', async () => {
      const listRes = await fetch(`${BASE_URL}/api/spare-parts?search=SP-TEST-001`, {
        headers: authHeader(adminToken)
      });
      const listBody = await listRes.json() as any;
      const sparePart = listBody.data.find((s: any) => s.itemCode === 'SP-TEST-001');

      const warehouseRes = await fetch(`${BASE_URL}/api/warehouses`, {
        headers: authHeader(adminToken)
      });
      const warehouseBody = await warehouseRes.json() as any;
      const warehouse = warehouseBody.data.find((w: any) => w.name === 'Main Warehouse');

      const res = await fetch(`${BASE_URL}/api/stock-in`, {
        method: 'POST',
        headers: authHeader(adminToken),
        body: JSON.stringify({
          itemId: sparePart.id,
          warehouseId: warehouse.id,
          quantity: 20,
          unitCost: 150000,
          notes: 'Test stock in'
        })
      });
      const body = await res.json() as any;

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.transactionType).toBe('IN');
      expect(body.data.quantity).toBe(20);

      const checkRes = await fetch(`${BASE_URL}/api/spare-parts/${sparePart.id}`, {
        headers: authHeader(adminToken)
      });
      const checkBody = await checkRes.json() as any;
      expect(checkBody.data.currentStock).toBe(30);
    });
  });

  describe('POST /api/stock-out', () => {
    it('should create OUT transaction and decrease stock', async () => {
      const listRes = await fetch(`${BASE_URL}/api/spare-parts?search=SP-TEST-001`, {
        headers: authHeader(adminToken)
      });
      const listBody = await listRes.json() as any;
      const sparePart = listBody.data.find((s: any) => s.itemCode === 'SP-TEST-001');

      const warehouseRes = await fetch(`${BASE_URL}/api/warehouses`, {
        headers: authHeader(adminToken)
      });
      const warehouseBody = await warehouseRes.json() as any;
      const warehouse = warehouseBody.data.find((w: any) => w.name === 'Main Warehouse');

      const res = await fetch(`${BASE_URL}/api/stock-out`, {
        method: 'POST',
        headers: authHeader(adminToken),
        body: JSON.stringify({
          itemId: sparePart.id,
          warehouseId: warehouse.id,
          quantity: 5,
          unitCost: 150000,
          notes: 'Test stock out'
        })
      });
      const body = await res.json() as any;

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.transactionType).toBe('OUT');
      expect(body.data.quantity).toBe(5);

      const checkRes = await fetch(`${BASE_URL}/api/spare-parts/${sparePart.id}`, {
        headers: authHeader(adminToken)
      });
      const checkBody = await checkRes.json() as any;
      expect(checkBody.data.currentStock).toBe(25);
    });

    it('should throw error for insufficient stock', async () => {
      const listRes = await fetch(`${BASE_URL}/api/spare-parts?search=SP-TEST-001`, {
        headers: authHeader(adminToken)
      });
      const listBody = await listRes.json() as any;
      const sparePart = listBody.data.find((s: any) => s.itemCode === 'SP-TEST-001');

      const warehouseRes = await fetch(`${BASE_URL}/api/warehouses`, {
        headers: authHeader(adminToken)
      });
      const warehouseBody = await warehouseRes.json() as any;
      const warehouse = warehouseBody.data.find((w: any) => w.name === 'Main Warehouse');

      const res = await fetch(`${BASE_URL}/api/stock-out`, {
        method: 'POST',
        headers: authHeader(adminToken),
        body: JSON.stringify({
          itemId: sparePart.id,
          warehouseId: warehouse.id,
          quantity: 100,
          unitCost: 150000
        })
      });
      const body = await res.json() as any;

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.message).toContain('Insufficient stock');
    });
  });

  describe('GET /api/spare-parts/low-stock', () => {
    it('should return items below minimum stock', async () => {
      const res = await fetch(`${BASE_URL}/api/spare-parts/low-stock`, {
        headers: authHeader(adminToken)
      });
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);

      for (const item of body.data) {
        expect(item.currentStock).toBeLessThanOrEqual(item.minimumStock);
      }
    });
  });

  describe('GET /api/transactions', () => {
    it('should return filtered list of transactions', async () => {
      const res = await fetch(`${BASE_URL}/api/transactions?page=1&limit=10`, {
        headers: authHeader(adminToken)
      });
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toBeDefined();

      for (const txn of body.data) {
        expect(txn.id).toBeDefined();
        expect(txn.itemId).toBeDefined();
        expect(txn.transactionType).toBeDefined();
        expect(txn.quantity).toBeDefined();
      }
    });

    it('should filter transactions by type', async () => {
      const res = await fetch(`${BASE_URL}/api/transactions?transactionType=IN`, {
        headers: authHeader(adminToken)
      });
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      for (const txn of body.data) {
        expect(txn.transactionType).toBe('IN');
      }
    });
  });
});
