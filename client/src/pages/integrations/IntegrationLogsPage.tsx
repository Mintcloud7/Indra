import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { IntegrationLog, PaginatedResponse } from '../../api/types';
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

export default function IntegrationLogsPage() {
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get<PaginatedResponse<IntegrationLog>>(`/integrations/logs?page=${page}&limit=20`)
      .then((res) => {
        setLogs(res.data);
        setTotalPages(res.totalPages);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page]);

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Integration Logs</h1>

      {loading ? (
        <Loading text="Loading logs..." />
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Provider</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Error</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm text-slate-700">{formatDate(log.createdAt)}</td>
                      <td className="px-6 py-4"><Badge variant="info">{log.type}</Badge></td>
                      <td className="px-6 py-4"><Badge variant="info">{log.provider || 'zahir'}</Badge></td>
                      <td className="px-6 py-4">
                        <Badge variant={log.status === 'SUCCESS' ? 'success' : 'error'}>{log.status}</Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-red-600 max-w-xs truncate">{log.error || '-'}</td>
                    </tr>
                  ))}
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
