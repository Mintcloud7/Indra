import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  Play,
  Pause,
  CheckCircle,
  CalendarCheck,
  AlertTriangle,
  DollarSign,
  Clock,
  Activity,
} from 'lucide-react';
import { api } from '../../api/client';
import { DashboardData } from '../../api/types';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';
import Badge from '../../components/ui/Badge';
import PieChart from '../../components/charts/PieChart';
import BarChart from '../../components/charts/BarChart';
import LineChart from '../../components/charts/LineChart';

function formatCurrency(amount: number) {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<DashboardData>('/dashboard')
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading text="Loading dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={() => { setLoading(true); setError(''); api.get<DashboardData>('/dashboard').then(setData).catch((err) => setError(err.message)).finally(() => setLoading(false)); }} />;
  if (!data) return null;

  const kpiCards = [
    { label: 'Open WO', value: data.kpi.openWO, icon: <ClipboardList className="h-6 w-6" />, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'In Progress', value: data.kpi.inProgressWO, icon: <Play className="h-6 w-6" />, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'On Hold', value: data.kpi.onHoldWO, icon: <Pause className="h-6 w-6" />, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Closed', value: data.kpi.closedWO, icon: <CheckCircle className="h-6 w-6" />, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'PM Due', value: data.kpi.pmDue, icon: <CalendarCheck className="h-6 w-6" />, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'PM Overdue', value: data.kpi.pmOverdue, icon: <AlertTriangle className="h-6 w-6" />, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Low Stock', value: data.kpi.lowStock, icon: <AlertTriangle className="h-6 w-6" />, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Maintenance Cost', value: formatCurrency(data.kpi.maintenanceCost), icon: <DollarSign className="h-6 w-6" />, color: 'text-slate-600', bg: 'bg-slate-50' },
    { label: 'Downtime', value: `${data.kpi.downtime} hrs`, icon: <Clock className="h-6 w-6" />, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'MTBF', value: `${data.kpi.mtbf} hrs`, icon: <Activity className="h-6 w-6" />, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpiCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <div className={card.color}>{card.icon}</div>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{card.value}</p>
                <p className="text-xs text-slate-500">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PieChart
          data={(data.woByStatus || []).map((s: any) => ({ name: s.status?.replace('_', ' '), value: s.count }))}
          title="Work Orders by Status"
          height={280}
        />
        <BarChart
          data={(data.woByPriority || []).map((p: any) => ({ name: p.priority, value: p.count }))}
          xKey="name"
          yKey="value"
          title="Work Orders by Priority"
          height={280}
        />
        <LineChart
          data={data.maintenanceTrend || []}
          xKey="month"
          yKey="count"
          title="Maintenance Trend"
          height={280}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <BarChart
          data={(data.sparePartUsage || []).map((s: any) => ({ name: s.itemName, value: s.totalUsed }))}
          xKey="name"
          yKey="value"
          title="Top Spare Part Usage"
          color="#8b5cf6"
          height={280}
        />
        <LineChart
          data={data.maintenanceCostTrend}
          xKey="month"
          yKey="cost"
          title="Maintenance Cost Trend"
          color="#f59e0b"
          height={280}
        />
        <LineChart
          data={(() => {
            const trend = (data as any).assetFailureTrend || [];
            const byMonth: Record<string, number> = {};
            for (const r of trend) {
              byMonth[r.month] = (byMonth[r.month] || 0) + r.failures;
            }
            return Object.entries(byMonth).map(([month, count]) => ({ month, count }));
          })()}
          xKey="month"
          yKey="count"
          title="Asset Failure Trend"
          color="#ef4444"
          height={280}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Recent Work Orders</h3>
            <Link to="/work-orders" className="text-sm text-blue-600 hover:text-blue-700">View all</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recentWorkOrders.slice(0, 5).map((wo: any, idx: number) => (
              <Link
                key={wo.id || wo.woNumber || idx}
                to={wo.id ? `/work-orders/${wo.id}` : '#'}
                className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{wo.woNumber}</p>
                  <p className="text-xs text-slate-500 truncate">{wo.title}</p>
                </div>
                <Badge variant={wo.status}>{wo.status?.replace('_', ' ')}</Badge>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Upcoming PM</h3>
            <Link to="/preventive-maintenance" className="text-sm text-blue-600 hover:text-blue-700">View all</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {data.upcomingPM.slice(0, 5).map((pm: any, idx: number) => (
              <Link
                key={pm.id || idx}
                to={pm.id ? `/preventive-maintenance/${pm.id}` : '#'}
                className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{pm.title}</p>
                  <p className="text-xs text-slate-500">Due: {formatDate(pm.nextDueDate)}</p>
                </div>
                <Badge variant={pm.frequency}>{pm.frequency}</Badge>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Low Stock Alerts</h3>
            <Link to="/inventory/low-stock" className="text-sm text-blue-600 hover:text-blue-700">View all</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {data.lowStockItems.slice(0, 5).map((item: any, idx: number) => (
              <Link
                key={item.id || item.itemCode || idx}
                to={item.id ? `/inventory/spare-parts/${item.id}` : '/inventory/spare-parts'}
                className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{item.name || item.itemName}</p>
                  <p className="text-xs text-slate-500">Stock: {item.currentStock} / Min: {item.minimumStock}</p>
                </div>
                <Badge variant="CRITICAL">Low</Badge>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
