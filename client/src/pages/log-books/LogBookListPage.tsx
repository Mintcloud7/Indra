import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Trash2, BookOpen, Pencil, Save } from 'lucide-react';
import { api } from '../../api/client';
import { LogBook, SparePart, PaginatedResponse } from '../../api/types';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import Pagination from '../../components/ui/Pagination';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { useAuth } from '../../context/AuthContext';

const activityTypes: Record<string, string> = {
  CORRECTIVE: 'Corrective',
  PREVENTIVE: 'Preventive',
  INSPECTION: 'Inspection',
  EMERGENCY: 'Emergency',
};

const activityOptions = [
  { value: 'CORRECTIVE', label: 'Corrective Maintenance' },
  { value: 'PREVENTIVE', label: 'Preventive Maintenance' },
  { value: 'INSPECTION', label: 'Inspection' },
  { value: 'EMERGENCY', label: 'Emergency Repair' },
];

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface SparePartEntry {
  sparePartId: string;
  itemName: string;
  itemCode: string;
  unit: string;
  currentStock: number;
  quantity: number;
  unitCost: number;
  notes: string;
}

interface WorkItemEntry {
  description: string;
  activityType: string;
  location: string;
  workOrderNo: string;
  durationMinutes: number;
  notes: string;
  spareParts: SparePartEntry[];
  partSearch: string;
}

function createEmptyItem(): WorkItemEntry {
  return { description: '', activityType: 'CORRECTIVE', location: '', workOrderNo: '', durationMinutes: 0, notes: '', spareParts: [], partSearch: '' };
}

export default function LogBookListPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [logs, setLogs] = useState<LogBook[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [sparePartsList, setSparePartsList] = useState<SparePart[]>([]);
  const [workDate, setWorkDate] = useState(new Date().toISOString().split('T')[0]);
  const [parentLocation, setParentLocation] = useState('');
  const [items, setItems] = useState<WorkItemEntry[]>([createEmptyItem()]);

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '15' });
    if (search) params.append('search', search);
    api.get<PaginatedResponse<LogBook>>(`/log-books?${params.toString()}`)
      .then((res) => { setLogs(res.data); setTotalPages(res.totalPages); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [page]);

  useEffect(() => {
    if (showModal) {
      api.get<PaginatedResponse<SparePart>>('/spare-parts?limit=200')
        .then((res) => setSparePartsList(res.data))
        .catch(() => {});
    }
  }, [showModal]);

  const openCreate = () => {
    setEditingId(null);
    setWorkDate(new Date().toISOString().split('T')[0]);
    setParentLocation('');
    setItems([createEmptyItem()]);
    setShowModal(true);
  };

  const openEdit = async (log: LogBook) => {
    setEditingId(log.id);
    setLoadingEdit(true);
    setShowModal(true);
    try {
      const detail = await api.get<LogBook>(`/log-books/${log.id}`);
      setWorkDate(detail.workDate?.split('T')[0] || new Date().toISOString().split('T')[0]);
      setParentLocation(detail.location || '');
      if (detail.items && detail.items.length > 0) {
        setItems(detail.items.map((item: any) => ({
          description: item.description || '',
          activityType: item.activityType || 'CORRECTIVE',
          location: item.location || '',
          workOrderNo: item.workOrderNo || '',
          durationMinutes: item.durationMinutes || 0,
          notes: item.notes || '',
          spareParts: (detail.spareParts || []).map((sp: any) => ({
            sparePartId: sp.sparePartId || sp.id,
            itemName: sp.itemName,
            itemCode: sp.itemCode,
            unit: sp.unit || 'PCS',
            currentStock: sp.currentStock || 0,
            quantity: sp.quantity || 1,
            unitCost: sp.unitCost || 0,
            notes: sp.notes || '',
          })),
          partSearch: '',
        })));
      }
    } catch (err: any) {
      alert('Failed to load: ' + err.message);
      setShowModal(false);
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this log entry? Stock will be restored.')) return;
    try { await api.delete(`/log-books/${id}`); fetchData(); } catch (err: any) { alert(err.message); }
  };

  const getFilteredParts = (search: string, excludeIds: string[]) => {
    return sparePartsList.filter(
      (sp) => (sp.itemName?.toLowerCase().includes(search.toLowerCase()) || sp.itemCode?.toLowerCase().includes(search.toLowerCase())) && !excludeIds.includes(sp.id)
    );
  };

  const addItem = () => setItems([...items, createEmptyItem()]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof WorkItemEntry, value: any) => { const u = [...items]; (u[i] as any)[field] = value; setItems(u); };

  const addPartToItem = (ii: number, sp: SparePart) => {
    const u = [...items];
    u[ii].spareParts.push({ sparePartId: sp.id, itemName: sp.itemName, itemCode: sp.itemCode, unit: sp.unit || 'PCS', currentStock: sp.currentStock || 0, quantity: 1, unitCost: sp.unitCost || 0, notes: '' });
    u[ii].partSearch = '';
    setItems(u);
  };

  const removePartFromItem = (ii: number, pi: number) => { const u = [...items]; u[ii].spareParts.splice(pi, 1); setItems(u); };
  const updatePartInItem = (ii: number, pi: number, field: string, value: any) => { const u = [...items]; (u[ii].spareParts[pi] as any)[field] = value; setItems(u); };

  const handleSubmit = async () => {
    if (!workDate) { alert('Work date is required'); return; }
    if (items.length === 0) { alert('At least one work item is required'); return; }
    for (let i = 0; i < items.length; i++) {
      if (!items[i].description.trim()) { alert(`Work item ${i + 1}: Description is required`); return; }
    }
    setSaving(true);
    try {
      const payload = {
        workDate, location: parentLocation, description: items[0]?.description || '',
        items: items.map((item) => ({
          description: item.description, activityType: item.activityType, location: item.location || parentLocation,
          workOrderNo: item.workOrderNo, durationMinutes: item.durationMinutes, notes: item.notes,
          spareParts: item.spareParts.map((p) => ({ sparePartId: p.sparePartId, quantity: p.quantity, unitCost: p.unitCost, notes: p.notes })),
        })),
      };
      if (editingId) { await api.put(`/log-books/${editingId}`, payload); }
      else { await api.post('/log-books', payload); }
      setShowModal(false);
      fetchData();
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">Log Book</h1>
        </div>
        {hasPermission('log_books.create') && (
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> New Entry</Button>
        )}
      </div>

      <div className="flex gap-4">
        <SearchInput value={search} onChange={setSearch} onKeyPress={(e) => e.key === 'Enter' && fetchData()} placeholder="Search log entries..." className="sm:w-64" />
      </div>

      {loading ? (
        <Loading text="Loading log entries..." />
      ) : (
        <>
          <Table
            columns={[
              { key: 'workDate', header: 'Date', render: (l: LogBook) => <span className="font-medium">{formatDate(l.workDate)}</span> },
              { key: 'userName', header: 'Technician' },
              { key: 'location', header: 'Location' },
              { key: 'activityType', header: 'Type', render: (l: LogBook) => <Badge variant="info">{activityTypes[l.items?.[0]?.activityType] || l.items?.[0]?.activityType || '-'}</Badge> },
              { key: 'description', header: 'Description', render: (l: LogBook) => <span className="line-clamp-1 max-w-xs">{l.description || l.items?.[0]?.description || ''}</span> },
              { key: 'items', header: 'Items', render: (l: LogBook) => (
                <span className="text-sm text-slate-600">
                  {l.items?.length || 0} item{(l.items?.length || 0) !== 1 ? 's' : ''}
                  {l.spareParts && l.spareParts.length > 0 && <span className="text-slate-400 ml-1">/ {l.spareParts.length} part{l.spareParts.length !== 1 ? 's' : ''}</span>}
                </span>
              )},
              { key: 'actions', header: '', render: (l: LogBook) => (
                <div className="flex gap-1">
                  {hasPermission('log_books.update') && <button onClick={(e) => { e.stopPropagation(); openEdit(l); }} className="p-1 text-slate-400 hover:text-yellow-600"><Pencil className="h-4 w-4" /></button>}
                  {hasPermission('log_books.delete') && <button onClick={(e) => { e.stopPropagation(); handleDelete(l.id); }} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                </div>
              )},
            ]}
            data={logs}
            keyExtractor={(l) => l.id}
            emptyMessage="No log entries found"
            onRowClick={(l) => navigate(`/log-books/${l.id}`)}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Log Book Entry' : 'New Log Book Entry'} size="xl">
        {loadingEdit ? (
          <Loading text="Loading data..." />
        ) : (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Work Date *" type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
              <Input label="Location (default)" value={parentLocation} onChange={(e) => setParentLocation(e.target.value)} placeholder="e.g. Building A" />
            </div>

            {items.map((item, ii) => {
              const excludeIds = item.spareParts.map((p) => p.sparePartId);
              const filteredParts = item.partSearch ? getFilteredParts(item.partSearch, excludeIds) : [];
              return (
                <div key={ii} className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">Work Item {items.length > 1 ? `#${ii + 1}` : ''}</h3>
                    {items.length > 1 && <button onClick={() => removeItem(ii)} className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
                      <textarea value={item.description} onChange={(e) => updateItem(ii, 'description', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Describe the work..." />
                    </div>
                    <Select label="Activity Type" options={activityOptions} value={item.activityType} onChange={(e) => updateItem(ii, 'activityType', e.target.value)} />
                    <Input label="Location" value={item.location} onChange={(e) => updateItem(ii, 'location', e.target.value)} placeholder="Override location" />
                    <Input label="Work Order No." value={item.workOrderNo} onChange={(e) => updateItem(ii, 'workOrderNo', e.target.value)} placeholder="WO-xxx" />
                    <Input label="Duration (min)" type="number" value={item.durationMinutes || ''} onChange={(e) => updateItem(ii, 'durationMinutes', Number(e.target.value))} min={0} />
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                      <input type="text" value={item.notes} onChange={(e) => updateItem(ii, 'notes', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Notes..." />
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <h4 className="text-xs font-medium text-slate-600">Spare Parts</h4>
                    {item.spareParts.map((part, pi) => (
                      <div key={pi} className="flex items-center gap-2 bg-slate-50 rounded p-2 text-sm">
                        <div className="flex-1 min-w-0"><div className="font-medium truncate">{part.itemName}</div><div className="text-xs text-slate-500">{part.itemCode}</div></div>
                        <input type="number" value={part.quantity} onChange={(e) => updatePartInItem(ii, pi, 'quantity', Number(e.target.value))} min={1} className="w-16 border rounded px-1 py-0.5 text-sm text-center" />
                        <input type="number" value={part.unitCost} onChange={(e) => updatePartInItem(ii, pi, 'unitCost', Number(e.target.value))} min={0} className="w-20 border rounded px-1 py-0.5 text-sm text-center" />
                        <input type="text" value={part.notes} onChange={(e) => updatePartInItem(ii, pi, 'notes', e.target.value)} className="w-24 border rounded px-1 py-0.5 text-sm" placeholder="Notes" />
                        <button onClick={() => removePartFromItem(ii, pi)} className="text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                    <div>
                      <input type="text" value={item.partSearch} onChange={(e) => updateItem(ii, 'partSearch', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm" placeholder="Search spare parts..." />
                      {item.partSearch && filteredParts.length > 0 && (
                        <div className="mt-1 border rounded-lg max-h-36 overflow-y-auto bg-white shadow-sm">
                          {filteredParts.slice(0, 8).map((sp) => (
                            <button key={sp.id} onClick={() => addPartToItem(ii, sp)} className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-sm flex justify-between">
                              <span>{sp.itemCode} - {sp.itemName}</span><span className="text-slate-500">Stock: {sp.currentStock}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <button onClick={addItem} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"><Plus className="h-4 w-4" /> Add Work Item</button>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={saving}><Save className="h-4 w-4" /> {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
