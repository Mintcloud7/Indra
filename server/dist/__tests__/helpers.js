"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASE_URL = exports.TEST_PORT = void 0;
exports.createTestApp = createTestApp;
exports.seedDatabase = seedDatabase;
exports.startServer = startServer;
exports.stopServer = stopServer;
exports.loginAs = loginAs;
exports.authHeader = authHeader;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const connection_1 = require("../database/connection");
const migrate_1 = require("../database/migrate");
const utils_1 = require("../shared/utils");
const error_1 = require("../middleware/error");
const auth_1 = require("../middleware/auth");
const auth_routes_1 = __importDefault(require("../modules/auth/auth.routes"));
const users_routes_1 = __importDefault(require("../modules/users/users.routes"));
const roles_routes_1 = __importDefault(require("../modules/roles/roles.routes"));
const assets_routes_1 = __importDefault(require("../modules/assets/assets.routes"));
const work_orders_routes_1 = __importDefault(require("../modules/work-orders/work-orders.routes"));
const pm_routes_1 = __importDefault(require("../modules/preventive-maintenance/pm.routes"));
const inventory_routes_1 = __importDefault(require("../modules/inventory/inventory.routes"));
const notifications_routes_1 = __importDefault(require("../modules/notifications/notifications.routes"));
const reports_routes_1 = __importDefault(require("../modules/reports/reports.routes"));
const dashboard_routes_1 = __importDefault(require("../modules/dashboard/dashboard.routes"));
const pr_routes_1 = __importDefault(require("../modules/purchase-requisitions/pr.routes"));
exports.TEST_PORT = 3099;
exports.BASE_URL = `http://localhost:${exports.TEST_PORT}`;
let server;
function createTestApp() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json({ limit: '10mb' }));
    app.get('/api/health', (_req, res) => {
        res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
    });
    app.use('/api/auth', auth_routes_1.default);
    app.use('/api/users', auth_1.authenticate, users_routes_1.default);
    app.use('/api/roles', auth_1.authenticate, roles_routes_1.default);
    app.use('/api/assets', auth_1.authenticate, assets_routes_1.default);
    app.use('/api/work-orders', auth_1.authenticate, work_orders_routes_1.default);
    app.use('/api/preventive-maintenance', auth_1.authenticate, pm_routes_1.default);
    app.use('/api', auth_1.authenticate, inventory_routes_1.default);
    app.use('/api/notifications', auth_1.authenticate, notifications_routes_1.default);
    app.use('/api/reports', auth_1.authenticate, reports_routes_1.default);
    app.use('/api/dashboard', auth_1.authenticate, dashboard_routes_1.default);
    app.use('/api/purchase-requisitions', auth_1.authenticate, pr_routes_1.default);
    app.use(error_1.errorHandler);
    return app;
}
async function seedDatabase() {
    (0, connection_1.closeDb)();
    const dbPath = path_1.default.resolve(process.cwd(), 'dev.db');
    if (fs_1.default.existsSync(dbPath)) {
        fs_1.default.unlinkSync(dbPath);
    }
    await (0, migrate_1.migrate)();
    const db = await (0, connection_1.getDb)();
    const now = (0, utils_1.nowISO)();
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
    const permIds = {};
    for (const mod of modules) {
        for (const action of actions) {
            const id = (0, utils_1.generateId)();
            const name = `${mod}.${action}`;
            permIds[name] = id;
            db.run('INSERT INTO permissions (id, name, module, action, createdAt) VALUES (?, ?, ?, ?, ?)', [id, name, mod, action, now]);
        }
    }
    // ========== ROLES ==========
    const roleData = [
        { name: 'ADMIN', desc: 'Full system access' },
        { name: 'SUPERVISOR', desc: 'Maintenance supervisor' },
        { name: 'TECHNICIAN', desc: 'Field technician' },
        { name: 'MANAGER', desc: 'Read-only management' }
    ];
    const roleIds = {};
    for (const r of roleData) {
        const id = (0, utils_1.generateId)();
        roleIds[r.name] = id;
        db.run('INSERT INTO roles (id, name, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)', [id, r.name, r.desc, now, now]);
    }
    for (const permName of Object.keys(permIds)) {
        db.run('INSERT INTO role_permissions (id, roleId, permissionId) VALUES (?, ?, ?)', [(0, utils_1.generateId)(), roleIds['ADMIN'], permIds[permName]]);
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
            db.run('INSERT INTO role_permissions (id, roleId, permissionId) VALUES (?, ?, ?)', [(0, utils_1.generateId)(), roleIds['SUPERVISOR'], permIds[p]]);
        }
    }
    const techPerms = [
        'work_orders.read', 'work_orders.update',
        'assets.read', 'inventory.read', 'notifications.read'
    ];
    for (const p of techPerms) {
        if (permIds[p]) {
            db.run('INSERT INTO role_permissions (id, roleId, permissionId) VALUES (?, ?, ?)', [(0, utils_1.generateId)(), roleIds['TECHNICIAN'], permIds[p]]);
        }
    }
    const managerPerms = [
        'dashboard.read', 'work_orders.read', 'preventive_maintenance.read',
        'assets.read', 'inventory.read', 'reports.read', 'notifications.read'
    ];
    for (const p of managerPerms) {
        if (permIds[p]) {
            db.run('INSERT INTO role_permissions (id, roleId, permissionId) VALUES (?, ?, ?)', [(0, utils_1.generateId)(), roleIds['MANAGER'], permIds[p]]);
        }
    }
    // ========== USERS ==========
    const password = await bcryptjs_1.default.hash('password123', 12);
    const userData = [
        { email: 'admin@example.com', name: 'Admin User', role: 'ADMIN' },
        { email: 'supervisor@example.com', name: 'Budi Santoso', role: 'SUPERVISOR' },
        { email: 'technician@example.com', name: 'Andi Pratama', role: 'TECHNICIAN' },
        { email: 'manager@example.com', name: 'Sari Dewi', role: 'MANAGER' }
    ];
    const userIds = {};
    for (const u of userData) {
        const id = (0, utils_1.generateId)();
        userIds[u.email] = id;
        db.run('INSERT INTO users (id, email, password, name, phone, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 1, ?, ?)', [id, u.email, password, u.name, '081234567890', now, now]);
        db.run('INSERT INTO user_roles (id, userId, roleId) VALUES (?, ?, ?)', [(0, utils_1.generateId)(), id, roleIds[u.role]]);
    }
    // ========== WAREHOUSES ==========
    const whId = (0, utils_1.generateId)();
    db.run('INSERT INTO warehouses (id, name, location, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)', [whId, 'Main Warehouse', 'Building A - Ground Floor', 'Primary spare parts storage', now, now]);
    // ========== SPARE PARTS ==========
    const sparePartsData = [
        { code: 'SP-001', name: 'Contactor 3P 40A', cat: 'Electrical', spec: 'Schneider LC1D40M7C', unit: 'PCS', stock: 12, min: 5, max: 30, cost: 850000 },
        { code: 'SP-002', name: 'Thermal Overload Relay', cat: 'Electrical', spec: 'Schneider LRD3322C', unit: 'PCS', stock: 8, min: 3, max: 20, cost: 425000 },
        { code: 'SP-003', name: 'Fuse 250A', cat: 'Electrical', spec: 'Bussmann JTD-250', unit: 'PCS', stock: 3, min: 5, max: 20, cost: 175000 },
        { code: 'SP-004', name: 'Temperature Controller', cat: 'Instrumentation', spec: 'Omron E5CC-RX2AUM', unit: 'PCS', stock: 4, min: 2, max: 10, cost: 1250000 },
        { code: 'SP-005', name: 'Cable 2.5mm²', cat: 'Electrical', spec: 'NYAF 2.5mm² - 100m roll', unit: 'ROLL', stock: 15, min: 5, max: 30, cost: 350000 },
        { code: 'SP-006', name: 'Air Filter', cat: 'Mechanical', spec: 'Donaldson P532516', unit: 'PCS', stock: 2, min: 4, max: 15, cost: 680000 }
    ];
    const sparePartIds = [];
    for (const sp of sparePartsData) {
        const id = (0, utils_1.generateId)();
        sparePartIds.push(id);
        db.run(`INSERT INTO spare_parts (id, itemCode, itemName, category, specification, unit, warehouseId, currentStock, minimumStock, maximumStock, unitCost, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, sp.code, sp.name, sp.cat, sp.spec, sp.unit, whId, sp.stock, sp.min, sp.max, sp.cost, now, now]);
    }
    // ========== ASSETS ==========
    const assetsData = [
        { code: 'GS-001', name: 'Generator Set 500kVA', type: 'Generator', location: 'Building A - Power Room', serial: 'CUMMINS-GS-2023-001', mfr: 'Cummins', model: 'C500D5', purchase: '2023-03-15' },
        { code: 'CH-001', name: 'Chiller Unit 200RT', type: 'HVAC', location: 'Building B - Roof', serial: 'TRANE-CH-2022-045', mfr: 'Trane', model: 'RTAF-200', purchase: '2022-08-20' },
        { code: 'ATS-001', name: 'ATS Panel 800A', type: 'Electrical', location: 'Building A - Electrical Room', serial: 'SOCOMEC-ATS-2023-010', mfr: 'Socomec', model: 'ATYS-S-800', purchase: '2023-01-10' },
        { code: 'CP-001', name: 'Control Panel PLC', type: 'Control', location: 'Building C - Production Line 1', serial: 'SIEMENS-CP-2024-003', mfr: 'Siemens', model: 'S7-1500', purchase: '2024-02-15' },
        { code: 'TC-001', name: 'Temperature Controller System', type: 'Instrumentation', location: 'Building C - Oven Section', serial: 'OMRON-TC-2023-012', mfr: 'Omron', model: 'E5CC Control System', purchase: '2023-06-01' }
    ];
    const assetIds = [];
    for (const a of assetsData) {
        const id = (0, utils_1.generateId)();
        assetIds.push(id);
        db.run(`INSERT INTO assets (id, assetCode, assetName, assetType, location, serialNumber, manufacturer, model, purchaseDate, warrantyStart, warrantyEnd, status, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`, [id, a.code, a.name, a.type, a.location, a.serial, a.mfr, a.model, a.purchase, a.purchase, `${parseInt(a.purchase) + 2}-12-31`, `${a.name} - ${a.location}`, now, now]);
    }
    // ========== WORK ORDERS ==========
    const woData = [
        { title: 'Generator Set Overheating', desc: 'GS-001 experiencing high temperature alarm', assetIdx: 0, priority: 'HIGH', status: 'OPEN' },
        { title: 'Chiller Not Cooling', desc: 'CH-001 not reaching setpoint', assetIdx: 1, priority: 'CRITICAL', status: 'OPEN' },
        { title: 'ATS Auto Transfer Failure', desc: 'ATS-001 failing to auto transfer', assetIdx: 2, priority: 'HIGH', status: 'ASSIGNED' },
        { title: 'PLC Communication Error', desc: 'CP-001 showing intermittent communication loss', assetIdx: 3, priority: 'MEDIUM', status: 'IN_PROGRESS' },
        { title: 'Temperature Controller Calibration', desc: 'TC-001 requires calibration', assetIdx: 4, priority: 'LOW', status: 'CLOSED' }
    ];
    const woIds = [];
    for (let i = 0; i < woData.length; i++) {
        const w = woData[i];
        const id = (0, utils_1.generateId)();
        woIds.push(id);
        const woNumber = `WO-2026-${String(i + 1).padStart(6, '0')}`;
        const createdAt = new Date(Date.now() - (woData.length - i) * 86400000).toISOString();
        db.run(`INSERT INTO work_orders (id, woNumber, title, description, assetId, location, reportedById, supervisorId, assignedToId, priority, status, createdAt, problemDescription) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, woNumber, w.title, w.desc, assetIds[w.assetIdx], assetsData[w.assetIdx].location,
            userIds['supervisor@example.com'], userIds['supervisor@example.com'],
            w.status !== 'OPEN' ? userIds['technician@example.com'] : null,
            w.priority, w.status, createdAt, w.desc]);
        db.run('INSERT INTO work_order_status_history (id, woId, fromStatus, toStatus, changedBy, notes, createdAt) VALUES (?, ?, NULL, ?, ?, ?, ?)', [(0, utils_1.generateId)(), id, 'OPEN', userIds['supervisor@example.com'], 'Work Order created', createdAt]);
    }
    // ========== INVENTORY TRANSACTIONS ==========
    db.run('INSERT INTO inventory_transactions (id, itemId, warehouseId, transactionType, quantity, unitCost, notes, createdBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [(0, utils_1.generateId)(), sparePartIds[0], whId, 'IN', 20, 850000, 'Initial stock', userIds['admin@example.com'], now]);
    (0, connection_1.saveDb)();
    (0, connection_1.closeDb)();
}
async function startServer(port = exports.TEST_PORT) {
    return new Promise((resolve, reject) => {
        const app = createTestApp();
        server = app.listen(port, () => {
            resolve();
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                setTimeout(() => {
                    server = app.listen(port, () => resolve());
                }, 1000);
            }
            else {
                reject(err);
            }
        });
    });
}
async function stopServer() {
    return new Promise((resolve) => {
        if (server) {
            server.close(() => resolve());
        }
        else {
            resolve();
        }
    });
}
async function loginAs(email, port = exports.TEST_PORT) {
    const res = await fetch(`http://localhost:${port}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123' })
    });
    const body = await res.json();
    return body.data.token;
}
function authHeader(token) {
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}
