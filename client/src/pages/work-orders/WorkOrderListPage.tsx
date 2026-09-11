import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { WorkOrder, PaginatedResponse } from '../../api/types';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import Select from '../../components/ui/Select';
import Pagination from '../../components/ui/Pagination';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useNotification } from '../../context/NotificationContext';

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
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function WorkOrderListPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { addToast } = useNotification();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [page, status, priority]);

  useEffect(() => {
    setPage(1);
  }, [status, priority]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (status) params.append('status', status);
      if (priority) params.append('priority', priority);
      if (search) params.append('search', search);

      const response = await api.get<PaginatedResponse<WorkOrder>>(`/work-orders?${params.toString()}`);
      setWorkOrders(response.data);
      setTotalPages(response.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load work orders');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/work-orders/${deleteId}`);
      addToast('Work order deleted', 'success');
      setDeleteId(null);
      fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'woNumber',
      header: 'WO#',
      sortable: true,
      render: (wo: WorkOrder) => (
        <span className="font-medium text-blue-600">{wo.woNumber}</span>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      render: (wo: WorkOrder) => <span className="truncate max-w-[200px] block">{wo.title}</span>,
    },
    {
      key: 'asset',
      header: 'Asset',
      render: (wo: any) => wo.assetName || wo.asset?.assetName || '-',
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      render: (wo: WorkOrder) => <Badge variant={wo.priority}>{wo.priority}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (wo: WorkOrder) => <Badge variant={wo.status}>{wo.status.replace('_', ' ')}</Badge>,
    },
    {
      key: 'assignedTo',
      header: 'Assigned To',
      render: (wo: any) => wo.assignedToName || wo.assignedUser?.name || '-',
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      sortable: true,
      render: (wo: WorkOrder) => formatDate(wo.dueDate),
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      render: (wo: WorkOrder) => formatDate(wo.createdAt),
    },
    ...(hasPermission('work_orders.update') || hasPermission('work_orders.delete') ? [{
      key: 'actions',
      header: '',
      render: (wo: WorkOrder) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {hasPermission('work_orders.update') && (
            <button
              onClick={() => navigate(`/work-orders/${wo.id}/edit`)}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {hasPermission('work_orders.delete') && (
            <button
              onClick={() => setDeleteId(String(wo.id))}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    }] : []),
  ];

  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Work Orders</h1>
        {hasPermission('work_orders.create') && (
          <Button onClick={() => navigate('/work-orders/create')}>
            <Plus className="h-4 w-4" />
            Create Work Order
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search work orders..."
          className="sm:w-64"
        />
        <Select
          options={statusOptions}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
        <Select
          options={priorityOptions}
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        />
        <Button variant="secondary" onClick={handleSearch}>
          Search
        </Button>
      </div>

      {loading ? (
        <Loading text="Loading work orders..." />
      ) : (
        <>
          <Table
            columns={columns}
            data={workOrders}
            keyExtractor={(wo) => wo.id}
            onRowClick={(wo) => navigate(`/work-orders/${wo.id}`)}
            emptyMessage="No work orders found"
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Hapus Work Order?"
        message="Work order akan dihapus secara permanen."
        confirmText="Hapus"
        loading={deleting}
      />
    </div>
  );
}
