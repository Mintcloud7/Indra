import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { Asset, PaginatedResponse } from '../../api/types';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import SearchInput from '../../components/ui/SearchInput';
import Select from '../../components/ui/Select';
import Pagination from '../../components/ui/Pagination';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';

const typeOptions = [
  { value: '', label: 'All Types' },
  { value: 'Mesin', label: 'Mesin' },
  { value: 'Alat', label: 'Alat' },
  { value: 'MACHINE', label: 'Machine' },
  { value: 'VEHICLE', label: 'Vehicle' },
  { value: 'TOOL', label: 'Tool' },
  { value: 'FACILITY', label: 'Facility' },
  { value: 'OTHER', label: 'Other' },
];

const typeFormOptions = [
  { value: 'Mesin', label: 'Mesin' },
  { value: 'Alat', label: 'Alat' },
  { value: 'MACHINE', label: 'Machine' },
  { value: 'VEHICLE', label: 'Vehicle' },
  { value: 'TOOL', label: 'Tool' },
  { value: 'FACILITY', label: 'Facility' },
  { value: 'OTHER', label: 'Other' },
];

const statusOptions = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'RETIRED', label: 'Retired' },
];

const emptyForm = {
  assetCode: '',
  assetName: '',
  assetType: 'Mesin',
  location: '',
  serialNumber: '',
  manufacturer: '',
  model: '',
  purchaseDate: '',
  status: 'ACTIVE',
  description: '',
};

export default function AssetListPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [page, type]);

  useEffect(() => {
    setPage(1);
  }, [type]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (type) params.append('assetType', type);
      if (search) params.append('search', search);

      const response = await api.get<PaginatedResponse<Asset>>(`/assets?${params.toString()}`);
      setAssets(response.data);
      setTotalPages(response.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
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

  const openEdit = (asset: Asset) => {
    setEditing(asset);
    setForm({
      assetCode: asset.assetCode || '',
      assetName: asset.assetName || '',
      assetType: asset.assetType || 'Mesin',
      location: asset.location || '',
      serialNumber: asset.serialNumber || '',
      manufacturer: asset.manufacturer || '',
      model: asset.model || '',
      purchaseDate: asset.purchaseDate || '',
      status: asset.status || 'ACTIVE',
      description: asset.description || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.assetCode.trim() || !form.assetName.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/assets/${editing.id}`, form);
      } else {
        await api.post('/assets', form);
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
    if (!confirm('Yakin ingin menghapus aset ini?')) return;
    try {
      await api.delete(`/assets/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const columns = [
    {
      key: 'assetCode',
      header: 'Code',
      sortable: true,
      render: (asset: Asset) => (
        <span className="font-medium text-blue-600">{asset.assetCode}</span>
      ),
    },
    {
      key: 'assetName',
      header: 'Name',
      sortable: true,
      render: (asset: Asset) => asset.assetName,
    },
    {
      key: 'assetType',
      header: 'Type',
      render: (asset: Asset) => <Badge variant="info">{asset.assetType}</Badge>,
    },
    {
      key: 'location',
      header: 'Location',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (asset: Asset) => <Badge variant={asset.status}>{asset.status}</Badge>,
    },
  ];

  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Assets</h1>
        {hasPermission('assets.create') && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Asset
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search assets..."
          className="sm:w-64"
        />
        <Select
          options={typeOptions}
          value={type}
          onChange={(e) => setType(e.target.value)}
        />
        <Button variant="secondary" onClick={handleSearch}>
          Search
        </Button>
      </div>

      {loading ? (
        <Loading text="Loading assets..." />
      ) : (
        <>
          <Table
            columns={[
              ...columns,
              ...(hasPermission('assets.update') || hasPermission('assets.delete')
                ? [{
                    key: 'actions',
                    header: '',
                    render: (asset: Asset) => (
                      <div className="flex gap-1">
                        {hasPermission('assets.update') && (
                          <button onClick={(e) => { e.stopPropagation(); openEdit(asset); }} className="p-1 text-slate-400 hover:text-blue-600">
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {hasPermission('assets.delete') && (
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(asset.id); }} className="p-1 text-slate-400 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ),
                  }]
                : []),
            ]}
            data={assets}
            keyExtractor={(asset) => asset.id}
            onRowClick={(asset) => navigate(`/assets/${asset.id}`)}
            emptyMessage="No assets found"
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
        title={editing ? 'Edit Asset' : 'Add Asset'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Asset Code *</label>
              <input
                type="text"
                value={form.assetCode}
                onChange={(e) => setForm({ ...form, assetCode: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. MC-003"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Asset Name *</label>
              <input
                type="text"
                value={form.assetName}
                onChange={(e) => setForm({ ...form, assetName: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nama aset"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
              <select
                value={form.assetType}
                onChange={(e) => setForm({ ...form, assetType: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {typeFormOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Lokasi aset"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Manufacturer</label>
              <input
                type="text"
                value={form.manufacturer}
                onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Merek / Manufacturer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Model"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Serial Number</label>
              <input
                type="text"
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Serial number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Date</label>
              <input
                type="date"
                value={form.purchaseDate}
                onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              placeholder="Deskripsi aset"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.assetCode.trim() || !form.assetName.trim()}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
