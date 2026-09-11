import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { PreventiveMaintenance, PaginatedResponse, Asset } from '../../api/types';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../context/NotificationContext';

const frequencyColors: Record<string, string> = {
  DAILY: 'bg-red-100 text-red-700',
  WEEKLY: 'bg-orange-100 text-orange-700',
  MONTHLY: 'bg-blue-100 text-blue-700',
  QUARTERLY: 'bg-purple-100 text-purple-700',
  YEARLY: 'bg-green-100 text-green-700',
};

const frequencyOptions = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
];

interface ChecklistForm {
  title: string;
  description: string;
}

interface PmFormData {
  assetId: string;
  title: string;
  description: string;
  frequency: string;
}

const emptyForm: PmFormData = {
  assetId: '',
  title: '',
  description: '',
  frequency: 'MONTHLY',
};

export default function PMListPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { addToast } = useNotification();
  const [pmList, setPmList] = useState<PreventiveMaintenance[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [frequency, setFrequency] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<PreventiveMaintenance | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPm, setEditingPm] = useState<PreventiveMaintenance | null>(null);
  const [formData, setFormData] = useState<PmFormData>(emptyForm);
  const [formChecklists, setFormChecklists] = useState<ChecklistForm[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (status) params.append('status', status);
      if (frequency) params.append('frequency', frequency);
      if (search) params.append('search', search);

      const response = await api.get<PaginatedResponse<PreventiveMaintenance>>(`/preventive-maintenance?${params.toString()}`);
      setPmList(response.data);
      setTotalPages(response.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preventive maintenance');
    } finally {
      setLoading(false);
    }
  }, [page, status, frequency, search]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [status, frequency]);

  useEffect(() => {
    api.get<any>('/assets?limit=1000').then((res) => {
      const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setAssets(items);
    }).catch(() => {});
  }, []);

  const openEditModal = async (pm: PreventiveMaintenance) => {
    setEditingPm(pm);
    try {
      const detail = await api.get<any>(`/preventive-maintenance/${pm.id}`);
      setFormData({
        assetId: detail.assetId || '',
        title: detail.title || '',
        description: detail.description || '',
        frequency: detail.frequency || 'MONTHLY',
      });
      setFormChecklists(
        (detail.checklists || []).length > 0
          ? detail.checklists.map((c: any) => ({ title: c.title, description: c.description || '' }))
          : [{ title: '', description: '' }]
      );
      setFormErrors({});
      setShowEditModal(true);
    } catch (err: any) {
      addToast(err.message || 'Gagal memuat data PM', 'error');
    }
  };

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!formData.assetId) errs.assetId = 'Asset wajib diisi';
    if (!formData.title.trim()) errs.title = 'Judul wajib diisi';
    const validChecklists = formChecklists.filter(c => c.title.trim());
    if (validChecklists.length === 0) errs.checklists = 'Minimal 1 item checklist';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !editingPm) return;
    setSubmitting(true);
    try {
      const validChecklists = formChecklists.filter(c => c.title.trim()).map(c => ({
        title: c.title.trim(),
        description: c.description.trim() || undefined,
      }));
      await api.put(`/preventive-maintenance/${editingPm.id}`, {
        ...formData,
        checklists: validChecklists,
      });
      addToast('PM berhasil diupdate', 'success');
      setShowEditModal(false);
      setEditingPm(null);
      fetchData();
    } catch (err: any) {
      addToast(err.message || 'Gagal mengupdate PM', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    setDeleting(true);
    try {
      await api.delete(`/preventive-maintenance/${showDeleteConfirm.id}`);
      addToast('PM berhasil dihapus', 'success');
      setShowDeleteConfirm(null);
      fetchData();
    } catch (err: any) {
      addToast(err.message || 'Gagal menghapus PM', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const addChecklist = () => setFormChecklists([...formChecklists, { title: '', description: '' }]);
  const removeChecklist = (idx: number) => setFormChecklists(formChecklists.filter((_, i) => i !== idx));
  const updateChecklist = (idx: number, field: keyof ChecklistForm, value: string) => {
    const updated = [...formChecklists];
    updated[idx][field] = value;
    setFormChecklists(updated);
  };

  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Preventive Maintenance</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola jadwal perawatan aset</p>
        </div>
        {hasPermission('preventive_maintenance.create') && (
          <Button onClick={() => navigate('/preventive-maintenance/create')}>
            <Plus className="h-4 w-4" />
            Buat PM
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
            placeholder="Cari judul PM..."
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Semua Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Semua Frekuensi</option>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="YEARLY">Yearly</option>
          </select>
          <button
            onClick={() => { setSearch(''); setStatus(''); setFrequency(''); }}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Reset Filter
          </button>
        </div>
      </div>

      {loading ? (
        <Loading text="Loading PM schedules..." />
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Judul</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Aset</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Frekuensi</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    {hasPermission('preventive_maintenance.update') && (
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pmList.map((pm) => {
                    return (
                      <tr
                        key={pm.id}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/preventive-maintenance/${pm.id}`)}
                      >
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">{pm.title}</div>
                          {pm.description && (
                            <div className="text-xs text-slate-500 mt-0.5 max-w-[200px] truncate">{pm.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {(pm as any).assetCode || pm.asset?.assetCode || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${frequencyColors[pm.frequency] || 'bg-slate-100 text-slate-700'}`}>
                            {pm.frequency}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={pm.status}>{pm.status}</Badge>
                        </td>
                        {hasPermission('preventive_maintenance.update') && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => openEditModal(pm)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => navigate(`/preventive-maintenance?date=${pm.nextDueDate.split('T')[0]}`)}
                                className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Lihat di Kalender"
                              >
                                <Calendar className="h-4 w-4" />
                              </button>
                              {hasPermission('preventive_maintenance.delete') && (
                                <button
                                  onClick={() => setShowDeleteConfirm(pm)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Hapus"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {pmList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">Tidak ada jadwal PM ditemukan</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setEditingPm(null); }}
        title="Edit PM Schedule"
        size="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Asset *</label>
            <select
              value={formData.assetId}
              onChange={(e) => setFormData({ ...formData, assetId: e.target.value })}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${formErrors.assetId ? 'border-red-300' : 'border-slate-300'} focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
            >
              <option value="">Pilih aset</option>
              {assets.map(a => (
                <option key={a.id} value={a.id}>{a.assetCode} - {a.assetName}</option>
              ))}
            </select>
            {formErrors.assetId && <p className="text-sm text-red-600 mt-1">{formErrors.assetId}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Judul *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${formErrors.title ? 'border-red-300' : 'border-slate-300'} focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
              placeholder="Judul PM"
            />
            {formErrors.title && <p className="text-sm text-red-600 mt-1">{formErrors.title}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Deskripsi</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={2}
              placeholder="Deskripsi PM..."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">List Pekerjaan (Checklist)</label>
              <button type="button" onClick={addChecklist} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" /> Tambah
              </button>
            </div>
            {formErrors.checklists && <p className="text-sm text-red-600">{formErrors.checklists}</p>}
            {formChecklists.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2 bg-slate-50 rounded-lg p-2">
                <span className="text-xs font-medium text-slate-500 mt-1.5">{idx + 1}.</span>
                <div className="flex-1 space-y-1">
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateChecklist(idx, 'title', e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                    placeholder="Nama pekerjaan..."
                  />
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateChecklist(idx, 'description', e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                    placeholder="Deskripsi (opsional)..."
                  />
                </div>
                {formChecklists.length > 1 && (
                  <button type="button" onClick={() => removeChecklist(idx)} className="text-slate-400 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Frekuensi</label>
            <select
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {frequencyOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
            <Button variant="secondary" type="button" onClick={() => { setShowEditModal(false); setEditingPm(null); }}>
              Batal
            </Button>
            <Button type="submit" loading={submitting}>
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="Hapus PM Schedule"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Apakah Anda yakin ingin menghapus PM <strong>{showDeleteConfirm?.title}</strong>?
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>Batal</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              <Trash2 className="h-4 w-4" />
              Hapus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
