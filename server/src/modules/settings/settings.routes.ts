import { Router } from 'express';
import { AuthRequest } from '../../shared/types';
import { sendSuccess } from '../../shared/response';
import { getDb } from '../../database/connection';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

const DEFAULT_SETTINGS: Record<string, any> = {
  companyName: 'CMMS Indra',
  logoUrl: '',
  maintenanceEmail: 'maintenance@example.com',
  autoAssignWorkOrders: false,
  pmNotificationDays: '7',
  lowStockThreshold: '5',
  downtime_good_threshold: '4',
  downtime_warning_threshold: '8',
  mtbf_good_threshold: '720',
  mtbf_warning_threshold: '168',
};

const uploadsDir = path.resolve(process.cwd(), 'uploads');
let upload: multer.Multer;

try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `logo-${Date.now()}${ext}`);
    },
  });
  upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, allowed.includes(ext));
    },
  });
} catch {
  upload = multer({ storage: multer.memoryStorage() });
}

router.use(authenticate);

router.get('/', requirePermission('settings', 'read'), async (req: AuthRequest, res, next) => {
  try {
    const db = await getDb();
    let settings = { ...DEFAULT_SETTINGS };

    try {
      const result = await db.exec("SELECT key, value FROM settings");
      if (result[0]) {
        for (const row of result[0].values) {
          const key = row[0] as string;
          const val = row[1] as string;
          if (key in settings) {
            settings[key] = val === 'true' ? true : val === 'false' ? false : val;
          }
        }
      }
    } catch {}

    sendSuccess(res, settings);
  } catch (err) {
    next(err);
  }
});

router.put('/', requirePermission('settings', 'update'), async (req: AuthRequest, res, next) => {
  try {
    const db = await getDb();
    try { await db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"); } catch {}

    for (const [key, value] of Object.entries(req.body)) {
      await db.run(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        [key, String(value)]
      );
    }

    sendSuccess(res, req.body);
  } catch (err) {
    next(err);
  }
});

router.post('/logo', requirePermission('settings', 'update'), upload.single('logo'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }
    const logoUrl = `/uploads/${req.file.filename}`;
    const db = await getDb();
    try { await db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"); } catch {}
    await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ['logoUrl', logoUrl]);
    sendSuccess(res, { logoUrl });
  } catch (err) {
    next(err);
  }
});

export default router;
