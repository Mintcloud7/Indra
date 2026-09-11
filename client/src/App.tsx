import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { SettingsProvider } from './context/SettingsContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';

// Auth
import LoginPage from './pages/auth/LoginPage';

// Dashboard
import DashboardPage from './pages/dashboard/DashboardPage';

// Work Orders
import WorkOrderListPage from './pages/work-orders/WorkOrderListPage';
import WorkOrderDetailPage from './pages/work-orders/WorkOrderDetailPage';
import WorkOrderCreatePage from './pages/work-orders/WorkOrderCreatePage';
import WorkOrderEditPage from './pages/work-orders/WorkOrderEditPage';

// Assets
import AssetListPage from './pages/assets/AssetListPage';
import AssetDetailPage from './pages/assets/AssetDetailPage';
import AssetCreatePage from './pages/assets/AssetCreatePage';

// Preventive Maintenance
import PMCalendarPage from './pages/preventive-maintenance/PMCalendarPage';
import PMListPage from './pages/preventive-maintenance/PMListPage';
import PMDetailPage from './pages/preventive-maintenance/PMDetailPage';
import PMCreatePage from './pages/preventive-maintenance/PMCreatePage';

// Inventory
import SparePartListPage from './pages/inventory/SparePartListPage';
import SparePartDetailPage from './pages/inventory/SparePartDetailPage';
import WarehouseListPage from './pages/inventory/WarehouseListPage';
import InventoryTransactionsPage from './pages/inventory/InventoryTransactionsPage';
import LowStockPage from './pages/inventory/LowStockPage';
import PurchaseRequisitionListPage from './pages/inventory/PurchaseRequisitionListPage';

// Reports
import WorkOrderReportPage from './pages/reports/WorkOrderReportPage';
import WorkOrderReportDetailPage from './pages/reports/WorkOrderReportDetailPage';
import MaintenanceCostPage from './pages/reports/MaintenanceCostPage';
import SparePartUsagePage from './pages/reports/SparePartUsagePage';
import MTTRPage from './pages/reports/MTTRPage';
import MTBFPage from './pages/reports/MTBFPage';

// Admin
import UserListPage from './pages/admin/UserListPage';
import RoleListPage from './pages/admin/RoleListPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import SettingsPage from './pages/admin/SettingsPage';
import AccountSettingsPage from './pages/admin/AccountSettingsPage';

// Integrations
import IntegrationConfigPage from './pages/integrations/IntegrationConfigPage';
import IntegrationLogsPage from './pages/integrations/IntegrationLogsPage';
import FailedJobsPage from './pages/integrations/FailedJobsPage';

// Log Book
import LogBookListPage from './pages/log-books/LogBookListPage';
import LogBookCreatePage from './pages/log-books/LogBookCreatePage';
import LogBookDetailPage from './pages/log-books/LogBookDetailPage';

// Notifications
import NotificationCenter from './pages/notifications/NotificationCenter';

function DefaultRedirect() {
  const { user } = useAuth();
  const roles = (user?.roles || []).map((r: any) => typeof r === 'string' ? r : r.name);
  if (roles.includes('TECHNICIAN')) return <Navigate to="/preventive-maintenance" replace />;
  if (roles.includes('PRODUCTION')) return <Navigate to="/work-orders" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <SettingsProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/dashboard" element={<DashboardPage />} />

                      <Route path="/work-orders" element={<WorkOrderListPage />} />
                      <Route path="/work-orders/create" element={<WorkOrderCreatePage />} />
                      <Route path="/work-orders/:id/edit" element={<WorkOrderEditPage />} />
                      <Route path="/work-orders/:id" element={<WorkOrderDetailPage />} />

                      <Route path="/assets" element={<AssetListPage />} />
                      <Route path="/assets/create" element={<AssetCreatePage />} />
                      <Route path="/assets/:id" element={<AssetDetailPage />} />

                      <Route path="/preventive-maintenance" element={<PMCalendarPage />} />
                      <Route path="/preventive-maintenance/list" element={<PMListPage />} />
                      <Route path="/preventive-maintenance/create" element={<PMCreatePage />} />
                      <Route path="/preventive-maintenance/:id" element={<PMDetailPage />} />

                      <Route path="/inventory/spare-parts" element={<SparePartListPage />} />
                      <Route path="/inventory/spare-parts/:id" element={<SparePartDetailPage />} />
                      <Route path="/inventory/warehouses" element={<WarehouseListPage />} />
                      <Route path="/inventory/transactions" element={<InventoryTransactionsPage />} />
                      <Route path="/inventory/low-stock" element={<LowStockPage />} />
                      <Route path="/inventory/purchase-requisitions" element={<PurchaseRequisitionListPage />} />

                      <Route path="/reports/work-orders" element={<WorkOrderReportPage />} />
                      <Route path="/reports/work-orders/:id" element={<WorkOrderReportDetailPage />} />
                      <Route path="/reports/maintenance-cost" element={<MaintenanceCostPage />} />
                      <Route path="/reports/spare-part-usage" element={<SparePartUsagePage />} />
                      <Route path="/reports/downtime" element={<MTTRPage />} />
                      <Route path="/reports/mtbf" element={<MTBFPage />} />

                      <Route path="/admin/users" element={<UserListPage />} />
                      <Route path="/admin/roles" element={<RoleListPage />} />
                      <Route path="/admin/audit-logs" element={<AuditLogPage />} />
                      <Route path="/admin/settings" element={<SettingsPage />} />
                      <Route path="/admin/account" element={<AccountSettingsPage />} />

                      <Route path="/integrations/config" element={<IntegrationConfigPage />} />
                      <Route path="/integrations/logs" element={<IntegrationLogsPage />} />
                      <Route path="/integrations/failed-jobs" element={<FailedJobsPage />} />

                      <Route path="/log-books" element={<LogBookListPage />} />
                      <Route path="/log-books/create" element={<LogBookCreatePage />} />
                      <Route path="/log-books/:id/edit" element={<LogBookCreatePage />} />
                      <Route path="/log-books/:id" element={<LogBookDetailPage />} />

                      <Route path="/notifications" element={<NotificationCenter />} />

                      <Route path="*" element={<DefaultRedirect />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
          </SettingsProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
