import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BASE_URL, seedDatabase, startServer, stopServer, loginAs, authHeader } from './helpers';

let adminToken: string;
let supervisorToken: string;
let technicianToken: string;

beforeAll(async () => {
  await seedDatabase();
  await startServer();
  adminToken = await loginAs('admin@example.com');
  supervisorToken = await loginAs('supervisor@example.com');
  technicianToken = await loginAs('technician@example.com');
});

afterAll(async () => {
  await stopServer();
});

describe('Work Orders Module', () => {
  describe('GET /api/work-orders', () => {
    it('should return paginated list of work orders', async () => {
      const res = await fetch(`${BASE_URL}/api/work-orders?page=1&limit=10`, {
        headers: authHeader(adminToken)
      });
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.total).toBeGreaterThan(0);
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(10);
    });
  });

  describe('POST /api/work-orders', () => {
    it('should create work order with OPEN status and WO number', async () => {
      const res = await fetch(`${BASE_URL}/api/work-orders`, {
        method: 'POST',
        headers: authHeader(supervisorToken),
        body: JSON.stringify({
          title: 'Test Work Order',
          description: 'Test description for the work order',
          priority: 'HIGH'
        })
      });
      const body = await res.json() as any;

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.woNumber).toMatch(/^WO-\d{4}-\d{6}$/);
      expect(body.data.status).toBe('OPEN');
      expect(body.data.title).toBe('Test Work Order');
      expect(body.data.priority).toBe('HIGH');
    });
  });

  describe('GET /api/work-orders/:id', () => {
    it('should return full work order details', async () => {
      const listRes = await fetch(`${BASE_URL}/api/work-orders?page=1&limit=1`, {
        headers: authHeader(adminToken)
      });
      const listBody = await listRes.json() as any;
      const woId = listBody.data[0].id;

      const res = await fetch(`${BASE_URL}/api/work-orders/${woId}`, {
        headers: authHeader(adminToken)
      });
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(woId);
      expect(body.data.statusHistory).toBeDefined();
      expect(Array.isArray(body.data.statusHistory)).toBe(true);
      expect(body.data.checklists).toBeDefined();
      expect(body.data.attachments).toBeDefined();
      expect(body.data.spareParts).toBeDefined();
    });
  });

  describe('Work order status transitions', () => {
    let woId: string;

    it('should create a fresh work order for transition tests', async () => {
      const res = await fetch(`${BASE_URL}/api/work-orders`, {
        method: 'POST',
        headers: authHeader(supervisorToken),
        body: JSON.stringify({
          title: 'Transition Test WO',
          description: 'Testing all status transitions',
          priority: 'MEDIUM'
        })
      });
      const body = await res.json() as any;
      woId = body.data.id;
      expect(body.data.status).toBe('OPEN');
    });

    it('should transition OPEN -> ASSIGNED', async () => {
      const listUsersRes = await fetch(`${BASE_URL}/api/users/technicians`, {
        headers: authHeader(adminToken)
      });
      const usersBody = await listUsersRes.json() as any;
      const techUser = usersBody.data.find((u: any) => u.email === 'technician@example.com');

      const res = await fetch(`${BASE_URL}/api/work-orders/${woId}/assign`, {
        method: 'POST',
        headers: authHeader(supervisorToken),
        body: JSON.stringify({
          assignedToId: techUser.id,
          notes: 'Assigned for testing'
        })
      });
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.data.status).toBe('ASSIGNED');
    });

    it('should transition ASSIGNED -> IN_PROGRESS', async () => {
      const res = await fetch(`${BASE_URL}/api/work-orders/${woId}/start`, {
        method: 'POST',
        headers: authHeader(technicianToken)
      });
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.data.status).toBe('IN_PROGRESS');
    });

    it('should transition IN_PROGRESS -> ON_HOLD', async () => {
      const res = await fetch(`${BASE_URL}/api/work-orders/${woId}/hold`, {
        method: 'POST',
        headers: authHeader(technicianToken),
        body: JSON.stringify({ notes: 'Waiting for parts' })
      });
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.data.status).toBe('ON_HOLD');
    });

    it('should transition ON_HOLD -> IN_PROGRESS (resume)', async () => {
      const res = await fetch(`${BASE_URL}/api/work-orders/${woId}/resume`, {
        method: 'POST',
        headers: authHeader(technicianToken)
      });
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.data.status).toBe('IN_PROGRESS');
    });

    it('should transition IN_PROGRESS -> CLOSED', async () => {
      const res = await fetch(`${BASE_URL}/api/work-orders/${woId}/close`, {
        method: 'POST',
        headers: authHeader(adminToken),
        body: JSON.stringify({
          workPerformed: 'Replaced faulty component',
          rootCause: 'Component wear',
          resolution: 'Replaced and tested OK'
        })
      });
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.data.status).toBe('CLOSED');
    });

    it('should throw BadRequestError for invalid transition CLOSED -> IN_PROGRESS', async () => {
      const res = await fetch(`${BASE_URL}/api/work-orders/${woId}/start`, {
        method: 'POST',
        headers: authHeader(adminToken)
      });
      const body = await res.json() as any;

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.message).toContain('Cannot transition');
    });
  });

  describe('Close with incomplete mandatory checklist', () => {
    it('should throw BadRequestError when mandatory checklist is incomplete', async () => {
      const createRes = await fetch(`${BASE_URL}/api/work-orders`, {
        method: 'POST',
        headers: authHeader(supervisorToken),
        body: JSON.stringify({
          title: 'Checklist Test WO',
          description: 'Testing checklist validation',
          priority: 'MEDIUM'
        })
      });
      const createBody = await createRes.json() as any;
      const woId = createBody.data.id;

      await fetch(`${BASE_URL}/api/work-orders/${woId}/checklist`, {
        method: 'POST',
        headers: authHeader(supervisorToken),
        body: JSON.stringify({ title: 'Mandatory Safety Check', required: true })
      });

      const listUsersRes = await fetch(`${BASE_URL}/api/users/technicians`, {
        headers: authHeader(adminToken)
      });
      const usersBody = await listUsersRes.json() as any;
      const techUser = usersBody.data.find((u: any) => u.email === 'technician@example.com');

      await fetch(`${BASE_URL}/api/work-orders/${woId}/assign`, {
        method: 'POST',
        headers: authHeader(supervisorToken),
        body: JSON.stringify({ assignedToId: techUser.id })
      });

      await fetch(`${BASE_URL}/api/work-orders/${woId}/start`, {
        method: 'POST',
        headers: authHeader(technicianToken)
      });

      const res = await fetch(`${BASE_URL}/api/work-orders/${woId}/close`, {
        method: 'POST',
        headers: authHeader(adminToken),
        body: JSON.stringify({ workPerformed: 'Done' })
      });
      const body = await res.json() as any;

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.message).toContain('Mandatory checklist');
    });
  });
});
