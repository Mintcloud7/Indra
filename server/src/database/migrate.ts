import fs from 'fs';
import path from 'path';
import { getDb } from './connection';

export async function migrate(): Promise<void> {
  const db = await getDb();
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  
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
