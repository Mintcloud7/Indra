import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { Warehouse } from '../../api/types';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';

export default function WarehouseListPage() {
  const { hasPermission } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [form, setForm] = useState({ name: '', location: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchWarehouses = () => {
    setLoading(true);
    api.get<Warehouse[]>('/warehouses')
      .then(setWarehouses)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchWarehouses(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', location: '', description: '' });
    setShowModal(true);
  };

  const openEdit = (w: Warehouse) => {
    setEditing(w);
    setForm({ name: w.name, location: w.location || '', description: w.description || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/warehouses/${editing.id}`, form);
      } else {
        await api.post('/warehouses', form);
      }
      setShowModal(false);
      fetchWarehouses();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this warehouse?')) return;
    setDeleting(id);
    try {
      await api.delete(`/warehouses/${id}`);
      fetchWarehouses();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeleting(null);
    }
  };

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Warehouses</h1>
        {hasPermission('inventory.create') && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Warehouse
          </Button>
        )}
      </div>

      {loading ? (
        <Loading text="Loading warehouses..." />
      ) : (
        <Table
          columns={[
            { key: 'name', header: 'Name', render: (w: Warehouse) => <span className="font-medium text-blue-600">{w.name}</span> },
            { key: 'location', header: 'Location' },
            { key: 'description', header: 'Description' },
            {
              key: 'actions', header: '', render: (w: Warehouse) => (
                <div className="flex gap-1">
                  {hasPermission('inventory.update') && (
                    <button onClick={() => openEdit(w)} className="p-1 text-slate-400 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                  )}
                  {hasPermission('inventory.delete') && (
                    <button onClick={() => handleDelete(w.id)} disabled={deleting === w.id} className="p-1 text-slate-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )
            },
          ]}
          data={warehouses}
          keyExtractor={(w) => w.id}
          emptyMessage="No warehouses found"
        />
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Warehouse' : 'Add Warehouse'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Warehouse name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Location"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Description"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
