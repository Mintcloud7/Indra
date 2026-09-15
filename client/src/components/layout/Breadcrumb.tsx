import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const routeNames: Record<string, string> = {
  dashboard: 'Dashboard',
  'work-orders': 'Work Orders',
  'preventive-maintenance': 'Preventive Maintenance',
  assets: 'Assets',
  inventory: 'Inventory',
  'spare-parts': 'Spare Parts',
  warehouses: 'Warehouses',
  transactions: 'Transactions',
  'low-stock': 'Low Stock',
  'purchase-requisitions': 'Purchase Requests',
  reports: 'Reports',
  'work-orders-report': 'Work Order Report',
  'maintenance-cost': 'Maintenance Cost',
  'spare-part-usage': 'Spare Part Usage',
  downtime: 'Downtime',
  mtbf: 'MTBF',
  admin: 'Administration',
  users: 'Users',
  roles: 'Roles',
  'audit-logs': 'Audit Logs',
  settings: 'Settings',
  integrations: 'Integration',
  zahir: 'Zahir Accounting (SaaS)',
  logs: 'Integration Logs',
  'failed-jobs': 'Failed Jobs',
  notifications: 'Notifications',
  create: 'Create',
  edit: 'Edit',
};

export default function Breadcrumb() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(x => x);

  return (
    <nav className="flex items-center gap-2 text-sm overflow-x-auto scrollbar-none pb-1">
      <Link
        to="/dashboard"
        className="text-slate-400 hover:text-slate-600 transition-colors"
      >
        <Home className="h-4 w-4" />
      </Link>
      {pathnames.map((name, index) => {
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const displayName = routeNames[name] || name;

        return (
          <React.Fragment key={routeTo}>
            <ChevronRight className="h-4 w-4 text-slate-300" />
            {isLast ? (
              <span className="text-slate-700 font-medium">{displayName}</span>
            ) : (
              <Link
                to={routeTo}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                {displayName}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
