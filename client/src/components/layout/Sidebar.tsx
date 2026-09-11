import React, { useState, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Wrench,
  ClipboardList,
  CalendarCheck,
  Box,
  Package,
  Archive,
  Warehouse,
  ArrowLeftRight,
  AlertTriangle,
  BarChart3,
  FileBarChart,
  DollarSign,
  PackageSearch,
  Clock,
  FileText,
  Activity,
  Shield,
  Users,
  ScrollText,
  Settings,
  Link as LinkIcon,
  Plug,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  BookOpen,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';

interface SidebarChild {
  label: string;
  path: string;
  icon: React.ReactNode;
  permission?: string;
}

interface SidebarItem {
  label: string;
  path?: string;
  icon: React.ReactNode;
  permission?: string;
  children?: SidebarChild[];
}

const sidebarItems: SidebarItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" />, permission: 'dashboard.read' },
  {
    label: 'Maintenance',
    icon: <Wrench className="h-5 w-5" />,
    children: [
      { label: 'Work Orders', path: '/work-orders', icon: <ClipboardList className="h-4 w-4" />, permission: 'work_orders.read' },
      { label: 'PM Calendar', path: '/preventive-maintenance', icon: <CalendarCheck className="h-4 w-4" />, permission: 'preventive_maintenance.read' },
      { label: 'PM List', path: '/preventive-maintenance/list', icon: <ClipboardList className="h-4 w-4" />, permission: 'preventive_maintenance.update' },
      { label: 'Log Book', path: '/log-books', icon: <BookOpen className="h-4 w-4" />, permission: 'log_books.read' },
    ],
  },
  {
    label: 'Assets',
    icon: <Box className="h-5 w-5" />,
    children: [
      { label: 'Assets', path: '/assets', icon: <Package className="h-4 w-4" />, permission: 'assets.read' },
    ],
  },
  {
    label: 'Inventory',
    icon: <Archive className="h-5 w-5" />,
    children: [
      { label: 'Spare Parts', path: '/inventory/spare-parts', icon: <Package className="h-4 w-4" />, permission: 'inventory.read' },
      { label: 'Warehouses', path: '/inventory/warehouses', icon: <Warehouse className="h-4 w-4" />, permission: 'inventory.read' },
      { label: 'Transactions', path: '/inventory/transactions', icon: <ArrowLeftRight className="h-4 w-4" />, permission: 'inventory.read' },
      { label: 'Low Stock', path: '/inventory/low-stock', icon: <AlertTriangle className="h-4 w-4" />, permission: 'inventory.read' },
      { label: 'Purchase Requests', path: '/inventory/purchase-requisitions', icon: <FileText className="h-4 w-4" />, permission: 'inventory.read' },
    ],
  },
  {
    label: 'Reports',
    icon: <BarChart3 className="h-5 w-5" />,
    children: [
      { label: 'Work Order Report', path: '/reports/work-orders', icon: <FileBarChart className="h-4 w-4" />, permission: 'reports.read' },
      { label: 'Maintenance Cost', path: '/reports/maintenance-cost', icon: <DollarSign className="h-4 w-4" />, permission: 'reports.read' },
      { label: 'Spare Part Usage', path: '/reports/spare-part-usage', icon: <PackageSearch className="h-4 w-4" />, permission: 'reports.read' },
      { label: 'Downtime', path: '/reports/downtime', icon: <Clock className="h-4 w-4" />, permission: 'reports.read' },
      { label: 'MTBF', path: '/reports/mtbf', icon: <Activity className="h-4 w-4" />, permission: 'reports.read' },
    ],
  },
  {
    label: 'Administration',
    icon: <Shield className="h-5 w-5" />,
    children: [
      { label: 'Users', path: '/admin/users', icon: <Users className="h-4 w-4" />, permission: 'users.read' },
      { label: 'Roles', path: '/admin/roles', icon: <Shield className="h-4 w-4" />, permission: 'roles.read' },
      { label: 'Audit Logs', path: '/admin/audit-logs', icon: <ScrollText className="h-4 w-4" />, permission: 'audit_logs.read' },
      { label: 'Settings', path: '/admin/settings', icon: <Settings className="h-4 w-4" />, permission: 'settings.read' },
    ],
  },
  {
    label: 'Integration',
    icon: <LinkIcon className="h-5 w-5" />,
    children: [
      { label: 'Provider Config', path: '/integrations/config', icon: <Plug className="h-4 w-4" />, permission: 'integrations.read' },
      { label: 'Integration Logs', path: '/integrations/logs', icon: <ScrollText className="h-4 w-4" />, permission: 'integrations.read' },
      { label: 'Failed Jobs', path: '/integrations/failed-jobs', icon: <AlertTriangle className="h-4 w-4" />, permission: 'integrations.read' },
    ],
  },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { hasPermission } = useAuth();
  const { settings } = useSettings();

  const toggleExpand = (label: string) => {
    setExpandedItems(prev =>
      prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
    );
  };

  const isActive = (path: string) => location.pathname === path;

  const filteredItems = sidebarItems
    .map((item) => {
      if (item.permission && !hasPermission(item.permission)) return null;
      if (item.children) {
        const visibleChildren = item.children.filter((c) => !c.permission || hasPermission(c.permission));
        if (visibleChildren.length === 0) return null;
        return { ...item, children: visibleChildren };
      }
      return item;
    })
    .filter(Boolean) as SidebarItem[];

  const handleItemEnter = useCallback((e: React.MouseEvent, label: string, hasChildren?: boolean) => {
    if (!isCollapsed || !hasChildren) return;
    if (hideTimeout.current) {
      clearTimeout(hideTimeout.current);
      hideTimeout.current = null;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setFlyoutTop(rect.top);
    setHoveredItem(label);
  }, [isCollapsed]);

  const handleItemLeave = useCallback(() => {
    if (!isCollapsed) return;
    hideTimeout.current = setTimeout(() => {
      setHoveredItem(null);
    }, 150);
  }, [isCollapsed]);

  const handleFlyoutEnter = useCallback(() => {
    if (hideTimeout.current) {
      clearTimeout(hideTimeout.current);
      hideTimeout.current = null;
    }
  }, []);

  const handleFlyoutLeave = useCallback(() => {
    hideTimeout.current = setTimeout(() => {
      setHoveredItem(null);
    }, 100);
  }, []);

  const hoveredMenuItem = filteredItems.find(i => i.label === hoveredItem && i.children);

  return (
    <>
      <div
        className={clsx(
          'fixed left-0 top-0 h-full bg-slate-900 text-white transition-all duration-300 z-40 flex flex-col',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700">
          <Link to="/dashboard" className="flex items-center gap-2">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-6 w-6 object-contain rounded" />
            ) : (
              <img src="/logo.svg?v=5" alt="CMMS Logo" className="h-6 w-6" />
            )}
            {!isCollapsed && <span className="font-bold text-lg">{settings.companyName || 'INDRA'}</span>}
          </Link>
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
          >
            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-thin">
          {filteredItems.map((item) => (
            <div
              key={item.label}
              className="mb-1"
              onMouseEnter={(e) => handleItemEnter(e, item.label, !!item.children)}
              onMouseLeave={handleItemLeave}
            >
              {item.path ? (
                <Link
                  to={item.path}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors duration-150',
                    isActive(item.path)
                      ? 'bg-slate-700 text-white font-medium'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  {item.icon}
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              ) : (
                <>
                <button
                  onClick={() => !isCollapsed && toggleExpand(item.label)}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors duration-150 w-full text-left',
                    (expandedItems.includes(item.label) || (isCollapsed && hoveredItem === item.label))
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  {item.icon}
                  {!isCollapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {expandedItems.includes(item.label) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </>
                  )}
                </button>
                {!isCollapsed && expandedItems.includes(item.label) && item.children && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.children.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        className={clsx(
                          'flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors duration-150',
                          isActive(child.path)
                            ? 'bg-blue-600 text-white font-medium'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        )}
                      >
                        {child.icon}
                        <span>{child.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
                </>
              )}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="text-xs text-slate-500 text-center">
            {!isCollapsed && <span>INDRA v1.0</span>}
          </div>
        </div>
      </div>

      {/* Flyout submenu (collapsed mode) */}
      {isCollapsed && hoveredMenuItem && (
        <div
          className="fixed z-50 w-56 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-2"
          style={{ left: '4rem', top: flyoutTop }}
          onMouseEnter={handleFlyoutEnter}
          onMouseLeave={handleFlyoutLeave}
        >
          <p className="px-4 py-1 text-xs font-semibold text-slate-400 uppercase">{hoveredMenuItem.label}</p>
          {hoveredMenuItem.children!.map((child) => (
            <Link
              key={child.path}
              to={child.path}
              className={clsx(
                'flex items-center gap-3 px-4 py-2 text-sm transition-colors duration-150',
                isActive(child.path)
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              )}
            >
              {child.icon}
              <span>{child.label}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
