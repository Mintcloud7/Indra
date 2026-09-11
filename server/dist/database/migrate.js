"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrate = migrate;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const connection_1 = require("./connection");
async function migrate() {
    const db = await (0, connection_1.getDb)();
    const schemaPath = path_1.default.resolve(__dirname, 'schema.sql');
    const schema = fs_1.default.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
    const addColumnIfMissing = (table, column, type, defaultVal) => {
        try {
            const result = db.exec(`PRAGMA table_info(${table})`);
            if (result[0]) {
                const columns = result[0].values.map((r) => r[1]);
                if (!columns.includes(column)) {
                    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type} DEFAULT ${defaultVal}`);
                }
            }
        }
        catch { }
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
    // Update existing users with username based on email prefix
    try {
        db.exec(`UPDATE users SET username = SUBSTR(email, 1, INSTR(email, '@') - 1) WHERE username = 'user' OR username IS NULL`);
    }
    catch { }
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
    }
    catch { }
    try {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_log_book_items_log ON log_book_items(logBookId)`);
    }
    catch { }
    console.log('Database migration complete.');
}
