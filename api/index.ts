import express from 'express';
import cors from 'cors';
import { migrate } from '../server/src/database/migrate';
import { errorHandler } from '../server/src/middleware/error';
import { authenticate } from '../server/src/middleware/auth';

import authRoutes from '../server/src/modules/auth/auth.routes';
import usersRoutes from '../server/src/modules/users/users.routes';
import rolesRoutes from '../server/src/modules/roles/roles.routes';
import assetsRoutes from '../server/src/modules/assets/assets.routes';
import workOrdersRoutes from '../server/src/modules/work-orders/work-orders.routes';
import pmRoutes from '../server/src/modules/preventive-maintenance/pm.routes';
import inventoryRoutes from '../server/src/modules/inventory/inventory.routes';
import notificationsRoutes from '../server/src/modules/notifications/notifications.routes';
import reportsRoutes from '../server/src/modules/reports/reports.routes';
import dashboardRoutes from '../server/src/modules/dashboard/dashboard.routes';
import prRoutes from '../server/src/modules/purchase-requisitions/pr.routes';
import auditLogsRoutes from '../server/src/modules/audit-logs/audit-logs.routes';
import integrationsRoutes from '../server/src/modules/integrations/integrations.routes';
import settingsRoutes from '../server/src/modules/settings/settings.routes';
import logBooksRoutes from '../server/src/modules/log-books/log-books.routes';

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
app.use('/api/audit-logs', authenticate, auditLogsRoutes);
app.use('/api/integrations', authenticate, integrationsRoutes);
app.use('/api/settings', authenticate, settingsRoutes);
app.use('/api/log-books', authenticate, logBooksRoutes);

app.use(errorHandler);

let migrated = false;

async function ensureMigrated() {
  if (!migrated) {
    await migrate();
    migrated = true;
  }
}

export default async function handler(req: any, res: any) {
  await ensureMigrated();
  return app(req, res);
}
