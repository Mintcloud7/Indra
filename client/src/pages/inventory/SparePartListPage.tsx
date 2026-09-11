import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { SparePart, PaginatedResponse, Warehouse } from '../../api/types';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import SearchInput from '../../components/ui/SearchInput';
import Select from '../../components/ui/Select';
import Pagination from '../../components/ui/Pagination';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';

const categoryOptions = [
  { value: '', label: 'All Categories' },
  { value: 'Electrical', label: 'Electrical' },
  { value: 'Mechanical', label: 'Mechanical' },
  { value: 'Instrumentation', label: 'Instrumentation' },
  { value: 'FILTER', label: 'Filter' },
  { value: 'BELT', label: 'Belt' },
  { value: 'BEARING', label: 'Bearing' },
  { value: 'SEAL', label: 'Seal' },
  { value: 'OTHER', label: 'Other' },
];

const categoryFormOptions = [
  { value: 'Electrical', label: 'Electrical' },
  { value: 'Mechanical', label: 'Mechanical' },
  { value: 'Instrumentation', label: 'Instrumentation' },
  { value: 'FILTER', label: 'Filter' },
  { value: 'BELT', label: 'Belt' },
  { value: 'BEARING', label: 'Bearing' },
  { value: 'SEAL', label: 'Seal' },
  { value: 'OTHER', label: 'Other' },
];

function formatCurrency(amount: number) {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

const emptyForm = {
  itemCode: '',
  itemName: '',
  category: 'Electrical',
  specification: '',
  unit: 'PCS',
  warehouseId: '',
  stockLocation: '',
  currentStock: 0,
  minimumStock: 0,
  maximumStock: 0,
  unitCost: 0,
};

export default function SparePartListPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [parts, setParts] = useState<SparePart[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SparePart | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [page, category]);

  useEffect(() => {
    setPage(1);
  }, [category]);

  useEffect(() => {
    api.get<Warehouse[]>('/warehouses')
      .then(setWarehouses)
      .catch(() => {});
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (category) params.append('category', category);
      if (search) params.append('search', search);

      const response = await api.get<PaginatedResponse<SparePart>>(`/spare-parts?${params.toString()}`);
      setParts(response.data);
      setTotalPages(response.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spare parts');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (part: SparePart) => {
    setEditing(part);
    setForm({
      itemCode: part.itemCode,
      itemName: part.itemName,
      category: part.category || 'Electrical',
      specification: part.specification || '',
      unit: part.unit || 'PCS',
      warehouseId: part.warehouseId || '',
      stockLocation: part.stockLocation || '',
      currentStock: part.currentStock,
      minimumStock: part.minimumStock,
      maximumStock: part.maximumStock,
      unitCost: part.unitCost,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.itemCode.trim() || !form.itemName.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/spare-parts/${editing.id}`, form);
      } else {
        await api.post('/spare-parts', form);
      }
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this spare part?')) return;
    try {
      await api.delete(`/spare-parts/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const columns = [
    {
      key: 'itemCode',
      header: 'Code',
      sortable: true,
      render: (part: SparePart) => (
        <span className="font-medium text-blue-600">{part.itemCode}</span>
      ),
    },
    {
      key: 'itemName',
      header: 'Name',
      sortable: true,
    },
    {
      key: 'category',
      header: 'Category',
      render: (part: SparePart) => <Badge variant="info">{part.category}</Badge>,
    },
    {
      key: 'unit',
      header: 'Unit',
    },
    {
      key: 'currentStock',
      header: 'Current Stock',
      sortable: true,
      render: (part: SparePart) => (
        <span className={part.currentStock <= part.minimumStock ? 'font-bold text-red-600' : 'text-slate-900'}>
          {part.currentStock}
        </span>
      ),
    },
    {
      key: 'minimumStock',
      header: 'Min Stock',
    },
    {
      key: 'unitCost',
      header: 'Unit Cost',
      render: (part: SparePart) => formatCurrency(part.unitCost),
    },
  ];

  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: w.name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Spare Parts</h1>
        {hasPermission('inventory.create') && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Spare Part
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search spare parts..."
          className="sm:w-64"
        />
        <Select
          options={categoryOptions}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <Button variant="secondary" onClick={handleSearch}>
          Search
        </Button>
      </div>

      {loading ? (
        <Loading text="Loading spare parts..." />
      ) : (
        <>
          <Table
            columns={[
              ...columns,
              ...(hasPermission('inventory.update') || hasPermission('inventory.delete')
                ? [{
                    key: 'actions',
                    header: '',
                    render: (part: SparePart) => (
                      <div className="flex gap-1">
                        {hasPermission('inventory.update') && (
                          <button onClick={() => openEdit(part)} className="p-1 text-slate-400 hover:text-blue-600">
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {hasPermission('inventory.delete') && (
                          <button onClick={() => handleDelete(part.id)} className="p-1 text-slate-400 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ),
                  }]
                : []),
            ]}
            data={parts}
            keyExtractor={(part) => part.id}
            onRowClick={(part) => navigate(`/inventory/spare-parts/${part.id}`)}
            emptyMessage="No spare parts found"
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Spare Part' : 'Add Spare Part'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Item Code *</label>
              <input
                type="text"
                value={form.itemCode}
                onChange={(e) => setForm({ ...form, itemCode: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. SP-007"
                disabled={!!editing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Item Name *</label>
              <input
                type="text"
                value={form.itemName}
                onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Spare part name"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {categoryFormOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="PCS"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Specification</label>
            <input
              type="text"
              value={form.specification}
              onChange={(e) => setForm({ ...form, specification: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Specification / model"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Warehouse</label>
              <select
                value={form.warehouseId}
                onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">None</option>
                {warehouseOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stock Location</label>
              <input
                type="text"
                value={form.stockLocation}
                onChange={(e) => setForm({ ...form, stockLocation: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. Rack A-03"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Current Stock</label>
              <input
                type="number"
                value={form.currentStock}
                onChange={(e) => setForm({ ...form, currentStock: Number(e.target.value) })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Min Stock</label>
              <input
                type="number"
                value={form.minimumStock}
                onChange={(e) => setForm({ ...form, minimumStock: Number(e.target.value) })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Max Stock</label>
              <input
                type="number"
                value={form.maximumStock}
                onChange={(e) => setForm({ ...form, maximumStock: Number(e.target.value) })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min={0}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Unit Cost (Rp)</label>
            <input
              type="number"
              value={form.unitCost}
              onChange={(e) => setForm({ ...form, unitCost: Number(e.target.value) })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min={0}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.itemCode.trim() || !form.itemName.trim()}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
