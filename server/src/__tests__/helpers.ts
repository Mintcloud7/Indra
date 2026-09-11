import fs from 'fs';
import path from 'path';
import http from 'http';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { closeDb, getDb, saveDb } from '../database/connection';
import { migrate } from '../database/migrate';
import { generateId, nowISO } from '../shared/utils';
import { errorHandler } from '../middleware/error';
import { authenticate } from '../middleware/auth';

import authRoutes from '../modules/auth/auth.routes';
import usersRoutes from '../modules/users/users.routes';
import rolesRoutes from '../modules/roles/roles.routes';
import assetsRoutes from '../modules/assets/assets.routes';
import workOrdersRoutes from '../modules/work-orders/work-orders.routes';
import pmRoutes from '../modules/preventive-maintenance/pm.routes';
import inventoryRoutes from '../modules/inventory/inventory.routes';
import notificationsRoutes from '../modules/notifications/notifications.routes';
import reportsRoutes from '../modules/reports/reports.routes';
import dashboardRoutes from '../modules/dashboard/dashboard.routes';
import prRoutes from '../modules/purchase-requisitions/pr.routes';

export const TEST_PORT = 3099;
export const BASE_URL = `http://localhost:${TEST_PORT}`;

let server: http.Server;

export function createTestApp(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', authenticate, usersRoutes);
  app.use('/api/roles', authenticate, rolesRoutes);
  app.use('/api/assets', authenticate, assetsRoutes);
  app.use('/api/work-orders', authenticate, workOrdersRoutes);
  app.use('/api/preventive-maintenance', authenticate, pmRoutes);
  app.use('/api', authenticate, inventoryRoutes);
  app.use('/api/notifications', authenticate, notificationsRoutes);
  app.use('/api/reports', authenticate, reportsRoutes);
  app.use('/api/dashboard', authenticate, dashboardRoutes);
  app.use('/api/purchase-requisitions', authenticate, prRoutes);

  app.use(errorHandler);
  return app;
}

export async function seedDatabase(): Promise<void> {
  closeDb();

  const dbPath = path.resolve(process.cwd(), 'dev.db');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  await migrate();

  const db = await getDb();
  const now = nowISO();

  const tables = [
    'audit_logs', 'webhook_events', 'integration_logs', 'integration_jobs', 'integration_configs',
    'purchase_requisitions', 'notifications', 'inventory_transactions', 'work_order_spare_parts',
    'work_order_attachments', 'work_order_checklists', 'work_order_status_history', 'work_orders',
    'pm_wos', 'pm_logs', 'pm_checklists', 'preventive_maintenance',
    'asset_meter_readings', 'asset_meters', 'asset_documents',
    'spare_parts', 'warehouses',
    'role_permissions', 'user_roles', 'roles', 'permissions', 'users', 'assets'
  ];
  for (const table of tables) {
    db.run(`DELETE FROM ${table}`);
  }

  // ========== PERMISSIONS ==========
  const modules = [
    'dashboard', 'work_orders', 'preventive_maintenance', 'assets', 'inventory',
    'reports', 'users', 'roles', 'settings', 'integrations', 'audit_logs'
  ];
  const actions = ['create', 'read', 'update', 'delete', 'assign', 'close'];

  const permIds: Record<string, string> = {};
  for (const mod of modules) {
    for (const action of actions) {
      const id = generateId();
      const name = `${mod}.${action}`;
      permIds[name] = id;
      db.run('INSERT INTO permissions (id, name, module, action, createdAt) VALUES (?, ?, ?, ?, ?)',
        [id, name, mod, action, now]);
    }
  }

  // ========== ROLES ==========
  const roleData = [
    { name: 'ADMIN', desc: 'Full system access' },
    { name: 'SUPERVISOR', desc: 'Maintenance supervisor' },
    { name: 'TECHNICIAN', desc: 'Field technician' },
    { name: 'MANAGER', desc: 'Read-only management' }
  ];

  const roleIds: Record<string, string> = {};
  for (const r of roleData) {
    const id = generateId();
    roleIds[r.name] = id;
    db.run('INSERT INTO roles (id, name, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
      [id, r.name, r.desc, now, now]);
  }

  for (const permName of Object.keys(permIds)) {
    db.run('INSERT INTO role_permissions (id, roleId, permissionId) VALUES (?, ?, ?)',
      [generateId(), roleIds['ADMIN'], permIds[permName]]);
  }

  const supervisorPerms = [
    'dashboard.read', 'work_orders.create', 'work_orders.read', 'work_orders.update', 'work_orders.assign',
    'work_orders.close',
    'preventive_maintenance.create', 'preventive_maintenance.read', 'preventive_maintenance.update',
    'assets.create', 'assets.read', 'assets.update',
    'inventory.read', 'inventory.create', 'inventory.update',
    'reports.read', 'notifications.read'
  ];
  for (const p of supervisorPerms) {
    if (permIds[p]) {
      db.run('INSERT INTO role_permissions (id, roleId, permissionId) VALUES (?, ?, ?)',
        [generateId(), roleIds['SUPERVISOR'], permIds[p]]);
    }
  }

  const techPerms = [
    'work_orders.read', 'work_orders.update',
    'assets.read', 'inventory.read', 'notifications.read'
  ];
  for (const p of techPerms) {
    if (permIds[p]) {
      db.run('INSERT INTO role_permissions (id, roleId, permissionId) VALUES (?, ?, ?)',
        [generateId(), roleIds['TECHNICIAN'], permIds[p]]);
    }
  }

  const managerPerms = [
    'dashboard.read', 'work_orders.read', 'preventive_maintenance.read',
    'assets.read', 'inventory.read', 'reports.read', 'notifications.read'
  ];
  for (const p of managerPerms) {
    if (permIds[p]) {
      db.run('INSERT INTO role_permissions (id, roleId, permissionId) VALUES (?, ?, ?)',
        [generateId(), roleIds['MANAGER'], permIds[p]]);
    }
  }

  // ========== USERS ==========
  const password = await bcrypt.hash('password123', 12);
  const userData = [
    { email: 'admin@example.com', name: 'Admin User', role: 'ADMIN' },
    { email: 'supervisor@example.com', name: 'Budi Santoso', role: 'SUPERVISOR' },
    { email: 'technician@example.com', name: 'Andi Pratama', role: 'TECHNICIAN' },
    { email: 'manager@example.com', name: 'Sari Dewi', role: 'MANAGER' }
  ];

  const userIds: Record<string, string> = {};
  for (const u of userData) {
    const id = generateId();
    userIds[u.email] = id;
    db.run('INSERT INTO users (id, email, password, name, phone, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
      [id, u.email, password, u.name, '081234567890', now, now]);
    db.run('INSERT INTO user_roles (id, userId, roleId) VALUES (?, ?, ?)',
      [generateId(), id, roleIds[u.role]]);
  }

  // ========== WAREHOUSES ==========
  const whId = generateId();
  db.run('INSERT INTO warehouses (id, name, location, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
    [whId, 'Main Warehouse', 'Building A - Ground Floor', 'Primary spare parts storage', now, now]);

  // ========== SPARE PARTS ==========
  const sparePartsData = [
    { code: 'SP-001', name: 'Contactor 3P 40A', cat: 'Electrical', spec: 'Schneider LC1D40M7C', unit: 'PCS', stock: 12, min: 5, max: 30, cost: 850000 },
    { code: 'SP-002', name: 'Thermal Overload Relay', cat: 'Electrical', spec: 'Schneider LRD3322C', unit: 'PCS', stock: 8, min: 3, max: 20, cost: 425000 },
    { code: 'SP-003', name: 'Fuse 250A', cat: 'Electrical', spec: 'Bussmann JTD-250', unit: 'PCS', stock: 3, min: 5, max: 20, cost: 175000 },
    { code: 'SP-004', name: 'Temperature Controller', cat: 'Instrumentation', spec: 'Omron E5CC-RX2AUM', unit: 'PCS', stock: 4, min: 2, max: 10, cost: 1250000 },
    { code: 'SP-005', name: 'Cable 2.5mm²', cat: 'Electrical', spec: 'NYAF 2.5mm² - 100m roll', unit: 'ROLL', stock: 15, min: 5, max: 30, cost: 350000 },
    { code: 'SP-006', name: 'Air Filter', cat: 'Mechanical', spec: 'Donaldson P532516', unit: 'PCS', stock: 2, min: 4, max: 15, cost: 680000 }
  ];

  const sparePartIds: string[] = [];
  for (const sp of sparePartsData) {
    const id = generateId();
    sparePartIds.push(id);
    db.run(`INSERT INTO spare_parts (id, itemCode, itemName, category, specification, unit, warehouseId, currentStock, minimumStock, maximumStock, unitCost, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, sp.code, sp.name, sp.cat, sp.spec, sp.unit, whId, sp.stock, sp.min, sp.max, sp.cost, now, now]);
  }

  // ========== ASSETS ==========
  const assetsData = [
    { code: 'GS-001', name: 'Generator Set 500kVA', type: 'Generator', location: 'Building A - Power Room', serial: 'CUMMINS-GS-2023-001', mfr: 'Cummins', model: 'C500D5', purchase: '2023-03-15' },
    { code: 'CH-001', name: 'Chiller Unit 200RT', type: 'HVAC', location: 'Building B - Roof', serial: 'TRANE-CH-2022-045', mfr: 'Trane', model: 'RTAF-200', purchase: '2022-08-20' },
    { code: 'ATS-001', name: 'ATS Panel 800A', type: 'Electrical', location: 'Building A - Electrical Room', serial: 'SOCOMEC-ATS-2023-010', mfr: 'Socomec', model: 'ATYS-S-800', purchase: '2023-01-10' },
    { code: 'CP-001', name: 'Control Panel PLC', type: 'Control', location: 'Building C - Production Line 1', serial: 'SIEMENS-CP-2024-003', mfr: 'Siemens', model: 'S7-1500', purchase: '2024-02-15' },
    { code: 'TC-001', name: 'Temperature Controller System', type: 'Instrumentation', location: 'Building C - Oven Section', serial: 'OMRON-TC-2023-012', mfr: 'Omron', model: 'E5CC Control System', purchase: '2023-06-01' }
  ];

  const assetIds: string[] = [];
  for (const a of assetsData) {
    const id = generateId();
    assetIds.push(id);
    db.run(`INSERT INTO assets (id, assetCode, assetName, assetType, location, serialNumber, manufacturer, model, purchaseDate, warrantyStart, warrantyEnd, status, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
      [id, a.code, a.name, a.type, a.location, a.serial, a.mfr, a.model, a.purchase, a.purchase, `${parseInt(a.purchase) + 2}-12-31`, `${a.name} - ${a.location}`, now, now]);
  }

  // ========== WORK ORDERS ==========
  const woData = [
    { title: 'Generator Set Overheating', desc: 'GS-001 experiencing high temperature alarm', assetIdx: 0, priority: 'HIGH', status: 'OPEN' },
    { title: 'Chiller Not Cooling', desc: 'CH-001 not reaching setpoint', assetIdx: 1, priority: 'CRITICAL', status: 'OPEN' },
    { title: 'ATS Auto Transfer Failure', desc: 'ATS-001 failing to auto transfer', assetIdx: 2, priority: 'HIGH', status: 'ASSIGNED' },
    { title: 'PLC Communication Error', desc: 'CP-001 showing intermittent communication loss', assetIdx: 3, priority: 'MEDIUM', status: 'IN_PROGRESS' },
    { title: 'Temperature Controller Calibration', desc: 'TC-001 requires calibration', assetIdx: 4, priority: 'LOW', status: 'CLOSED' }
  ];

  const woIds: string[] = [];
  for (let i = 0; i < woData.length; i++) {
    const w = woData[i];
    const id = generateId();
    woIds.push(id);
    const woNumber = `WO-2026-${String(i + 1).padStart(6, '0')}`;
    const createdAt = new Date(Date.now() - (woData.length - i) * 86400000).toISOString();

    db.run(
      `INSERT INTO work_orders (id, woNumber, title, description, assetId, location, reportedById, supervisorId, assignedToId, priority, status, createdAt, problemDescription) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, woNumber, w.title, w.desc, assetIds[w.assetIdx], assetsData[w.assetIdx].location,
       userIds['supervisor@example.com'], userIds['supervisor@example.com'],
       w.status !== 'OPEN' ? userIds['technician@example.com'] : null,
       w.priority, w.status, createdAt, w.desc]
    );

    db.run('INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes, createdAt) VALUES (?, ?, NULL, ?, ?, ?, ?)',
      [generateId(), id, 'OPEN', userIds['supervisor@example.com'], 'Work Order created', createdAt]);
  }

  // ========== INVENTORY TRANSACTIONS ==========
  db.run('INSERT INTO inventory_transactions (id, itemId, warehouseId, transactionType, quantity, unitCost, notes, createdBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [generateId(), sparePartIds[0], whId, 'IN', 20, 850000, 'Initial stock', userIds['admin@example.com'], now]);

  saveDb();
  closeDb();
}

export async function startServer(port: number = TEST_PORT): Promise<void> {
  return new Promise((resolve, reject) => {
    const app = createTestApp();
    server = app.listen(port, () => {
      resolve();
    });
    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        setTimeout(() => {
          server = app.listen(port, () => resolve());
        }, 1000);
      } else {
        reject(err);
      }
    });
  });
}

export async function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

export async function loginAs(email: string, port: number = TEST_PORT): Promise<string> {
  const res = await fetch(`http://localhost:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' })
  });
  const body = await res.json() as any;
  return body.data.token;
}

export function authHeader(token: string): Record<string, string> {
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}
