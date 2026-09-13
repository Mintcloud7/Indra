import { getDb } from './connection';

const SCHEMA_SQL = `-- Auth & RBAC
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE, password TEXT NOT NULL, name TEXT NOT NULL, phone TEXT, avatar TEXT, isActive INTEGER DEFAULT 1, createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, description TEXT, createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS permissions (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, module TEXT NOT NULL, action TEXT NOT NULL, description TEXT, createdAt TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS user_roles (id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, roleId TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE, UNIQUE(userId, roleId));
CREATE TABLE IF NOT EXISTS role_permissions (id TEXT PRIMARY KEY, roleId TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permissionId TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE, UNIQUE(roleId, permissionId));
CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, assetCode TEXT UNIQUE NOT NULL, assetName TEXT NOT NULL, assetType TEXT NOT NULL, location TEXT NOT NULL, serialNumber TEXT, manufacturer TEXT, model TEXT, purchaseDate TEXT, warrantyStart TEXT, warrantyEnd TEXT, status TEXT DEFAULT 'ACTIVE', description TEXT, createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS asset_documents (id TEXT PRIMARY KEY, assetId TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE, filename TEXT NOT NULL, type TEXT NOT NULL, path TEXT NOT NULL, size INTEGER NOT NULL, uploadedBy TEXT NOT NULL REFERENCES users(id), uploadedAt TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS asset_meters (id TEXT PRIMARY KEY, assetId TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE, meterType TEXT NOT NULL, unit TEXT NOT NULL, description TEXT, createdAt TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS asset_meter_readings (id TEXT PRIMARY KEY, meterId TEXT NOT NULL REFERENCES asset_meters(id) ON DELETE CASCADE, assetId TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE, value REAL NOT NULL, readingDate TEXT DEFAULT (datetime('now')), recordedBy TEXT NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS work_orders (id TEXT PRIMARY KEY, woNumber TEXT UNIQUE NOT NULL, title TEXT NOT NULL, description TEXT, assetId TEXT REFERENCES assets(id), location TEXT, reportedById TEXT NOT NULL REFERENCES users(id), supervisorId TEXT REFERENCES users(id), assignedToId TEXT REFERENCES users(id), priority TEXT DEFAULT 'MEDIUM', status TEXT DEFAULT 'OPEN', dueDate TEXT, createdAt TEXT DEFAULT (datetime('now')), assignedAt TEXT, startedAt TEXT, completedAt TEXT, closedAt TEXT, problemDescription TEXT, repairInstruction TEXT, workPerformed TEXT, rootCause TEXT, resolution TEXT, notes TEXT);
CREATE TABLE IF NOT EXISTS work_order_status_history (id TEXT PRIMARY KEY, woId TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE, fromStatus TEXT, toStatus TEXT NOT NULL, changedBy TEXT NOT NULL REFERENCES users(id), notes TEXT, createdAt TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS work_order_checklists (id TEXT PRIMARY KEY, woId TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, required INTEGER DEFAULT 1, completed INTEGER DEFAULT 0, completedBy TEXT REFERENCES users(id), completedAt TEXT, notes TEXT);
CREATE TABLE IF NOT EXISTS work_order_attachments (id TEXT PRIMARY KEY, woId TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE, filename TEXT NOT NULL, originalName TEXT NOT NULL, mimeType TEXT NOT NULL, path TEXT NOT NULL, size INTEGER NOT NULL, uploadedBy TEXT NOT NULL REFERENCES users(id), createdAt TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS work_order_spare_parts (id TEXT PRIMARY KEY, woId TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE, itemId TEXT NOT NULL REFERENCES spare_parts(id), plannedQuantity REAL, usedQuantity REAL, unit TEXT, unitCost REAL DEFAULT 0, totalCost REAL DEFAULT 0, createdAt TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS preventive_maintenance (id TEXT PRIMARY KEY, assetId TEXT NOT NULL REFERENCES assets(id), title TEXT NOT NULL, description TEXT, frequency TEXT DEFAULT 'MONTHLY', customIntervalDays INTEGER, startDate TEXT NOT NULL, nextDueDate TEXT, meterType TEXT, meterThreshold REAL, assignedToId TEXT REFERENCES users(id), status TEXT DEFAULT 'ACTIVE', createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS pm_checklists (id TEXT PRIMARY KEY, pmId TEXT NOT NULL REFERENCES preventive_maintenance(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, required INTEGER DEFAULT 1, createdAt TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS pm_logs (id TEXT PRIMARY KEY, pmId TEXT NOT NULL REFERENCES preventive_maintenance(id) ON DELETE CASCADE, woId TEXT, completedAt TEXT DEFAULT (datetime('now')), notes TEXT);
CREATE TABLE IF NOT EXISTS pm_wos (id TEXT PRIMARY KEY, pmId TEXT NOT NULL REFERENCES preventive_maintenance(id) ON DELETE CASCADE, woId TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE, createdAt TEXT DEFAULT (datetime('now')), UNIQUE(pmId, woId));
CREATE TABLE IF NOT EXISTS warehouses (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, location TEXT, description TEXT, createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS spare_parts (id TEXT PRIMARY KEY, itemCode TEXT UNIQUE NOT NULL, itemName TEXT NOT NULL, category TEXT, specification TEXT, unit TEXT DEFAULT 'PCS', warehouseId TEXT REFERENCES warehouses(id), stockLocation TEXT, currentStock REAL DEFAULT 0, minimumStock REAL DEFAULT 0, maximumStock REAL DEFAULT 0, unitCost REAL DEFAULT 0, zahirItemId TEXT, lastSync TEXT, createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS inventory_transactions (id TEXT PRIMARY KEY, itemId TEXT NOT NULL REFERENCES spare_parts(id), warehouseId TEXT NOT NULL REFERENCES warehouses(id), transactionType TEXT NOT NULL, quantity REAL NOT NULL, unitCost REAL DEFAULT 0, referenceType TEXT, referenceId TEXT, notes TEXT, createdBy TEXT NOT NULL REFERENCES users(id), createdAt TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, referenceType TEXT, referenceId TEXT, read INTEGER DEFAULT 0, createdAt TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS purchase_requisitions (id TEXT PRIMARY KEY, itemId TEXT REFERENCES spare_parts(id), customItemName TEXT, customItemCode TEXT, quantity REAL NOT NULL, unit TEXT, reason TEXT, currentStock REAL, minimumStock REAL, status TEXT DEFAULT 'DRAFT', receivedAt TEXT, externalPrId TEXT, syncStatus TEXT, syncError TEXT, createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS integration_configs (id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, value TEXT, encrypted INTEGER DEFAULT 0, description TEXT, createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS integration_jobs (id TEXT PRIMARY KEY, type TEXT NOT NULL, provider TEXT DEFAULT 'zahir', referenceType TEXT, referenceId TEXT, payload TEXT NOT NULL, status TEXT DEFAULT 'PENDING', attempts INTEGER DEFAULT 0, maxAttempts INTEGER DEFAULT 5, nextRetryAt TEXT, lastError TEXT, externalId TEXT, idempotencyKey TEXT UNIQUE, createdAt TEXT DEFAULT (datetime('now')), processedAt TEXT);
CREATE TABLE IF NOT EXISTS integration_logs (id TEXT PRIMARY KEY, type TEXT NOT NULL, provider TEXT DEFAULT 'zahir', endpoint TEXT, requestId TEXT, referenceType TEXT, referenceId TEXT, status TEXT NOT NULL, externalId TEXT, error TEXT, responseStatus INTEGER, responseMessage TEXT, duration INTEGER, createdAt TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS webhook_events (id TEXT PRIMARY KEY, externalEventId TEXT UNIQUE, source TEXT NOT NULL, eventType TEXT NOT NULL, payload TEXT NOT NULL, status TEXT DEFAULT 'RECEIVED', processedAt TEXT, error TEXT, createdAt TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS log_books (id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id), workDate TEXT NOT NULL, location TEXT, assetId TEXT REFERENCES assets(id), workOrderNo TEXT, activityType TEXT DEFAULT 'CORRECTIVE', description TEXT NOT NULL, status TEXT DEFAULT 'DRAFT', createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS log_book_items (id TEXT PRIMARY KEY, logBookId TEXT NOT NULL REFERENCES log_books(id) ON DELETE CASCADE, description TEXT NOT NULL, activityType TEXT DEFAULT 'CORRECTIVE', location TEXT, assetId TEXT REFERENCES assets(id), workOrderNo TEXT, durationMinutes INTEGER, status TEXT DEFAULT 'COMPLETED', notes TEXT, createdAt TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS log_book_spare_parts (id TEXT PRIMARY KEY, logBookId TEXT NOT NULL REFERENCES log_books(id) ON DELETE CASCADE, logBookItemId TEXT REFERENCES log_book_items(id) ON DELETE SET NULL, sparePartId TEXT NOT NULL REFERENCES spare_parts(id), quantity REAL NOT NULL DEFAULT 1, unitCost REAL DEFAULT 0, notes TEXT, createdAt TEXT DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_log_books_user ON log_books(userId);
CREATE INDEX IF NOT EXISTS idx_log_books_date ON log_books(workDate);
CREATE INDEX IF NOT EXISTS idx_log_book_items_log ON log_book_items(logBookId);
CREATE INDEX IF NOT EXISTS idx_log_book_sp_log ON log_book_spare_parts(logBookId);
CREATE INDEX IF NOT EXISTS idx_log_book_sp_item ON log_book_spare_parts(sparePartId);
CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, userId TEXT REFERENCES users(id), action TEXT NOT NULL, entity TEXT NOT NULL, entityId TEXT, oldValue TEXT, newValue TEXT, ipAddress TEXT, userAgent TEXT, createdAt TEXT DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(userId);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(roleId);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(roleId);
CREATE INDEX IF NOT EXISTS idx_assets_code ON assets(assetCode);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_wo_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_wo_number ON work_orders(woNumber);
CREATE INDEX IF NOT EXISTS idx_wo_asset ON work_orders(assetId);
CREATE INDEX IF NOT EXISTS idx_wo_assigned ON work_orders(assignedToId);
CREATE INDEX IF NOT EXISTS idx_wo_supervisor ON work_orders(supervisorId);
CREATE INDEX IF NOT EXISTS idx_wo_reported ON work_orders(reportedById);
CREATE INDEX IF NOT EXISTS idx_wo_due ON work_orders(dueDate);
CREATE INDEX IF NOT EXISTS idx_wo_created ON work_orders(createdAt);
CREATE INDEX IF NOT EXISTS idx_wo_history_wo ON work_order_status_history(woId);
CREATE INDEX IF NOT EXISTS idx_wo_checklist_wo ON work_order_checklists(woId);
CREATE INDEX IF NOT EXISTS idx_wo_attach_wo ON work_order_attachments(woId);
CREATE INDEX IF NOT EXISTS idx_wo_spare_wo ON work_order_spare_parts(woId);
CREATE INDEX IF NOT EXISTS idx_pm_asset ON preventive_maintenance(assetId);
CREATE INDEX IF NOT EXISTS idx_pm_due ON preventive_maintenance(nextDueDate);
CREATE INDEX IF NOT EXISTS idx_pm_status ON preventive_maintenance(status);
CREATE INDEX IF NOT EXISTS idx_spare_code ON spare_parts(itemCode);
CREATE INDEX IF NOT EXISTS idx_spare_warehouse ON spare_parts(warehouseId);
CREATE INDEX IF NOT EXISTS idx_inv_trans_item ON inventory_transactions(itemId);
CREATE INDEX IF NOT EXISTS idx_inv_trans_warehouse ON inventory_transactions(warehouseId);
CREATE INDEX IF NOT EXISTS idx_inv_trans_type ON inventory_transactions(transactionType);
CREATE INDEX IF NOT EXISTS idx_inv_trans_created ON inventory_transactions(createdAt);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(userId);
CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON integration_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_retry ON integration_jobs(nextRetryAt);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON integration_jobs(type);
CREATE INDEX IF NOT EXISTS idx_logs_type ON integration_logs(type);
CREATE INDEX IF NOT EXISTS idx_logs_created ON integration_logs(createdAt);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(userId);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entityId);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(createdAt);`;

export async function migrate(): Promise<void> {
  const db = await getDb();
  const schema = SCHEMA_SQL;
  
  // Execute each statement individually for libsql compatibility
  const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    try {
      await db.exec(stmt);
    } catch (e: any) {
      // Ignore "already exists" errors during migration
      if (!e.message?.includes('already exists')) {
        console.log('Migration statement warning:', e.message);
      }
    }
  }

  const addColumnIfMissing = async (table: string, column: string, type: string, defaultVal: string) => {
    try {
      const result = await db.exec(`PRAGMA table_info(${table})`);
      if (result[0]) {
        const columns = result[0].values.map((r: any[]) => r[1]);
        if (!columns.includes(column)) {
          await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type} DEFAULT ${defaultVal}`);
        }
      }
    } catch {}
  };

  await addColumnIfMissing('integration_jobs', 'provider', 'TEXT', "'zahir'");
  await addColumnIfMissing('integration_logs', 'provider', 'TEXT', "'zahir'");
  await addColumnIfMissing('log_book_spare_parts', 'logBookItemId', 'TEXT', 'NULL');
  await addColumnIfMissing('pm_checklists', 'completed', 'INTEGER', '0');
  await addColumnIfMissing('pm_checklists', 'completedBy', 'TEXT', 'NULL');
  await addColumnIfMissing('pm_checklists', 'completedAt', 'TEXT', 'NULL');
  await addColumnIfMissing('purchase_requisitions', 'receivedAt', 'TEXT', 'NULL');
  await addColumnIfMissing('purchase_requisitions', 'customItemName', 'TEXT', 'NULL');
  await addColumnIfMissing('purchase_requisitions', 'customItemCode', 'TEXT', 'NULL');
  await addColumnIfMissing('users', 'username', 'TEXT', "'user'");

  // Recreate users table to make email nullable
  try {
    const tableInfo = await db.exec("PRAGMA table_info(users)");
    if (tableInfo[0]) {
      const emailCol = tableInfo[0].values.find((r: any[]) => r[1] === 'email');
      if (emailCol && emailCol[3] === 1) {
        await db.exec(`CREATE TABLE users_new (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          email TEXT,
          password TEXT NOT NULL,
          name TEXT NOT NULL,
          phone TEXT,
          avatar TEXT,
          isActive INTEGER DEFAULT 1,
          createdAt TEXT DEFAULT (datetime('now')),
          updatedAt TEXT DEFAULT (datetime('now'))
        )`);
        await db.exec(`INSERT INTO users_new (id, username, email, password, name, phone, avatar, isActive, createdAt, updatedAt)
                 SELECT id, username, email, password, name, phone, avatar, isActive, createdAt, updatedAt FROM users`);
        await db.exec(`DROP TABLE users`);
        await db.exec(`ALTER TABLE users_new RENAME TO users`);
      }
    }
  } catch (e: any) { console.log('Email migration skip:', e.message); }

  await addColumnIfMissing('settings', 'downtime_good_threshold', 'TEXT', "'4'");
  await addColumnIfMissing('settings', 'downtime_warning_threshold', 'TEXT', "'8'");
  await addColumnIfMissing('settings', 'mtbf_good_threshold', 'TEXT', "'720'");
  await addColumnIfMissing('settings', 'mtbf_warning_threshold', 'TEXT', "'168'");

  try {
    await db.exec(`UPDATE users SET username = SUBSTR(email, 1, INSTR(email, '@') - 1) WHERE username = 'user' OR username IS NULL`);
  } catch {}

  try {
    await db.exec(`CREATE TABLE IF NOT EXISTS log_book_items (
      id TEXT PRIMARY KEY,
      logBookId TEXT NOT NULL REFERENCES log_books(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      activityType TEXT DEFAULT 'CORRECTIVE',
      location TEXT,
      assetId TEXT REFERENCES assets(id),
      workOrderNo TEXT,
      durationMinutes INTEGER,
      status TEXT DEFAULT 'COMPLETED',
      notes TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    )`);
  } catch {}

  try {
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_log_book_items_log ON log_book_items(logBookId)`);
  } catch {}

  console.log('Database migration complete.');
}
