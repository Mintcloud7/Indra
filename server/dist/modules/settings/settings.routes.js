"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const response_1 = require("../../shared/response");
const connection_1 = require("../../database/connection");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
const DEFAULT_SETTINGS = {
    companyName: 'CMMS Indra',
    logoUrl: '',
    maintenanceEmail: 'maintenance@example.com',
    autoAssignWorkOrders: false,
    pmNotificationDays: '7',
    lowStockThreshold: '5',
};
const uploadsDir = path_1.default.resolve(process.cwd(), 'uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        cb(null, `logo-${Date.now()}${ext}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
    },
});
router.use(auth_1.authenticate);
router.get('/', (0, rbac_1.requirePermission)('settings', 'read'), async (req, res, next) => {
    try {
        const db = await (0, connection_1.getDb)();
        let settings = { ...DEFAULT_SETTINGS };
        try {
            const result = db.exec("SELECT key, value FROM settings");
            if (result[0]) {
                for (const row of result[0].values) {
                    const key = row[0];
                    const val = row[1];
                    if (key in settings) {
                        settings[key] = val === 'true' ? true : val === 'false' ? false : val;
                    }
                }
            }
        }
        catch { }
        (0, response_1.sendSuccess)(res, settings);
    }
    catch (err) {
        next(err);
    }
});
router.put('/', (0, rbac_1.requirePermission)('settings', 'update'), async (req, res, next) => {
    try {
        const db = await (0, connection_1.getDb)();
        try {
            db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)");
        }
        catch { }
        for (const [key, value] of Object.entries(req.body)) {
            db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, String(value)]);
        }
        (0, response_1.sendSuccess)(res, req.body);
    }
    catch (err) {
        next(err);
    }
});
router.post('/logo', (0, rbac_1.requirePermission)('settings', 'update'), upload.single('logo'), async (req, res, next) => {
    try {
        if (!req.file) {
            res.status(400).json({ success: false, message: 'No file uploaded' });
            return;
        }
        const logoUrl = `/uploads/${req.file.filename}`;
        const db = await (0, connection_1.getDb)();
        try {
            db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)");
        }
        catch { }
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ['logoUrl', logoUrl]);
        (0, response_1.sendSuccess)(res, { logoUrl });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
