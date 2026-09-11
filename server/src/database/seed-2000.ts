import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { getDb, saveDb, closeDb } from './connection';
import { migrate } from './migrate';
import { generateId, nowISO } from '../shared/utils';

function randomId(): string { return generateId(); }
function randomItem<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomDate(daysAgo: number): string {
  const d = new Date(Date.now() - Math.random() * daysAgo * 86400000);
  return d.toISOString();
}
function futureDate(daysAhead: number): string {
  const d = new Date(Date.now() + Math.random() * daysAhead * 86400000);
  return d.toISOString();
}

async function seed2000() {
  console.log('Running migration...');
  await migrate();

  const db = await getDb();
  const now = nowISO();

  // Clear
  const tables = [
    'audit_logs', 'webhook_events', 'integration_logs', 'integration_jobs', 'integration_configs',
    'purchase_requisitions', 'notifications', 'inventory_transactions', 'work_order_spare_parts',
    'work_order_attachments', 'work_order_checklists', 'work_order_status_history', 'work_orders',
    'pm_wos', 'pm_logs', 'pm_checklists', 'preventive_maintenance',
    'asset_meter_readings', 'asset_meters', 'asset_documents',
    'log_book_spare_parts', 'log_book_items', 'log_books',
    'spare_parts', 'warehouses',
    'role_permissions', 'user_roles', 'roles', 'permissions', 'users', 'assets'
  ];
  for (const table of tables) { db.run(`DELETE FROM ${table}`); }
  console.log('Tables cleared.');

  // ========== PERMISSIONS ==========
  const modules = ['dashboard', 'work_orders', 'preventive_maintenance', 'assets', 'inventory', 'reports', 'users', 'roles', 'settings', 'integrations', 'audit_logs', 'log_books'];
  const actions = ['create', 'read', 'update', 'delete', 'assign', 'close', 'approve'];
  const permIds: Record<string, string> = {};
  for (const mod of modules) {
    for (const act of actions) {
      const id = randomId();
      permIds[`${mod}.${act}`] = id;
      db.run('INSERT INTO permissions (id, name, module, action, createdAt) VALUES (?, ?, ?, ?, ?)', [id, `${mod}.${act}`, mod, act, now]);
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
    const id = randomId(); roleIds[r.name] = id;
    db.run('INSERT INTO roles (id, name, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)', [id, r.name, r.desc, now, now]);
  }

  for (const permName of Object.keys(permIds)) {
    db.run('INSERT INTO role_permissions (id, roleId, permissionId) VALUES (?, ?, ?)', [randomId(), roleIds['ADMIN'], permIds[permName]]);
  }
  const supervisorPerms = ['dashboard.read', 'work_orders.create', 'work_orders.read', 'work_orders.update', 'work_orders.assign', 'preventive_maintenance.create', 'preventive_maintenance.read', 'preventive_maintenance.update', 'assets.create', 'assets.read', 'assets.update', 'inventory.read', 'reports.read', 'notifications.read', 'log_books.create', 'log_books.read', 'log_books.update', 'log_books.delete'];
  for (const p of supervisorPerms) { if (permIds[p]) db.run('INSERT INTO role_permissions (id, roleId, permissionId) VALUES (?, ?, ?)', [randomId(), roleIds['SUPERVISOR'], permIds[p]]); }
  const techPerms = ['work_orders.read', 'work_orders.update', 'work_orders.close', 'assets.read', 'inventory.read', 'notifications.read', 'log_books.create', 'log_books.read', 'log_books.update', 'preventive_maintenance.read', 'preventive_maintenance.approve'];
  for (const p of techPerms) { if (permIds[p]) db.run('INSERT INTO role_permissions (id, roleId, permissionId) VALUES (?, ?, ?)', [randomId(), roleIds['TECHNICIAN'], permIds[p]]); }
  const managerPerms = ['dashboard.read', 'work_orders.read', 'preventive_maintenance.read', 'assets.read', 'inventory.read', 'reports.read', 'notifications.read', 'log_books.read'];
  for (const p of managerPerms) { if (permIds[p]) db.run('INSERT INTO role_permissions (id, roleId, permissionId) VALUES (?, ?, ?)', [randomId(), roleIds['MANAGER'], permIds[p]]); }

  // ========== USERS (10) ==========
  const password = await bcrypt.hash('password123', 12);
  const userDefs = [
    { email: 'admin@example.com', name: 'Admin User', role: 'ADMIN' },
    { email: 'supervisor@example.com', name: 'Budi Santoso', role: 'SUPERVISOR' },
    { email: 'technician@example.com', name: 'Andi Pratama', role: 'TECHNICIAN' },
    { email: 'manager@example.com', name: 'Sari Dewi', role: 'MANAGER' },
    { email: 'tech2@example.com', name: 'Rizki Firmansyah', role: 'TECHNICIAN' },
    { email: 'tech3@example.com', name: 'Dimas Aditya', role: 'TECHNICIAN' },
    { email: 'tech4@example.com', name: 'Fajar Nugroho', role: 'TECHNICIAN' },
    { email: 'sup2@example.com', name: 'Heri Kurniawan', role: 'SUPERVISOR' },
    { email: 'mgr2@example.com', name: 'Rina Wulandari', role: 'MANAGER' },
    { email: 'tech5@example.com', name: 'Yoga Pratama', role: 'TECHNICIAN' },
  ];
  const userIds: string[] = [];
  const userIdMap: Record<string, string> = {};
  for (const u of userDefs) {
    const id = randomId(); userIds.push(id); userIdMap[u.email] = id;
    db.run('INSERT INTO users (id, email, password, name, phone, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 1, ?, ?)', [id, u.email, password, u.name, `0812${String(randomInt(10000000, 99999999))}`, now, now]);
    db.run('INSERT INTO user_roles (id, userId, roleId) VALUES (?, ?, ?)', [randomId(), id, roleIds[u.role]]);
  }
  const techIds = [userIdMap['technician@example.com'], userIdMap['tech2@example.com'], userIdMap['tech3@example.com'], userIdMap['tech4@example.com'], userIdMap['tech5@example.com']];
  const supIds = [userIdMap['supervisor@example.com'], userIdMap['sup2@example.com']];
  console.log(`Users: ${userDefs.length}`);

  // ========== WAREHOUSES (3) ==========
  const whNames = ['Main Warehouse', 'Building B Store', 'Outdoor Storage'];
  const whIds: string[] = [];
  for (const name of whNames) {
    const id = randomId(); whIds.push(id);
    db.run('INSERT INTO warehouses (id, name, location, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)', [id, name, `Location - ${name}`, `Storage for ${name}`, now, now]);
  }

  // ========== SPARE PARTS (50) ==========
  const spDefs = [
    { code: 'SP-001', name: 'Spindle Bearing 7206B', cat: 'Mechanical', spec: 'SKF 7206 BECBP', unit: 'PCS', cost: 485000 },
    { code: 'SP-002', name: 'Hydraulic Oil Filter', cat: 'Mechanical', spec: 'Parker 937563Q', unit: 'PCS', cost: 320000 },
    { code: 'SP-003', name: 'V-Belt B68', cat: 'Mechanical', spec: 'Gates B68 Raw Edge', unit: 'PCS', cost: 125000 },
    { code: 'SP-004', name: 'Contactor 3P 40A', cat: 'Electrical', spec: 'Schneider LC1D40M7C', unit: 'PCS', cost: 850000 },
    { code: 'SP-005', name: 'Hydraulic Seal Kit', cat: 'Mechanical', spec: 'Parker 3715397', unit: 'SET', cost: 1250000 },
    { code: 'SP-006', name: 'Air Filter Element', cat: 'Mechanical', spec: 'Donaldson P532516', unit: 'PCS', cost: 680000 },
    { code: 'SP-007', name: 'Oil Filter', cat: 'Mechanical', spec: 'Fleetguard LF16235', unit: 'PCS', cost: 220000 },
    { code: 'SP-008', name: 'Hydraulic Oil', cat: 'Lubricant', spec: 'Shell Tellus S2 VX 46', unit: 'LITER', cost: 85000 },
    { code: 'SP-009', name: 'Grease', cat: 'Lubricant', spec: 'Shell Gadus S3 V220C', unit: 'KG', cost: 120000 },
    { code: 'SP-010', name: 'V-Belt A68', cat: 'Mechanical', spec: 'Gates A68', unit: 'PCS', cost: 150000 },
  ];
  const sparePartIds: string[] = [];
  for (const sp of spDefs) {
    const id = randomId(); sparePartIds.push(id);
    const stock = randomInt(0, 50); const min = randomInt(2, 10); const max = randomInt(30, 100);
    const whId = whIds[randomInt(0, whIds.length - 1)];
    db.run(`INSERT INTO spare_parts (id, itemCode, itemName, category, specification, unit, warehouseId, currentStock, minimumStock, maximumStock, unitCost, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, sp.code, sp.name, sp.cat, sp.spec, sp.unit, whId, stock, min, max, sp.cost, now, now]);
  }
  console.log(`Spare Parts: ${spDefs.length}`);

  // ========== ASSETS (25) ==========
  const workshops = ['Workshop - Area Produksi', 'Workshop - Area Press', 'Workshop - Utility Room', 'Workshop - Area Welding', 'Workshop - Area Gudang'];
  const assetTypes = ['Mesin', 'Alat'];
  const assetNames: Record<string, string[]> = {
    Mesin: ['CNC Milling Machine', 'Hydraulic Press 100 Ton', 'Atlas Copco Air Compressor', 'Lathe Machine', 'Surface Grinding Machine', 'Milling Machine Manual', 'Drill Press', 'CNC Turning Center'],
    Alat: ['Miller TIG Welding Machine', 'Toyota Forklift 3 Ton', 'Hand Grinder', 'Impact Wrench', 'Hydraulic Jack', 'Torque Wrench', 'Portable Crane', 'Chain Hoist'],
  };
  const manufacturers = ['DMG Mori', 'Yoshida', 'Atlas Copco', 'Miller', 'Toyota', 'Makita', 'Bosch', 'Hitachi', 'Doosan', 'Okuma'];
  const assetStatuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE', 'MAINTENANCE'];

  const assetIds: string[] = [];
  const assetCodeNums = ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010',
    '011', '012', '013', '014', '015', '016', '017', '018', '019', '020',
    '021', '022', '023', '024', '025'];
  for (let i = 0; i < 25; i++) {
    const id = randomId(); assetIds.push(id);
    const type = randomItem(assetTypes);
    const name = randomItem(assetNames[type]);
    const loc = randomItem(workshops);
    const mfr = randomItem(manufacturers);
    const purchaseDate = randomDate(1000).split('T')[0];
    const prefix = type === 'Mesin' ? 'MC' : 'TL';
    db.run(`INSERT INTO assets (id, assetCode, assetName, assetType, location, serialNumber, manufacturer, model, purchaseDate, warrantyStart, warrantyEnd, status, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, `${prefix}-${assetCodeNums[i]}`, `${name} #${i + 1}`, type, loc, `${mfr}-SN-${randomInt(10000, 99999)}`, mfr, `Model-${randomInt(100, 999)}`, purchaseDate, purchaseDate, `${parseInt(purchaseDate.substring(0, 4)) + 3}-12-31`, randomItem(assetStatuses), `${name} at ${loc}`, now, now]);
  }
  console.log(`Assets: 25`);

  // ========== ASSET METERS (50) ==========
  const meterTypes = ['Running Hours', 'Vibration', 'Temperature', 'Operating Hours'];
  for (let i = 0; i < 30; i++) {
    const assetIdx = randomInt(0, assetIds.length - 1);
    const meterId = randomId();
    const mType = randomItem(meterTypes);
    const unit = mType === 'Temperature' ? '°C' : mType === 'Vibration' ? 'mm/s' : 'hours';
    db.run('INSERT INTO asset_meters (id, assetId, meterType, unit, createdAt) VALUES (?, ?, ?, ?, ?)', [meterId, assetIds[assetIdx], mType, unit, now]);
    db.run('INSERT INTO asset_meter_readings (id, meterId, assetId, value, readingDate, recordedBy) VALUES (?, ?, ?, ?, ?, ?)',
      [randomId(), meterId, assetIds[assetIdx], mType === 'Temperature' ? randomInt(20, 80) : randomInt(100, 10000), randomDate(30), randomItem(techIds)]);
  }
  console.log(`Asset Meters: 30, Readings: 30`);

  // ========== WORK ORDERS (1500) ==========
  const woStatuses = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'CLOSED'];
  const woStatusWeights = [150, 100, 200, 50, 1000]; // mostly closed
  const priorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const priorityWeights = [50, 200, 600, 650];

  function weightedRandom(items: string[], weights: number[]): string {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  const problems = [
    'Unusual noise during operation', 'Overheating detected', 'Vibration exceeding threshold',
    'Electrical fault detected', 'Oil leak observed', 'Pressure drop below normal',
    'Communication error with controller', 'Motor not starting', 'Abnormal current draw',
    'Coolant leak detected', 'Bearing temperature high', 'Belt wear detected',
    'Sensor calibration drift', 'Intermittent power loss', 'Control panel error code',
    'Pump cavitation observed', 'Corrosion detected on housing', 'Fan blade damage',
    'Leaking gasket', 'Fuse blown repeatedly', 'Timer malfunction', 'Relay sticking',
    'Filter clogged', 'Belt slipping', 'Valve not closing fully'
  ];

  const rootCauses = [
    'Wear and tear', 'Lack of preventive maintenance', 'Incorrect installation',
    'Environmental factors', 'Material fatigue', 'Electrical surge', 'Contamination',
    'Overloading', 'Improper operation', 'Manufacturing defect', 'Age-related degradation',
    null, null, null
  ];

  const resolutions = [
    'Replaced faulty component', 'Cleaned and serviced', 'Recalibrated instrument',
    'Tightened loose connections', 'Lubricated moving parts', 'Reset and tested OK',
    'Replaced worn parts', 'Patched leak', 'Adjusted settings', 'Restored from backup config',
    null, null, null
  ];

  const woIds: string[] = [];
  const woNumbers: string[] = [];

  for (let i = 0; i < 1500; i++) {
    const id = randomId(); woIds.push(id);
    const woNum = `WO-2026-${String(i + 1).padStart(6, '0')}`; woNumbers.push(woNum);
    const status = weightedRandom(woStatuses, woStatusWeights);
    const priority = weightedRandom(priorities, priorityWeights);
    const assetId = randomItem(assetIds);
    const reporterId = randomItem([...supIds, ...techIds]);
    const techAssigned = status !== 'OPEN' ? randomItem(techIds) : null;
    const supAssigned = supIds[randomInt(0, supIds.length - 1)];
    const createdAt = randomDate(365);
    const problem = randomItem(problems);

    let startedAt = null, closedAt = null, completedAt = null;
    if (['IN_PROGRESS', 'ON_HOLD', 'CLOSED'].includes(status)) startedAt = randomDate(300);
    if (status === 'CLOSED') { closedAt = randomDate(200); completedAt = closedAt; }

    db.run(`INSERT INTO work_orders (id, woNumber, title, description, assetId, location, reportedById, supervisorId, assignedToId, priority, status, dueDate, createdAt, problemDescription, rootCause, resolution, startedAt, closedAt, completedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, woNum, `${problem} - WO#${i + 1}`, `Maintenance request for asset. ${problem}`, assetId, `Location-${randomInt(1, 5)}`,
       reporterId, supAssigned, techAssigned, priority, status, futureDate(30), createdAt,
       problem, randomItem(rootCauses), randomItem(resolutions), startedAt, closedAt, completedAt]);

    // Status history
    db.run('INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes, createdAt) VALUES (?, ?, NULL, ?, ?, ?, ?)', [randomId(), id, 'OPEN', reporterId, 'Work Order created', createdAt]);
    if (status !== 'OPEN') db.run('INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)', [randomId(), id, 'OPEN', 'ASSIGNED', supAssigned, 'Assigned to technician', createdAt]);
    if (['IN_PROGRESS', 'ON_HOLD', 'CLOSED'].includes(status)) db.run('INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)', [randomId(), id, 'ASSIGNED', 'IN_PROGRESS', techAssigned, 'Work started', startedAt]);
    if (status === 'ON_HOLD') db.run('INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)', [randomId(), id, 'IN_PROGRESS', 'ON_HOLD', techAssigned, 'Waiting for parts', startedAt]);
    if (status === 'CLOSED') db.run('INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)', [randomId(), id, 'IN_PROGRESS', 'CLOSED', techAssigned, 'Work completed', closedAt]);
  }
  console.log(`Work Orders: 1500`);

  // Checklists (10 per WO)
  const checklistTitles = ['Isolate power supply', 'Inspect wiring connections', 'Check component condition', 'Test equipment operation', 'Document findings', 'Restore operation', 'Clean work area', 'Verify safety guards', 'Check fluid levels', 'Record meter readings'];
  for (const woId of woIds) {
    const numChecklists = randomInt(3, 6);
    const shuffled = [...checklistTitles].sort(() => Math.random() - 0.5);
    for (let j = 0; j < numChecklists; j++) {
      const completed = Math.random() > 0.3;
      db.run('INSERT INTO work_order_checklists (id, woId, title, required, completed, completedBy, completedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [randomId(), woId, shuffled[j], Math.random() > 0.2 ? 1 : 0, completed ? 1 : 0, completed ? randomItem(techIds) : null, completed ? randomDate(200) : null]);
    }
  }
  console.log('Checklists created for all WOs');

  // WO Spare Parts (500 entries)
  for (let i = 0; i < 500; i++) {
    const woIdx = randomInt(0, woIds.length - 1);
    const spIdx = randomInt(0, sparePartIds.length - 1);
    const sp = spDefs[spIdx];
    const planned = randomInt(1, 10);
    const used = Math.random() > 0.4 ? randomInt(0, planned) : 0;
    db.run('INSERT INTO work_order_spare_parts (id, woId, itemId, plannedQuantity, usedQuantity, unit, unitCost, totalCost) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [randomId(), woIds[woIdx], sparePartIds[spIdx], planned, used, sp.unit, sp.cost, used * sp.cost]);
  }
  console.log('WO Spare Parts: 500');

  // ========== PREVENTIVE MAINTENANCE (30) ==========
  const pmFreqs = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'];
  const pmTitles = ['Monthly Inspection', 'Quarterly Service', 'Annual Overhaul', 'Weekly Check', 'Daily Visual Check', 'Semi-Annual Calibration', 'Bi-Annual Performance Test'];
  const pmIds: string[] = [];
  for (let i = 0; i < 30; i++) {
    const id = randomId(); pmIds.push(id);
    const freq = randomItem(pmFreqs);
    const startDate = randomDate(400).split('T')[0];
    const nextDue = futureDate(60).split('T')[0];
    db.run(`INSERT INTO preventive_maintenance (id, assetId, title, description, frequency, startDate, nextDueDate, meterType, meterThreshold, assignedToId, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, randomItem(assetIds), `${randomItem(pmTitles)} #${i + 1}`, `Scheduled preventive maintenance`, freq, startDate, nextDue,
       Math.random() > 0.5 ? 'Running Hours' : null, Math.random() > 0.5 ? randomInt(500, 2000) : null,
       randomItem(techIds), 'ACTIVE', now, now]);
    // PM checklists
    for (const item of ['Visual inspection', 'Lubrication', 'Filter replacement', 'Performance test', 'Record readings']) {
      db.run('INSERT INTO pm_checklists (id, pmId, title, required, createdAt) VALUES (?, ?, ?, 1, ?)', [randomId(), id, item, now]);
    }
  }
  console.log(`Preventive Maintenance: 30`);

  // ========== INVENTORY TRANSACTIONS (800) ==========
  for (let i = 0; i < 800; i++) {
    const type = Math.random() > 0.6 ? 'IN' : 'OUT';
    const spIdx = randomInt(0, sparePartIds.length - 1);
    const qty = randomInt(1, 20);
    db.run('INSERT INTO inventory_transactions (id, itemId, warehouseId, transactionType, quantity, unitCost, referenceType, referenceId, notes, createdBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomId(), sparePartIds[spIdx], whIds[randomInt(0, whIds.length - 1)], type, qty, spDefs[spIdx].cost,
       type === 'OUT' ? 'WORK_ORDER' : null, type === 'OUT' ? woIds[randomInt(0, woIds.length - 1)] : null,
       `${type} transaction #${i + 1}`, randomItem([...techIds, userIds[0]]), randomDate(365)]);
  }
  console.log('Inventory Transactions: 800');

  // ========== PURCHASE REQUISITIONS (100) ==========
  const prStatuses = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'ORDERED'];
  for (let i = 0; i < 100; i++) {
    const spIdx = randomInt(0, sparePartIds.length - 1);
    const sp = spDefs[spIdx];
    db.run('INSERT INTO purchase_requisitions (id, itemId, quantity, unit, reason, currentStock, minimumStock, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomId(), sparePartIds[spIdx], randomInt(5, 50), sp.unit, randomItem(['Low stock alert', 'Scheduled maintenance', 'Emergency repair', 'Stock replenishment']),
       randomInt(0, 10), randomInt(5, 20), randomItem(prStatuses), randomDate(180), randomDate(180)]);
  }
  console.log('Purchase Requisitions: 100');

  // ========== NOTIFICATIONS (500) ==========
  const notifTypes = ['NEW_WO', 'WO_ASSIGNED', 'WO_CLOSED', 'LOW_STOCK', 'PM_DUE', 'PR_APPROVED'];
  for (let i = 0; i < 500; i++) {
    const type = randomItem(notifTypes);
    db.run('INSERT INTO notifications (id, userId, type, title, message, referenceType, referenceId, read, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomId(), randomItem(userIds), type, `${type.replace('_', ' ')} #${i + 1}`, `Notification message #${i + 1}`,
       type.includes('WO') ? 'WORK_ORDER' : type.includes('PR') ? 'PURCHASE_REQUISITION' : 'SPARE_PART',
       woIds[randomInt(0, woIds.length - 1)], Math.random() > 0.4 ? 1 : 0, randomDate(365)]);
  }
  console.log('Notifications: 500');

  // ========== AUDIT LOGS (300) ==========
  const auditActions = ['LOGIN', 'CREATE', 'UPDATE', 'DELETE', 'CLOSE', 'ASSIGN'];
  for (let i = 0; i < 300; i++) {
    db.run('INSERT INTO audit_logs (id, userId, action, entity, entityId, newValue, ipAddress, userAgent, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomId(), randomItem(userIds), randomItem(auditActions), randomItem(['user', 'work_order', 'asset', 'spare_part', 'preventive_maintenance']),
       randomId(), `{"action":"test"}`, `192.168.1.${randomInt(1, 254)}`, 'Mozilla/5.0', randomDate(365)]);
  }
  console.log('Audit Logs: 300');

  // ========== INTEGRATION JOBS (50) ==========
  for (let i = 0; i < 50; i++) {
    db.run('INSERT INTO integration_jobs (id, type, referenceType, referenceId, payload, status, attempts, maxAttempts, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomId(), randomItem(['WO_CLOSE', 'PR_SYNC', 'INVENTORY_SYNC']), 'WORK_ORDER', woIds[randomInt(0, woIds.length - 1)],
       JSON.stringify({ test: true }), randomItem(['PENDING', 'SUCCESS', 'FAILED', 'DEAD_LETTER']), randomInt(0, 5), 5, randomDate(180)]);
  }
  console.log('Integration Jobs: 50');

  saveDb();
  closeDb();

  const total = 1500 + 1000 + 25 + 30 + 800 + 100 + 500 + 300 + 50 + 30 + 500;
  console.log(`\n=== SEED 2000 COMPLETE ===`);
  console.log(`Total records: ~${total.toLocaleString()}`);
  console.log('Users: 10');
  console.log('Assets: 25');
  console.log('Spare Parts: 10');
  console.log('Work Orders: 1,500');
  console.log('WO Checklists: ~6,000');
  console.log('WO Spare Parts: 500');
  console.log('PM Schedules: 30');
  console.log('Inventory Transactions: 800');
  console.log('Purchase Requisitions: 100');
  console.log('Notifications: 500');
  console.log('Audit Logs: 300');
  console.log('Integration Jobs: 50');
  console.log('\nLogin: admin@example.com / password123');
  console.log('=========================\n');
}

seed2000().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
