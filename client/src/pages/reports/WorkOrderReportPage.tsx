import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { WorkOrder, PaginatedResponse } from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';
import { Download, FileText, Eye } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'OPEN', label: 'Open' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'CLOSED', label: 'Closed' },
];

const priorityOptions = [
  { value: '', label: 'All Priority' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

function formatDate(dateString: string) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function WorkOrderReportPage() {
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportingSingle, setExportingSingle] = useState<string | null>(null);

  const { token } = useAuth();
  const { addToast } = useNotification();

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '10' });
    if (status) params.append('status', status);
    if (priority) params.append('priority', priority);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    api.get<PaginatedResponse<WorkOrder>>(`/work-orders?${params.toString()}`)
      .then((res) => {
        setWorkOrders(res.data);
        setTotalPages(res.totalPages);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, status, priority, startDate, endDate]);

  const handleExportDocx = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (priority) params.append('priority', priority);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const url = `${API_URL}/reports/work-orders/export-docx${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Gagal mengunduh file');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      let filename = 'Laporan_Work_Order.docx';
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      a.remove();

      addToast('Laporan Word berhasil diunduh', 'success');
    } catch (err: any) {
      addToast(err.message || 'Gagal mengunduh laporan', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportSingleDocx = async (woId: string) => {
    setExportingSingle(woId);
    try {
      const url = `${API_URL}/reports/work-orders/${woId}/export-docx`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Gagal mengunduh file');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      let filename = 'Work_Order.docx';
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      a.remove();

      addToast('Work Order Word berhasil diunduh', 'success');
    } catch (err: any) {
      addToast(err.message || 'Gagal mengunduh Work Order', 'error');
    } finally {
      setExportingSingle(null);
    }
  };

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Work Order Report</h1>
        <Button
          onClick={handleExportDocx}
          disabled={exporting}
          loading={exporting}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Download className="h-4 w-4" />
          Export Word (.docx)
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Select
            options={statusOptions}
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          />
          <Select
            options={priorityOptions}
            value={priority}
            onChange={(e) => { setPriority(e.target.value); setPage(1); }}
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="secondary"
              onClick={() => { setStatus(''); setPriority(''); setStartDate(''); setEndDate(''); setPage(1); }}
            >
              Reset Filter
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <Loading text="Loading report..." />
      ) : (
        <>
          <Table
            columns={[
              { key: 'woNumber', header: 'WO#', render: (wo: WorkOrder) => (
                <span className="font-medium text-blue-600">
                  {wo.woNumber}
                </span>
              )},
              { key: 'title', header: 'Title' },
              { key: 'asset', header: 'Asset', render: (wo: any) => wo.assetName || wo.asset?.assetName || '-' },
              { key: 'priority', header: 'Priority', render: (wo: WorkOrder) => <Badge variant={wo.priority}>{wo.priority}</Badge> },
              { key: 'status', header: 'Status', render: (wo: WorkOrder) => <Badge variant={wo.status}>{wo.status.replace('_', ' ')}</Badge> },
              { key: 'assignedTo', header: 'Assigned', render: (wo: any) => wo.assignedToName || wo.assignedUser?.name || '-' },
              { key: 'dueDate', header: 'Due Date', render: (wo: WorkOrder) => formatDate(wo.dueDate) },
              { key: 'createdAt', header: 'Created', render: (wo: WorkOrder) => formatDate(wo.createdAt) },
              {
                key: 'export',
                header: 'Aksi',
                render: (wo: WorkOrder) => (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/reports/work-orders/${wo.id}`); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Lihat Laporan"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExportSingleDocx(String(wo.id)); }}
                      disabled={exportingSingle === String(wo.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                      title="Export Word"
                    >
                      {exportingSingle === String(wo.id) ? (
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                ),
              },
            ]}
            data={workOrders}
            keyExtractor={(wo) => wo.id}
            emptyMessage="No work orders found"
            onRowClick={(wo) => navigate(`/reports/work-orders/${wo.id}`)}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
