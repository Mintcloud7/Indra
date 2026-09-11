import fs from 'fs';
import path from 'path';
import { getDb } from './connection';

export async function migrate(): Promise<void> {
  const db = await getDb();
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  const addColumnIfMissing = (table: string, column: string, type: string, defaultVal: string) => {
    try {
      const result = db.exec(`PRAGMA table_info(${table})`);
      if (result[0]) {
        const columns = result[0].values.map((r: any[]) => r[1]);
        if (!columns.includes(column)) {
          db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type} DEFAULT ${defaultVal}`);
        }
      }
    } catch {}
  };

  addColumnIfMissing('integration_jobs', 'provider', 'TEXT', "'zahir'");
  addColumnIfMissing('integration_logs', 'provider', 'TEXT', "'zahir'");
  addColumnIfMissing('log_book_spare_parts', 'logBookItemId', 'TEXT', 'NULL');
  addColumnIfMissing('pm_checklists', 'completed', 'INTEGER', '0');
  addColumnIfMissing('pm_checklists', 'completedBy', 'TEXT', 'NULL');
  addColumnIfMissing('pm_checklists', 'completedAt', 'TEXT', 'NULL');
  addColumnIfMissing('purchase_requisitions', 'receivedAt', 'TEXT', 'NULL');
  addColumnIfMissing('purchase_requisitions', 'customItemName', 'TEXT', 'NULL');
  addColumnIfMissing('purchase_requisitions', 'customItemCode', 'TEXT', 'NULL');
  addColumnIfMissing('users', 'username', 'TEXT', "'user'");

  // Recreate users table to make email nullable (SQLite doesn't support ALTER COLUMN)
  try {
    const tableInfo = db.exec("PRAGMA table_info(users)");
    if (tableInfo[0]) {
      const emailCol = tableInfo[0].values.find((r: any[]) => r[1] === 'email');
      if (emailCol && emailCol[3] === 1) { // notnull = 1 means NOT NULL
        db.exec(`CREATE TABLE users_new (
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
        db.exec(`INSERT INTO users_new (id, username, email, password, name, phone, avatar, isActive, createdAt, updatedAt)
                 SELECT id, username, email, password, name, phone, avatar, isActive, createdAt, updatedAt FROM users`);
        db.exec(`DROP TABLE users`);
        db.exec(`ALTER TABLE users_new RENAME TO users`);
      }
    }
  } catch (e) { console.log('Email migration skip:', e); }

  // Downtime threshold settings
  addColumnIfMissing('settings', 'downtime_good_threshold', 'TEXT', "'4'");
  addColumnIfMissing('settings', 'downtime_warning_threshold', 'TEXT', "'8'");
  addColumnIfMissing('settings', 'mtbf_good_threshold', 'TEXT', "'720'");
  addColumnIfMissing('settings', 'mtbf_warning_threshold', 'TEXT', "'168'");

  // Update existing users with username based on email prefix
  try {
    db.exec(`UPDATE users SET username = SUBSTR(email, 1, INSTR(email, '@') - 1) WHERE username = 'user' OR username IS NULL`);
  } catch {}

  try {
    db.exec(`CREATE TABLE IF NOT EXISTS log_book_items (
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
    db.exec(`CREATE INDEX IF NOT EXISTS idx_log_book_items_log ON log_book_items(logBookId)`);
  } catch {}

  console.log('Database migration complete.');
}
