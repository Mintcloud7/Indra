import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardList,
  CalendarCheck,
  FileText,
  Gauge,
  Wrench,
  Package,
} from 'lucide-react';
import { api } from '../../api/client';
import { Asset, WorkOrder, PreventiveMaintenance } from '../../api/types';
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

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [preventiveMaintenance, setPreventiveMaintenance] = useState<PreventiveMaintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAsset();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'work-orders') fetchWorkOrders();
    if (activeTab === 'pm') fetchPM();
  }, [activeTab, id]);

  const fetchAsset = async () => {
    setLoading(true);
    try {
      const data = await api.get<Asset>(`/assets/${id}`);
      setAsset(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load asset');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkOrders = async () => {
    try {
      const res = await api.get<{ data: WorkOrder[] }>(`/assets/${id}/work-orders`);
      setWorkOrders(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPM = async () => {
    try {
      const res = await api.get<{ data: PreventiveMaintenance[] }>(`/assets/${id}/preventive-maintenance`);
      setPreventiveMaintenance(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <Loading text="Loading asset..." />;
  if (error) return <ErrorState message={error} onRetry={fetchAsset} />;
  if (!asset) return null;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <FileText className="h-4 w-4" /> },
    { id: 'work-orders', label: 'Work Orders', icon: <ClipboardList className="h-4 w-4" /> },
    { id: 'pm', label: 'Preventive Maintenance', icon: <CalendarCheck className="h-4 w-4" /> },
    { id: 'history', label: 'Maintenance History', icon: <Wrench className="h-4 w-4" /> },
    { id: 'meters', label: 'Meters', icon: <Gauge className="h-4 w-4" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/assets')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{asset.assetCode}</h1>
            <Badge variant={asset.status}>{asset.status}</Badge>
          </div>
          <p className="text-slate-600 mt-1">{asset.assetName}</p>
        </div>
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>General Information</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-slate-500">Code</dt>
                    <dd className="text-sm font-medium text-slate-900">{asset.assetCode}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Name</dt>
                    <dd className="text-sm font-medium text-slate-900">{asset.assetName}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Type</dt>
                    <dd className="text-sm font-medium text-slate-900">{asset.assetType}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Location</dt>
                    <dd className="text-sm font-medium text-slate-900">{asset.location || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Manufacturer</dt>
                    <dd className="text-sm font-medium text-slate-900">{asset.manufacturer || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Model</dt>
                    <dd className="text-sm font-medium text-slate-900">{asset.model || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Serial Number</dt>
                    <dd className="text-sm font-medium text-slate-900">{asset.serialNumber || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Status</dt>
                    <dd className="text-sm font-medium text-slate-900">
                      <Badge variant={asset.status || 'ACTIVE'}>{asset.status || 'ACTIVE'}</Badge>
                    </dd>
                  </div>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Details</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm text-slate-500">Description</dt>
                  <dd className="text-sm text-slate-700">{asset.description || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Purchase Date</dt>
                  <dd className="text-sm font-medium text-slate-900">{asset.purchaseDate ? formatDate(asset.purchaseDate) : '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Warranty End</dt>
                  <dd className="text-sm font-medium text-slate-900">{asset.warrantyEnd ? formatDate(asset.warrantyEnd) : '-'}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        </div>
      )}

      {activeTab === 'work-orders' && (
        <Table
          columns={[
            { key: 'woNumber', header: 'WO#', render: (wo: WorkOrder) => <span className="font-medium text-blue-600">{wo.woNumber}</span> },
            { key: 'title', header: 'Title' },
            { key: 'priority', header: 'Priority', render: (wo: WorkOrder) => <Badge variant={wo.priority}>{wo.priority}</Badge> },
            { key: 'status', header: 'Status', render: (wo: WorkOrder) => <Badge variant={wo.status}>{wo.status.replace('_', ' ')}</Badge> },
            { key: 'dueDate', header: 'Due Date', render: (wo: WorkOrder) => formatDate(wo.dueDate) },
          ]}
          data={workOrders}
          keyExtractor={(wo) => wo.id}
          onRowClick={(wo) => navigate(`/work-orders/${wo.id}`)}
          emptyMessage="No work orders for this asset"
        />
      )}

      {activeTab === 'pm' && (
        <Table
          columns={[
            { key: 'title', header: 'Title', render: (pm: PreventiveMaintenance) => <span className="font-medium text-blue-600">{pm.title}</span> },
            { key: 'frequency', header: 'Frequency', render: (pm: PreventiveMaintenance) => <Badge variant={pm.frequency}>{pm.frequency}</Badge> },
            { key: 'nextDueDate', header: 'Next Due', render: (pm: PreventiveMaintenance) => formatDate(pm.nextDueDate) },
            { key: 'status', header: 'Status', render: (pm: PreventiveMaintenance) => <Badge variant={pm.status}>{pm.status}</Badge> },
          ]}
          data={preventiveMaintenance}
          keyExtractor={(pm) => pm.id}
          onRowClick={(pm) => navigate(`/preventive-maintenance/${pm.id}`)}
          emptyMessage="No preventive maintenance for this asset"
        />
      )}

      {activeTab === 'history' && (
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500 text-center py-8">Maintenance history coming soon</p>
          </CardBody>
        </Card>
      )}

      {activeTab === 'meters' && (
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500 text-center py-8">Asset meters coming soon</p>
          </CardBody>
        </Card>
      )}

      {activeTab === 'documents' && (
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500 text-center py-8">Asset documents coming soon</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
