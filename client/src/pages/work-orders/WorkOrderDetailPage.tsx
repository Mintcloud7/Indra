import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Pause,
  CheckCircle,
  Clock,
  Paperclip,
  Package,
  History,
  UserPlus,
  Upload,
  Plus,
  Trash2,
  Check,
  Pencil,
  X,
  Image as ImageIcon,
  Download,
  Eye,
} from 'lucide-react';
import { api } from '../../api/client';
import { WorkOrder, ChecklistItem, Attachment, MaintenanceHistory, SparePart, User } from '../../api/types';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card, { CardHeader, CardBody, CardTitle } from '../../components/ui/Card';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import FileUpload from '../../components/ui/FileUpload';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const { hasPermission } = useAuth();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [activeTab, setActiveTab] = useState('details');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Assign
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [repairInstruction, setRepairInstruction] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Checklist
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [checklistLoading, setChecklistLoading] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<Attachment | null>(null);

  // History
  const [history, setHistory] = useState<MaintenanceHistory[]>([]);

  // Spare Parts
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);

  useEffect(() => {
    fetchWorkOrder();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'checklist') fetchChecklist();
    if (activeTab === 'attachments') fetchAttachments();
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'spare-parts') fetchSpareParts();
  }, [activeTab, id]);

  const fetchWorkOrder = async () => {
    setLoading(true);
    try {
      const data = await api.get<WorkOrder>(`/work-orders/${id}`);
      setWorkOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load work order');
    } finally {
      setLoading(false);
    }
  };

  const fetchChecklist = async () => {
    setChecklistLoading(true);
    try {
      const data = await api.get<ChecklistItem[]>(`/work-orders/${id}/checklist`);
      setChecklist(data);
    } catch (err) {
      console.error(err);
    } finally {
      setChecklistLoading(false);
    }
  };

  const fetchAttachments = async () => {
    try {
      const data = await api.get<Attachment[]>(`/work-orders/${id}/attachments`);
      setAttachments(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await api.get<MaintenanceHistory[]>(`/work-orders/${id}/history`);
      setHistory(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSpareParts = async () => {
    try {
      const data = await api.get<SparePart[]>(`/work-orders/${id}/spare-parts`);
      setSpareParts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = async () => {
    setStatusLoading(true);
    try {
      let endpoint = '';
      const body: any = {};
      switch (newStatus) {
        case 'IN_PROGRESS':
          endpoint = `/work-orders/${id}/start`;
          break;
        case 'ON_HOLD':
          endpoint = `/work-orders/${id}/hold`;
          body.notes = 'Put on hold';
          break;
        case 'CLOSED':
          endpoint = `/work-orders/${id}/close`;
          body.notes = 'Work completed';
          break;
        case 'IN_PROGRESS_RESUME':
          endpoint = `/work-orders/${id}/resume`;
          break;
        default:
          throw new Error(`Unsupported status transition: ${newStatus}`);
      }
      await api.post(endpoint, body);
      addToast('Status updated successfully', 'success');
      setShowStatusDialog(false);
      fetchWorkOrder();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to update status', 'error');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedUserId) {
      addToast('Please select a user', 'error');
      return;
    }
    setAssignLoading(true);
    try {
      await api.post(`/work-orders/${id}/assign`, {
        assignedToId: selectedUserId,
        repairInstruction: repairInstruction || undefined,
      });
      addToast('Work order assigned successfully', 'success');
      setShowAssignDialog(false);
      setSelectedUserId('');
      setRepairInstruction('');
      fetchWorkOrder();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to assign work order', 'error');
    } finally {
      setAssignLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get<any>('/users?limit=1000');
      const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setUsers(items);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/work-orders/${id}`);
      addToast('Work order deleted', 'success');
      navigate('/work-orders');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddChecklistItem = async () => {
    if (!newChecklistItem.trim()) return;
    try {
      await api.post(`/work-orders/${id}/checklist`, { description: newChecklistItem });
      setNewChecklistItem('');
      fetchChecklist();
      addToast('Checklist item added', 'success');
    } catch (err) {
      addToast('Failed to add checklist item', 'error');
    }
  };

  const handleToggleChecklist = async (itemId: number, completed: boolean) => {
    try {
      await api.put(`/work-orders/${id}/checklist/${itemId}`, { isCompleted: !completed });
      fetchChecklist();
    } catch (err) {
      addToast('Failed to update checklist item', 'error');
    }
  };

  const handleDeleteChecklistItem = async (itemId: number) => {
    try {
      await api.delete(`/work-orders/${id}/checklist/${itemId}`);
      fetchChecklist();
      addToast('Checklist item deleted', 'success');
    } catch (err) {
      addToast('Failed to delete checklist item', 'error');
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      await api.uploadFile(`/work-orders/${id}/attachments`, file);
      fetchAttachments();
      addToast('File uploaded successfully', 'success');
    } catch (err) {
      addToast('Failed to upload file', 'error');
    } finally {
      setUploading(false);
    }
  };

  const getStatusActions = () => {
    if (!workOrder) return [];
    const actions: { label: string; status: string; variant: 'primary' | 'success' | 'danger' | 'warning' }[] = [];

    switch (workOrder.status) {
      case 'OPEN':
        actions.push({ label: 'Assign', status: 'ASSIGNED', variant: 'primary' });
        break;
      case 'ASSIGNED':
        actions.push({ label: 'Reassign', status: 'ASSIGNED', variant: 'warning' });
        actions.push({ label: 'Start Work', status: 'IN_PROGRESS', variant: 'success' });
        break;
      case 'IN_PROGRESS':
        actions.push({ label: 'Put On Hold', status: 'ON_HOLD', variant: 'warning' });
        actions.push({ label: 'Close', status: 'CLOSED', variant: 'success' });
        break;
      case 'ON_HOLD':
        actions.push({ label: 'Resume', status: 'IN_PROGRESS', variant: 'primary' });
        break;
    }
    return actions;
  };

  if (loading) return <Loading text="Loading work order..." />;
  if (error) return <ErrorState message={error} onRetry={fetchWorkOrder} />;
  if (!workOrder) return null;

  const tabs = [
    { id: 'details', label: 'Details', icon: <ArrowLeft className="h-4 w-4" /> },
    { id: 'checklist', label: 'Checklist', icon: <Check className="h-4 w-4" /> },
    { id: 'attachments', label: 'Attachments', icon: <Paperclip className="h-4 w-4" /> },
    { id: 'spare-parts', label: 'Spare Parts', icon: <Package className="h-4 w-4" /> },
    { id: 'history', label: 'Status History', icon: <History className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/work-orders')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{workOrder.woNumber}</h1>
            <Badge variant={workOrder.status}>{workOrder.status.replace('_', ' ')}</Badge>
            <Badge variant={workOrder.priority}>{workOrder.priority}</Badge>
          </div>
          <p className="text-slate-600 mt-1">{workOrder.title}</p>
        </div>
        <div className="flex gap-2">
          {hasPermission('work_orders.update') && (
            <Button variant="secondary" onClick={() => navigate(`/work-orders/${id}/edit`)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          )}
          {hasPermission('work_orders.delete') && (
            <Button variant="secondary" onClick={() => setShowDeleteDialog(true)} className="text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" /> Hapus
            </Button>
          )}
          {getStatusActions().map((action) => (
            <Button
              key={action.status}
              variant={action.variant}
              onClick={() => {
                if (action.status === 'ASSIGNED') {
                  fetchUsers();
                  setShowAssignDialog(true);
                } else if (action.status === 'IN_PROGRESS' && workOrder.status === 'ON_HOLD') {
                  setNewStatus('IN_PROGRESS_RESUME');
                  setShowStatusDialog(true);
                } else {
                  setNewStatus(action.status);
                  setShowStatusDialog(true);
                }
              }}
            >
              {action.status === 'IN_PROGRESS' && <Play className="h-4 w-4" />}
              {action.status === 'ON_HOLD' && <Pause className="h-4 w-4" />}
              {action.status === 'CLOSED' && <CheckCircle className="h-4 w-4" />}
              {action.status === 'ASSIGNED' && <UserPlus className="h-4 w-4" />}
              {action.label}
            </Button>
          ))}
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

      {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>General Information</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm text-slate-500">Asset</dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {(workOrder as any).assetName ? (
                      <Link to={`/assets/${workOrder.assetId}`} className="text-blue-600 hover:underline">
                        {(workOrder as any).assetCode} - {(workOrder as any).assetName}
                      </Link>
                    ) : workOrder.asset ? (
                      <Link to={`/assets/${workOrder.asset.id}`} className="text-blue-600 hover:underline">
                        {workOrder.asset.assetCode} - {workOrder.asset.assetName}
                      </Link>
                    ) : '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Assigned To</dt>
                  <dd className="text-sm font-medium text-slate-900">{(workOrder as any).assignedToName || workOrder.assignedUser?.name || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Due Date</dt>
                  <dd className="text-sm font-medium text-slate-900">{formatDate(workOrder.dueDate)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Created By</dt>
                  <dd className="text-sm font-medium text-slate-900">{(workOrder as any).reportedByName || workOrder.createdByUser?.name || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Created At</dt>
                  <dd className="text-sm font-medium text-slate-900">{formatDate(workOrder.createdAt)}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Description & Analysis</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm text-slate-500">Description</dt>
                  <dd className="text-sm text-slate-700">{workOrder.description || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Problem Description</dt>
                  <dd className="text-sm text-slate-700">{workOrder.problemDescription || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Root Cause</dt>
                  <dd className="text-sm text-slate-700">{workOrder.rootCause || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Action Taken</dt>
                  <dd className="text-sm text-slate-700">{workOrder.actionTaken || '-'}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        </div>
      )}

      {activeTab === 'checklist' && (
        <Card>
          <CardHeader>
            <CardTitle>Checklist</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="flex gap-2 mb-4">
              <Input
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                placeholder="Add checklist item..."
                onKeyPress={(e) => e.key === 'Enter' && handleAddChecklistItem()}
              />
              <Button onClick={handleAddChecklistItem}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
            {checklistLoading ? (
              <Loading size="sm" />
            ) : checklist.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No checklist items</p>
            ) : (
              <div className="space-y-2">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                  >
                    <button
                      onClick={() => handleToggleChecklist(item.id, item.isCompleted)}
                      className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                        item.isCompleted
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-slate-300 hover:border-blue-500'
                      }`}
                    >
                      {item.isCompleted && <Check className="h-3 w-3" />}
                    </button>
                    <span className={`flex-1 text-sm ${item.isCompleted ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                      {item.description}
                    </span>
                    <button
                      onClick={() => handleDeleteChecklistItem(item.id)}
                      className="p-1 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === 'attachments' && (
        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="mb-4">
              <FileUpload
                onFileSelect={handleFileUpload}
                label="Upload attachment"
                loading={uploading}
              />
            </div>
            {attachments.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No attachments</p>
            ) : (
              <div className="space-y-2">
                {attachments.map((file) => {
                  const fileUrl = `/uploads/${file.filename}`;
                  return (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                    >
                      {file.mimeType?.startsWith('image/') ? (
                        <ImageIcon className="h-5 w-5 text-blue-500" />
                      ) : (
                        <Paperclip className="h-5 w-5 text-slate-400" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{file.originalName}</p>
                        <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      {file.mimeType?.startsWith('image/') ? (
                        <Button variant="ghost" size="sm" onClick={() => { const { path, ...rest } = file; setPreviewFile({ ...rest, filePath: fileUrl }); }}>
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      ) : (
                        <a
                          href={fileUrl}
                          download
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === 'spare-parts' && (
        <Card>
          <CardHeader>
            <CardTitle>Spare Parts</CardTitle>
          </CardHeader>
          <CardBody>
            {spareParts.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No spare parts used</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {spareParts.map((part) => (
                      <tr key={part.id}>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{part.itemCode}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{part.itemName}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{part.category}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{part.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle>Status History</CardTitle>
          </CardHeader>
          <CardBody>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No status history</p>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
                <div className="space-y-4">
                  {history.map((item) => (
                    <div key={item.id} className="flex gap-4 relative">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center z-10">
                        <Clock className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={item.oldStatus}>{item.oldStatus.replace('_', ' ')}</Badge>
                          <span className="text-slate-400">→</span>
                          <Badge variant={item.newStatus}>{item.newStatus.replace('_', ' ')}</Badge>
                        </div>
                        <p className="text-xs text-slate-500">
                          {item.changedByUser?.name} • {formatDate(item.createdAt)}
                        </p>
                        {item.notes && (
                          <p className="text-sm text-slate-700 mt-1">{item.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <ConfirmDialog
        isOpen={showStatusDialog}
        onClose={() => setShowStatusDialog(false)}
        onConfirm={handleStatusChange}
        title="Change Status"
        message={`Are you sure you want to change the status to ${newStatus.replace('_', ' ')}?`}
        confirmText="Change Status"
        loading={statusLoading}
      />

      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Hapus Work Order?"
        message="Work order akan dihapus secara permanen."
        confirmText="Hapus"
        loading={deleting}
      />

      {showAssignDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Assign Work Order</h2>
              <button onClick={() => setShowAssignDialog(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <Select
                label="Assign To *"
                options={users.map((u) => ({ value: String(u.id), label: u.name }))}
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                placeholder="Select user"
              />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Repair Instruction</label>
                <textarea
                  value={repairInstruction}
                  onChange={(e) => setRepairInstruction(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={3}
                  placeholder="Optional instructions..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" onClick={() => setShowAssignDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssign} loading={assignLoading}>
                Assign
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setPreviewFile(null)}>
          <div className="relative bg-white rounded-xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <p className="text-sm font-medium text-slate-700 truncate">{previewFile.originalName || previewFile.fileName}</p>
              <button onClick={() => setPreviewFile(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              <img src={previewFile.filePath} alt={previewFile.originalName || previewFile.fileName} className="max-w-full max-h-[70vh] object-contain rounded-lg" />
            </div>
            <div className="flex justify-end px-4 py-3 border-t">
              <a href={previewFile.filePath} download className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                <Download className="h-4 w-4" />
                Download
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
