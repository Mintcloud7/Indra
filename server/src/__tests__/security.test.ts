import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BASE_URL, seedDatabase, startServer, stopServer, loginAs, authHeader } from './helpers';

let adminToken: string;
let technicianToken: string;

beforeAll(async () => {
  await seedDatabase();
  await startServer();
  adminToken = await loginAs('admin@example.com');
  technicianToken = await loginAs('technician@example.com');
});

afterAll(async () => {
  await stopServer();
});

describe('Security', () => {
  describe('Unauthorized API access', () => {
    it('should return 401 for protected routes without token', async () => {
      const routes = [
        { method: 'GET', path: '/api/work-orders' },
        { method: 'GET', path: '/api/assets' },
        { method: 'GET', path: '/api/spare-parts' },
        { method: 'GET', path: '/api/users' },
        { method: 'GET', path: '/api/roles' },
        { method: 'GET', path: '/api/notifications' },
      ];

      for (const route of routes) {
        const res = await fetch(`${BASE_URL}${route.path}`, {
          method: route.method,
          headers: { 'Content-Type': 'application/json' }
        });
        expect(res.status).toBe(401);
      }
    });
  });

  describe('Role violation', () => {
    it('should return 403 when technician tries to access user management', async () => {
      const res = await fetch(`${BASE_URL}/api/users`, {
        method: 'GET',
        headers: authHeader(technicianToken)
      });
      const body = await res.json() as any;

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
    });

    it('should return 403 when technician tries to create work order', async () => {
      const res = await fetch(`${BASE_URL}/api/work-orders`, {
        method: 'POST',
        headers: authHeader(technicianToken),
        body: JSON.stringify({ title: 'Unauthorized WO' })
      });
      const body = await res.json() as any;

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
    });

    it('should return 403 when technician tries to manage roles', async () => {
      const res = await fetch(`${BASE_URL}/api/roles`, {
        method: 'GET',
        headers: authHeader(technicianToken)
      });
      const body = await res.json() as any;

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
    });
  });

  describe('Invalid input', () => {
    it('should return 400 for invalid login input (bad email format)', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email', password: 'password123' })
      });
      const body = await res.json() as any;

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it('should return 400 for empty password in login', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: '' })
      });
      const body = await res.json() as any;

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });
  });

  describe('SQL injection', () => {
    it('should handle SQL injection in login safely', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: "' OR '1'='1' --",
          password: "' OR '1'='1' --"
        })
      });
      const body = await res.json() as any;

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it('should handle SQL injection in work order search safely', async () => {
      const res = await fetch(`${BASE_URL}/api/work-orders?search='; DROP TABLE work_orders; --`, {
        headers: authHeader(adminToken)
      });
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);

      const verifyRes = await fetch(`${BASE_URL}/api/work-orders?page=1&limit=1`, {
        headers: authHeader(adminToken)
      });
      const verifyBody = await verifyRes.json() as any;
      expect(verifyBody.success).toBe(true);
      expect(verifyBody.data.length).toBeGreaterThan(0);
    });

    it('should handle SQL injection in work order creation safely', async () => {
      const res = await fetch(`${BASE_URL}/api/work-orders`, {
        method: 'POST',
        headers: authHeader(adminToken),
        body: JSON.stringify({
          title: "'; DROP TABLE work_orders; --",
          description: "1' OR '1'='1"
        })
      });

      expect(res.status).toBe(201);

      const verifyRes = await fetch(`${BASE_URL}/api/work-orders?page=1&limit=1`, {
        headers: authHeader(adminToken)
      });
      const verifyBody = await verifyRes.json() as any;
      expect(verifyBody.success).toBe(true);
      expect(verifyBody.data.length).toBeGreaterThan(0);
    });

    it('should handle SQL injection in spare part search safely', async () => {
      const res = await fetch(`${BASE_URL}/api/spare-parts?search=' UNION SELECT * FROM users --`, {
        headers: authHeader(adminToken)
      });
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });
  });
});
