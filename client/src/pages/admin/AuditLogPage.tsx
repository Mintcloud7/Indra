import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Filter, Search } from 'lucide-react';
import { api } from '../../api/client';
import { AuditLog, PaginatedResponse } from '../../api/types';
import Badge from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function JsonDiff({ oldVal, newVal }: { oldVal: any; newVal: any }) {
  if (!oldVal && !newVal) return <span className="text-slate-400 text-xs">Tidak ada data</span>;

  const allKeys = [...new Set([...Object.keys(oldVal || {}), ...Object.keys(newVal || {})])];

  return (
    <div className="space-y-1">
      {allKeys.map(key => {
        const oldValStr = oldVal?.[key] !== undefined ? String(oldVal[key]) : '-';
        const newValStr = newVal?.[key] !== undefined ? String(newVal[key]) : '-';
        const changed = oldValStr !== newValStr;
        return (
          <div key={key} className={`text-xs px-2 py-1 rounded ${changed ? 'bg-amber-50' : 'bg-slate-50'}`}>
            <span className="font-medium text-slate-700">{key}:</span>
            {changed ? (
              <>
                <span className="text-red-500 line-through ml-1">{oldValStr}</span>
                <span className="text-green-600 ml-1">→ {newValStr}</span>
              </>
            ) : (
              <span className="text-slate-500 ml-1">{newValStr}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (actionFilter) params.append('action', actionFilter);
      if (entityFilter) params.append('entity', entityFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await api.get<PaginatedResponse<AuditLog>>(`/audit-logs?${params.toString()}`);
      setLogs(res.data);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, entityFilter, startDate, endDate]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => { setPage(1); }, [actionFilter, entityFilter, startDate, endDate]);

  const resetFilters = () => {
    setActionFilter('');
    setEntityFilter('');
    setStartDate('');
    setEndDate('');
  };

  const uniqueEntities = [...new Set(logs.map(l => l.entity))].filter(Boolean);

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
        <p className="text-sm text-slate-500 mt-1">Jejak aktivitas perubahan data sistem</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Filter</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Aksi</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Semua Aksi</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Entity</label>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Semua Entity</option>
              {uniqueEntities.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={resetFilters}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Reset Filter
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <Loading text="Loading audit logs..." />
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-8"></th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tanggal</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Entity</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => {
                    const isExpanded = expandedRow === log.id;
                    const hasChanges = log.oldValues || log.newValues;
                    return (
                      <React.Fragment key={log.id}>
                        <tr
                          className={`hover:bg-slate-50 transition-colors ${hasChanges ? 'cursor-pointer' : ''}`}
                          onClick={() => hasChanges && setExpandedRow(isExpanded ? null : log.id)}
                        >
                          <td className="px-6 py-4">
                            {hasChanges && (
                              <button className="text-slate-400">
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">{formatDate(log.createdAt)}</td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-900">{log.user?.name || '-'}</td>
                          <td className="px-6 py-4">
                            <Badge variant={log.action === 'DELETE' ? 'error' : log.action === 'UPDATE' ? 'warning' : 'info'}>
                              {log.action}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            <span className="font-medium">{log.entity}</span>
                            <span className="text-slate-400 ml-1">#{log.entityId}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">{log.ipAddress || '-'}</td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="px-6 py-4 bg-slate-50">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">Sebelumnya</p>
                                  <JsonDiff oldVal={log.oldValues} newVal={null} />
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">Sesudahnya</p>
                                  <JsonDiff oldVal={null} newVal={log.newValues} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">Tidak ada log ditemukan</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
