"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const migrate_1 = require("./database/migrate");
const connection_1 = require("./database/connection");
const error_1 = require("./middleware/error");
const auth_1 = require("./middleware/auth");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const users_routes_1 = __importDefault(require("./modules/users/users.routes"));
const roles_routes_1 = __importDefault(require("./modules/roles/roles.routes"));
const assets_routes_1 = __importDefault(require("./modules/assets/assets.routes"));
const work_orders_routes_1 = __importDefault(require("./modules/work-orders/work-orders.routes"));
const pm_routes_1 = __importDefault(require("./modules/preventive-maintenance/pm.routes"));
const inventory_routes_1 = __importDefault(require("./modules/inventory/inventory.routes"));
const notifications_routes_1 = __importDefault(require("./modules/notifications/notifications.routes"));
const reports_routes_1 = __importDefault(require("./modules/reports/reports.routes"));
const dashboard_routes_1 = __importDefault(require("./modules/dashboard/dashboard.routes"));
const pr_routes_1 = __importDefault(require("./modules/purchase-requisitions/pr.routes"));
const audit_logs_routes_1 = __importDefault(require("./modules/audit-logs/audit-logs.routes"));
const integrations_routes_1 = __importDefault(require("./modules/integrations/integrations.routes"));
const settings_routes_1 = __importDefault(require("./modules/settings/settings.routes"));
const log_books_routes_1 = __importDefault(require("./modules/log-books/log-books.routes"));
const integration_queue_service_1 = require("./modules/integrations/queue/integration-queue.service");
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '3001', 10);
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use('/uploads', express_1.default.static(path_1.default.resolve(process.cwd(), 'uploads')));
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
app.use('/api/audit-logs', auth_1.authenticate, audit_logs_routes_1.default);
app.use('/api/integrations', auth_1.authenticate, integrations_routes_1.default);
app.use('/api/settings', auth_1.authenticate, settings_routes_1.default);
app.use('/api/log-books', auth_1.authenticate, log_books_routes_1.default);
app.use(error_1.errorHandler);
async function start() {
    try {
        await (0, migrate_1.migrate)();
        console.log('Database migrated successfully.');
        app.listen(PORT, () => {
            console.log(`CMMS Indra server running on port ${PORT}`);
            integration_queue_service_1.integrationQueueService.startScheduler();
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
process.on('SIGINT', () => {
    console.log('Shutting down...');
    integration_queue_service_1.integrationQueueService.stopScheduler();
    (0, connection_1.saveDb)();
    (0, connection_1.closeDb)();
    process.exit(0);
});
process.on('SIGTERM', () => {
    integration_queue_service_1.integrationQueueService.stopScheduler();
    (0, connection_1.saveDb)();
    (0, connection_1.closeDb)();
    process.exit(0);
});
start();
exports.default = app;
