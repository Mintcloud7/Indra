import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BASE_URL, seedDatabase, startServer, stopServer, loginAs, authHeader } from './helpers';

let adminToken: string;

beforeAll(async () => {
  await seedDatabase();
  await startServer();
  adminToken = await loginAs('admin@example.com');
});

afterAll(async () => {
  await stopServer();
});

describe('Auth Module', () => {
  describe('POST /api/auth/login', () => {
    it('should return token and user for valid credentials', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: 'password123' })
      });
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.token).toBeDefined();
      expect(typeof body.data.token).toBe('string');
      expect(body.data.user).toBeDefined();
      expect(body.data.user.email).toBe('admin@example.com');
      expect(body.data.user.name).toBe('Admin User');
      expect(body.data.user.roles).toBeDefined();
      expect(body.data.user.permissions).toBeDefined();
    });

    it('should return 401 for invalid email', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nonexistent@example.com', password: 'password123' })
      });
      const body = await res.json() as any;

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
    });

    it('should return 401 for invalid password', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: 'wrongpassword' })
      });
      const body = await res.json() as any;

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user profile with valid token', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: authHeader(adminToken)
      });
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.email).toBe('admin@example.com');
      expect(body.data.name).toBe('Admin User');
      expect(body.data.isActive).toBe(true);
      expect(body.data.roles).toBeDefined();
      expect(Array.isArray(body.data.roles)).toBe(true);
      expect(body.data.permissions).toBeDefined();
      expect(Array.isArray(body.data.permissions)).toBe(true);
    });

    it('should return 401 without token', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/me`);
      const body = await res.json() as any;

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
    });

    it('should return 401 with invalid token', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { 'Authorization': 'Bearer invalid.token.here', 'Content-Type': 'application/json' }
      });
      const body = await res.json() as any;

      expect(res.status).toBe(401);
      expect(body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should return success on logout', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: authHeader(adminToken)
      });
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Logged out');
    });
  });
});
