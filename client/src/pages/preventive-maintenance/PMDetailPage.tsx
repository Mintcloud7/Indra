import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, Wrench } from 'lucide-react';
import { api } from '../../api/client';
import { PreventiveMaintenance, WorkOrder } from '../../api/types';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card, { CardHeader, CardBody, CardTitle } from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function PMDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pm, setPm] = useState<PreventiveMaintenance | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPM();
  }, [id]);

  const fetchPM = async () => {
    setLoading(true);
    try {
      const data = await api.get<PreventiveMaintenance>(`/preventive-maintenance/${id}`);
      setPm(data);
      const woRes = await api.get<{ data: WorkOrder[] }>(`/preventive-maintenance/${id}/work-orders`);
      setWorkOrders(woRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PM');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading text="Loading preventive maintenance..." />;
  if (error) return <ErrorState message={error} onRetry={fetchPM} />;
  if (!pm) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/preventive-maintenance/list')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{pm.title}</h1>
            <Badge variant={pm.status}>{pm.status}</Badge>
          </div>
          <p className="text-slate-600 mt-1">
            Asset: {(pm as any).assetCode ? (
              <Link to={`/assets/${pm.assetId}`} className="text-blue-600 hover:underline">
                {(pm as any).assetCode} - {(pm as any).assetName}
              </Link>
            ) : pm.asset ? (
              <Link to={`/assets/${pm.asset.id}`} className="text-blue-600 hover:underline">
                {pm.asset.assetCode} - {pm.asset.assetName}
              </Link>
            ) : '-'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Schedule Details</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-slate-500">Frequency</dt>
                  <dd className="text-sm font-medium"><Badge variant={pm.frequency}>{pm.frequency}</Badge></dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Frequency Value</dt>
                  <dd className="text-sm font-medium text-slate-900">{pm.frequencyValue}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Next Due Date</dt>
                  <dd className="text-sm font-medium text-slate-900">{formatDate(pm.nextDueDate)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Last Completed</dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {pm.lastCompletedDate ? formatDate(pm.lastCompletedDate) : 'Never'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Assigned To</dt>
                  <dd className="text-sm font-medium text-slate-900">{(pm as any).assignedToName || pm.assignedUser?.name || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Created At</dt>
                  <dd className="text-sm font-medium text-slate-900">{formatDate(pm.createdAt)}</dd>
                </div>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Description</dt>
                <dd className="text-sm text-slate-700">{pm.description || '-'}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generated Work Orders</CardTitle>
          </CardHeader>
          <CardBody>
            {workOrders.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No work orders generated yet</p>
            ) : (
              <div className="space-y-2">
                {workOrders.slice(0, 5).map((wo) => (
                  <Link
                    key={wo.id}
                    to={`/work-orders/${wo.id}`}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{wo.woNumber}</p>
                      <p className="text-xs text-slate-500">{wo.title}</p>
                    </div>
                    <Badge variant={wo.status}>{wo.status.replace('_', ' ')}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
