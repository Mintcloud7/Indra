import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { getDb, saveDb, closeDb } from './connection';
import { migrate } from './migrate';
import { generateId, nowISO } from '../shared/utils';

async function seed() {
  console.log('Running migration...');
  await migrate();

  const db = await getDb();
  const now = nowISO();

  // Clear existing data
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
    'reports', 'users', 'roles', 'settings', 'integrations', 'audit_logs', 'log_books'
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
    { name: 'MANAGER', desc: 'Read-only management' },
    { name: 'PRODUCTION', desc: 'Production Admin' }
  ];
  
  const roleIds: Record<string, string> = {};
  for (const r of roleData) {
    const id = generateId();
    roleIds[r.name] = id;
    db.run('INSERT INTO roles (id, name, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
      [id, r.name, r.desc, now, now]);
  }

  // Admin gets all permissions
  for (const permName of Object.keys(permIds)) {
    db.run('INSERT INTO role_permissions (id, roleId, permissionId) VALUES (?, ?, ?)',
      [generateId(), roleIds['ADMIN'], permIds[permName]]);
  }

  // Supervisor permissions
  const supervisorPerms = [
    'dashboard.read', 'work_orders.create', 'work_orders.read', 'work_orders.update', 'work_orders.assign',
    'preventive_maintenance.create', 'preventive_maintenance.read', 'preventive_maintenance.update',
    'assets.create', 'assets.read', 'assets.update',
    'inventory.read', 'reports.read', 'notifications.read'
  ];
  for (const p of supervisorPerms) {
    if (permIds[p]) {
      db.run('INSERT INTO role_permissions (id, roleId, permissionId) VALUES (?, ?, ?)',
        [generateId(), roleIds['SUPERVISOR'], permIds[p]]);
    }
  }

  // Technician permissions
  const techPerms = [
    'work_orders.read', 'work_orders.update', 'work_orders.close', 'assets.read', 'inventory.read', 'notifications.read'
  ];
  for (const p of techPerms) {
    if (permIds[p]) {
      db.run('INSERT INTO role_permissions (id, roleId, permissionId) VALUES (?, ?, ?)',
        [generateId(), roleIds['TECHNICIAN'], permIds[p]]);
    }
  }

  // Manager permissions (read-only)
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

  // Production permissions
  const productionPerms = [
    'work_orders.create', 'work_orders.read', 'work_orders.update',
    'assets.read', 'inventory.read', 'notifications.read'
  ];
  for (const p of productionPerms) {
    if (permIds[p]) {
      db.run('INSERT INTO role_permissions (id, roleId, permissionId) VALUES (?, ?, ?)',
        [generateId(), roleIds['PRODUCTION'], permIds[p]]);
    }
  }

  // ========== USERS ==========
  const password = await bcrypt.hash('password123', 12);
  const userData = [
    { username: 'admin', email: 'admin@example.com', name: 'Admin User', role: 'ADMIN' },
    { username: 'supervisor', email: 'supervisor@example.com', name: 'Budi Santoso', role: 'SUPERVISOR' },
    { username: 'technician', email: 'technician@example.com', name: 'Andi Pratama', role: 'TECHNICIAN' },
    { username: 'manager', email: 'manager@example.com', name: 'Sari Dewi', role: 'MANAGER' }
  ];

  const userIds: Record<string, string> = {};
  for (const u of userData) {
    const id = generateId();
    userIds[u.email] = id;
    db.run('INSERT INTO users (id, username, email, password, name, phone, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)',
      [id, u.username, u.email, password, u.name, '081234567890', now, now]);
    db.run('INSERT INTO user_roles (id, userId, roleId) VALUES (?, ?, ?)',
      [generateId(), id, roleIds[u.role]]);
  }

  // ========== WAREHOUSES ==========
  const whId = generateId();
  db.run('INSERT INTO warehouses (id, name, location, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
    [whId, 'Main Warehouse', 'Building A - Ground Floor', 'Primary spare parts storage', now, now]);

  // ========== SPARE PARTS ==========
  const sparePartsData = [
    { code: 'SP-001', name: 'Spindle Bearing 7206B', cat: 'Mechanical', spec: 'SKF 7206 BECBP', unit: 'PCS', stock: 6, min: 3, max: 20, cost: 485000 },
    { code: 'SP-002', name: 'Hydraulic Oil Filter', cat: 'Mechanical', spec: 'Parker 937563Q', unit: 'PCS', stock: 10, min: 4, max: 25, cost: 320000 },
    { code: 'SP-003', name: 'V-Belt B68', cat: 'Mechanical', spec: 'Gates B68 Raw Edge', unit: 'PCS', stock: 4, min: 6, max: 20, cost: 125000 },
    { code: 'SP-004', name: 'Contactor 3P 40A', cat: 'Electrical', spec: 'Schneider LC1D40M7C', unit: 'PCS', stock: 8, min: 3, max: 15, cost: 850000 },
    { code: 'SP-005', name: 'Hydraulic Seal Kit', cat: 'Mechanical', spec: 'Parker 3715397', unit: 'SET', stock: 5, min: 4, max: 15, cost: 1250000 },
    { code: 'SP-006', name: 'Air Filter Element', cat: 'Mechanical', spec: 'Donaldson P532516', unit: 'PCS', stock: 12, min: 5, max: 30, cost: 680000 }
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
    { code: 'MC-001', name: 'CNC Milling Machine', type: 'Mesin', location: 'Workshop - Area Produksi', serial: 'DMG-MC-2023-001', mfr: 'DMG Mori', model: 'DMC 650', purchase: '2023-03-15' },
    { code: 'MC-002', name: 'Hydraulic Press 100 Ton', type: 'Mesin', location: 'Workshop - Area Press', serial: 'YOSH-HP-2022-008', mfr: 'Yoshida', model: 'HPP-100', purchase: '2022-08-20' },
    { code: 'TL-001', name: 'Atlas Copco Air Compressor', type: 'Mesin', location: 'Workshop - Utility Room', serial: 'AC-GA-2023-015', mfr: 'Atlas Copco', model: 'GA 37 VSD', purchase: '2023-01-10' },
    { code: 'TL-002', name: 'Miller TIG Welding Machine', type: 'Alat', location: 'Workshop - Area Welding', serial: 'MLR-TIG-2024-003', mfr: 'Miller', model: 'Dynasty 280', purchase: '2024-02-15' },
    { code: 'TL-003', name: 'Toyota Forklift 3 Ton', type: 'Alat', location: 'Workshop - Area Gudang', serial: 'TTF-30-2023-022', mfr: 'Toyota', model: '8FBE30', purchase: '2023-06-01' }
  ];

  const assetIds: string[] = [];
  for (const a of assetsData) {
    const id = generateId();
    assetIds.push(id);
    db.run(`INSERT INTO assets (id, assetCode, assetName, assetType, location, serialNumber, manufacturer, model, purchaseDate, warrantyStart, warrantyEnd, status, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
      [id, a.code, a.name, a.type, a.location, a.serial, a.mfr, a.model, a.purchase, a.purchase, `${parseInt(a.purchase) + 2}-12-31`, `${a.name} - ${a.location}`, now, now]);
  }

  // ========== ASSET METERS ==========
  const meters: Array<{ assetIdx: number; type: string; unit: string }> = [
    { assetIdx: 0, type: 'Spindle Hours', unit: 'hours' },
    { assetIdx: 1, type: 'Press Cycle Count', unit: 'cycles' },
    { assetIdx: 2, type: 'Running Hours', unit: 'hours' }
  ];
  const meterIds: string[] = [];
  for (const m of meters) {
    const id = generateId();
    meterIds.push(id);
    db.run('INSERT INTO asset_meters (id, assetId, meterType, unit, createdAt) VALUES (?, ?, ?, ?, ?)',
      [id, assetIds[m.assetIdx], m.type, m.unit, now]);
    db.run('INSERT INTO asset_meter_readings (id, meterId, assetId, value, readingDate, recordedBy) VALUES (?, ?, ?, ?, ?, ?)',
      [generateId(), id, assetIds[m.assetIdx], Math.floor(Math.random() * 5000) + 1000, now, userIds['technician@example.com']]);
  }

  // ========== WORK ORDERS ==========
  const woData = [
    { title: 'CNC Spindle Vibration', desc: 'MC-001 mengalami getaran berlebih pada spindle saat operasi high-speed', assetIdx: 0, priority: 'HIGH', status: 'CLOSED', problem: 'Spindle bearing aus, getaran meningkat saat RPM tinggi', rootCause: 'Kurangnya pelumasan berkala pada spindle bearing', resolution: 'Penggantian spindle bearing 7206B, balancing ulang spindle' },
    { title: 'Hydraulic Press Leakage', desc: 'MC-002 terjadi kebocoran oli hydraulic pada seal cylinder', assetIdx: 1, priority: 'CRITICAL', status: 'IN_PROGRESS', problem: 'Kebocoran oli hydraulic dari cylinder seal', rootCause: null, resolution: null },
    { title: 'Compressor Pressure Drop', desc: 'TL-001 tekanan output turun dari 7.5 bar ke 5.8 bar', assetIdx: 2, priority: 'HIGH', status: 'ASSIGNED', problem: 'Pressure drop, filter element tersumbat', rootCause: null, resolution: null },
    { title: 'Welding Arc Instability', desc: 'TL-002 arc tidak stabil saat TIG welding aluminium', assetIdx: 3, priority: 'MEDIUM', status: 'OPEN', problem: 'Arc stretch dan porosity pada weld bead', rootCause: null, resolution: null },
    { title: 'Forklift Brake Check', desc: 'TL-003 perlu pemeriksaan berkala sistem rem forklift', assetIdx: 4, priority: 'LOW', status: 'CLOSED', problem: 'Schedule servis rem berkala', rootCause: 'Routine PM', resolution: 'Pengecekan brake pad dan brake fluid selesai, masih dalam toleransi' }
  ];

  const woIds: string[] = [];
  for (let i = 0; i < woData.length; i++) {
    const w = woData[i];
    const id = generateId();
    woIds.push(id);
    const woNumber = `WO-2026-${String(i + 1).padStart(6, '0')}`;
    const createdAt = new Date(Date.now() - (woData.length - i) * 86400000).toISOString();
    
    db.run(`INSERT INTO work_orders (id, woNumber, title, description, assetId, location, reportedById, supervisorId, assignedToId, priority, status, createdAt, problemDescription, rootCause, resolution, startedAt, closedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, woNumber, w.title, w.desc, assetIds[w.assetIdx], assetsData[w.assetIdx].location,
       userIds['supervisor@example.com'], userIds['supervisor@example.com'],
       w.status !== 'OPEN' ? userIds['technician@example.com'] : null,
       w.priority, w.status, createdAt, w.problem, w.rootCause, w.resolution,
       w.status === 'IN_PROGRESS' || w.status === 'CLOSED' ? createdAt : null,
       w.status === 'CLOSED' ? now : null]);

    db.run('INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes, createdAt) VALUES (?, ?, NULL, ?, ?, ?, ?)',
      [generateId(), id, 'OPEN', userIds['supervisor@example.com'], 'Work Order created', createdAt]);

    if (w.status !== 'OPEN') {
      db.run('INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [generateId(), id, 'OPEN', 'ASSIGNED', userIds['supervisor@example.com'], 'Assigned to technician', createdAt]);
    }
    if (w.status === 'IN_PROGRESS' || w.status === 'CLOSED') {
      db.run('INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [generateId(), id, 'ASSIGNED', 'IN_PROGRESS', userIds['technician@example.com'], 'Work started', createdAt]);
    }
    if (w.status === 'CLOSED') {
      db.run('INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [generateId(), id, 'IN_PROGRESS', 'CLOSED', userIds['technician@example.com'], 'Work completed', now]);
    }
  }

  // Add checklists to WO
  const checklistItems = [
    'Isolate power supply', 'Inspect wiring connections', 'Check component condition',
    'Test equipment operation', 'Document findings', 'Restore operation'
  ];
  for (const cl of checklistItems) {
    db.run('INSERT INTO work_order_checklists (id, woId, title, required, completed) VALUES (?, ?, ?, 1, ?)',
      [generateId(), woIds[0], cl, cl !== 'Document findings' ? 1 : 0]);
  }

  // Add spare parts to WO
  db.run('INSERT INTO work_order_spare_parts (id, woId, itemId, plannedQuantity, usedQuantity, unit, unitCost, totalCost) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [generateId(), woIds[0], sparePartIds[0], 2, 1, 'PCS', 850000, 850000]);
  db.run('INSERT INTO work_order_spare_parts (id, woId, itemId, plannedQuantity, usedQuantity, unit, unitCost, totalCost) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [generateId(), woIds[0], sparePartIds[4], 10, 5, 'METER', 3500, 17500]);

  // ========== PREVENTIVE MAINTENANCE ==========
  const pmData = [
    { assetIdx: 0, title: 'Servis Berkala CNC Milling', freq: 'MONTHLY', desc: 'Pengecekan dan pelumasan spindle, way, dan ball screw', meterType: 'Spindle Hours', meterThreshold: 200 },
    { assetIdx: 1, title: 'Inspeksi Hydraulic Press', freq: 'QUARTERLY', desc: 'Pengecekan seal, filter, dan tekanan hydraulic system', meterType: 'Press Cycle Count', meterThreshold: 5000 },
    { assetIdx: 2, title: 'Annual Compressor Service', freq: 'YEARLY', desc: 'Servis besar compressor termasuk oli, filter, dan valve', meterType: null, meterThreshold: null }
  ];

  for (let i = 0; i < pmData.length; i++) {
    const p = pmData[i];
    const id = generateId();
    const startDate = new Date(Date.now() - 180 * 86400000).toISOString();
    const nextDue = new Date(Date.now() + (i === 1 ? -15 : 30) * 86400000).toISOString();
    
    db.run(`INSERT INTO preventive_maintenance (id, assetId, title, description, frequency, startDate, nextDueDate, meterType, meterThreshold, assignedToId, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
      [id, assetIds[p.assetIdx], p.title, p.desc, p.freq, startDate, nextDue, p.meterType, p.meterThreshold,
       userIds['technician@example.com'], now, now]);

    // PM checklists
    const pmChecklistItems = ['Visual inspection', 'Lubrication', 'Filter replacement', 'Performance test'];
    for (const item of pmChecklistItems) {
      db.run('INSERT INTO pm_checklists (id, pmId, title, required, createdAt) VALUES (?, ?, ?, 1, ?)',
        [generateId(), id, item, now]);
    }
  }

  // ========== INVENTORY TRANSACTIONS ==========
  db.run('INSERT INTO inventory_transactions (id, itemId, warehouseId, transactionType, quantity, unitCost, referenceType, referenceId, notes, createdBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [generateId(), sparePartIds[0], whId, 'IN', 20, 850000, null, null, 'Initial stock', userIds['admin@example.com'], now]);
  db.run('INSERT INTO inventory_transactions (id, itemId, warehouseId, transactionType, quantity, unitCost, referenceType, referenceId, notes, createdBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [generateId(), sparePartIds[0], whId, 'OUT', 8, 850000, 'WORK_ORDER', woIds[0], 'WO-2026-000001 usage', userIds['technician@example.com'], now]);

  // ========== NOTIFICATIONS ==========
  db.run('INSERT INTO notifications (id, userId, type, title, message, referenceType, referenceId, read, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)',
    [generateId(), userIds['technician@example.com'], 'WO_ASSIGNED', 'Work Order Assigned', 'WO-2026-000003 (Compressor Pressure Drop) telah ditugaskan kepada Anda', 'WORK_ORDER', woIds[2], now]);
  db.run('INSERT INTO notifications (id, userId, type, title, message, referenceType, referenceId, read, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)',
    [generateId(), userIds['admin@example.com'], 'LOW_STOCK', 'Low Stock Alert', 'V-Belt B68 (SP-003) sudah di bawah stok minimum', 'SPARE_PART', sparePartIds[2], now]);
  db.run('INSERT INTO notifications (id, userId, type, title, message, referenceType, referenceId, read, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)',
    [generateId(), userIds['supervisor@example.com'], 'WO_CLOSED', 'Work Order Closed', 'WO-2026-000001 (CNC Spindle Vibration) telah selesai', 'WORK_ORDER', woIds[0], now]);

  // ========== AUDIT LOGS ==========
  db.run('INSERT INTO audit_logs (id, userId, action, entity, entityId, newValue, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [generateId(), userIds['admin@example.com'], 'LOGIN', 'user', userIds['admin@example.com'], '{"email":"admin@example.com"}', now]);

  saveDb();
  closeDb();

  console.log('\n=== SEED COMPLETE ===');
  console.log('Users:');
  console.log('  admin@example.com / password123 (ADMIN)');
  console.log('  supervisor@example.com / password123 (SUPERVISOR)');
  console.log('  technician@example.com / password123 (TECHNICIAN)');
  console.log('  manager@example.com / password123 (MANAGER)');
  console.log('\nAssets (Mesin & Alat): 5');
  console.log('Spare Parts: 6');
  console.log('Work Orders: 5');
  console.log('Preventive Maintenance: 3');
  console.log('Warehouses: 1');
  console.log('======================\n');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
