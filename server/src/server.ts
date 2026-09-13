import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { migrate } from './database/migrate';
import { closeDb } from './database/connection';
import { errorHandler } from './middleware/error';
import { authenticate } from './middleware/auth';

import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import rolesRoutes from './modules/roles/roles.routes';
import assetsRoutes from './modules/assets/assets.routes';
import workOrdersRoutes from './modules/work-orders/work-orders.routes';
import pmRoutes from './modules/preventive-maintenance/pm.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import reportsRoutes from './modules/reports/reports.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import prRoutes from './modules/purchase-requisitions/pr.routes';
import auditLogsRoutes from './modules/audit-logs/audit-logs.routes';
import integrationsRoutes from './modules/integrations/integrations.routes';
import settingsRoutes from './modules/settings/settings.routes';
import logBooksRoutes from './modules/log-books/log-books.routes';
import { integrationQueueService } from './modules/integrations/queue/integration-queue.service';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

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

async function start() {
  try {
    await migrate();
    console.log('Database migrated successfully.');

    app.listen(PORT, () => {
      console.log(`CMMS Indra server running on port ${PORT}`);
      integrationQueueService.startScheduler();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('Shutting down...');
  integrationQueueService.stopScheduler();
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  integrationQueueService.stopScheduler();
  closeDb();
  process.exit(0);
});

start();

export default app;
