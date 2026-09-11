import React, { useState, useEffect, useCallback } from 'react';
import { FileText, RefreshCw, Plus, Printer, Cloud, X, Eye, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { SparePart } from '../../api/types';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  ORDERED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
};

interface PR {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  customItemName?: string;
  customItemCode?: string;
  quantity: number;
  unit: string;
  reason: string;
  currentStock: number;
  minimumStock: number;
  status: string;
  receivedAt?: string;
  syncStatus?: string;
  createdAt: string;
  updatedAt: string;
  warehouseName?: string;
}

export default function PurchaseRequisitionListPage() {
  const { addToast } = useNotification();
  const { user } = useAuth();
  const userRoles = (user?.roles || []) as string[];
  const canApproveOrder = userRoles.some(r => ['ADMIN', 'MANAGER'].includes(r.toUpperCase()));
  const canCreatePR = userRoles.some(r => ['ADMIN', 'TECHNICIAN', 'SUPERVISOR'].includes(r.toUpperCase()));
  const [items, setItems] = useState<PR[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<PR | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<PR | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<PR | null>(null);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [form, setForm] = useState({ itemId: '', quantity: '', reason: '', customItemName: '', customItemCode: '', isCustom: false });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [erpIntegrated, setErpIntegrated] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) params.append('status', status);
      const res = await api.get<{ data: PR[]; total: number; totalPages: number }>(`/purchase-requisitions?${params.toString()}`);
      setItems(res.data || []);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchase requisitions');
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [status]);

  useEffect(() => {
    api.get<any>('/integrations/zahir/config').then((config) => {
      const hasUrl = config?.api_url?.value && config.api_url.value.trim() !== '';
      setErpIntegrated(!!hasUrl);
    }).catch(() => setErpIntegrated(false));
  }, []);

  const fetchSpareParts = async () => {
    try {
      const res = await api.get<any>('/spare-parts?limit=1000');
      const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setSpareParts(items);
    } catch (err) {
      console.error('Failed to load spare parts:', err);
    }
  };

  const openCreateModal = () => {
    fetchSpareParts();
    setForm({ itemId: '', quantity: '', reason: '', customItemName: '', customItemCode: '', isCustom: false });
    setFormErrors({});
    setShowCreateModal(true);
  };

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (form.isCustom) {
      if (!form.customItemName.trim()) errs.customItemName = 'Nama item wajib diisi';
      if (!form.quantity || Number(form.quantity) <= 0) errs.quantity = 'Qty harus > 0';
    } else {
      if (!form.itemId) errs.itemId = 'Item wajib dipilih';
      if (!form.quantity || Number(form.quantity) <= 0) errs.quantity = 'Qty harus > 0';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setCreating(true);
    try {
      const payload: any = {
        quantity: Number(form.quantity),
        reason: form.reason || undefined,
      };
      if (form.isCustom) {
        payload.customItemName = form.customItemName;
        payload.customItemCode = form.customItemCode || undefined;
      } else {
        payload.itemId = form.itemId;
      }
      await api.post('/purchase-requisitions', payload);
      addToast('Purchase Request berhasil dibuat', 'success');
      setShowCreateModal(false);
      fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal membuat Purchase Request', 'error');
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (pr: PR) => {
    fetchSpareParts();
    const isCustom = !pr.itemId;
    setForm({
      itemId: pr.itemId || '',
      quantity: String(pr.quantity),
      reason: pr.reason || '',
      customItemName: (pr as any).customItemName || pr.itemName || '',
      customItemCode: (pr as any).customItemCode || pr.itemCode || '',
      isCustom,
    });
    setFormErrors({});
    setShowEditModal(pr);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !showEditModal) return;
    setCreating(true);
    try {
      const payload: any = {
        quantity: Number(form.quantity),
        reason: form.reason || undefined,
      };
      if (form.isCustom) {
        payload.customItemName = form.customItemName;
        payload.customItemCode = form.customItemCode || undefined;
      } else {
        payload.itemId = form.itemId;
      }
      await api.put(`/purchase-requisitions/${showEditModal.id}`, payload);
      addToast('Purchase Request berhasil diupdate', 'success');
      setShowEditModal(null);
      fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal mengupdate Purchase Request', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    setDeleting(true);
    try {
      await api.delete(`/purchase-requisitions/${showDeleteConfirm.id}`);
      addToast('Purchase Request berhasil dihapus', 'success');
      setShowDeleteConfirm(null);
      fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal menghapus Purchase Request', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      await api.put(`/purchase-requisitions/${id}`, { status: newStatus });
      addToast(`Status updated to ${newStatus}`, 'success');
      fetchData();
      if (showDetailModal?.id === id) {
        setShowDetailModal(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to update status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSyncZahir = async (id: string) => {
    setUpdatingId(id);
    try {
      await api.post(`/purchase-requisitions/${id}/sync-zahir`);
      addToast('Berhasil sync ke Zahir Accounting', 'success');
      fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal sync ke Zahir', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePrint = (pr: PR) => {
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentDocument || printFrame.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Request - ${pr.itemCode}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
          .header h1 { font-size: 20px; margin: 0; }
          .header p { font-size: 12px; color: #666; margin: 5px 0 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 10px 12px; text-align: left; font-size: 13px; }
          th { background: #f5f5f5; font-weight: 600; width: 40%; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; }
          .footer div { width: 45%; text-align: center; }
          .footer .line { border-top: 1px solid #333; margin-top: 60px; padding-top: 5px; }
          .status { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PURCHASE REQUEST</h1>
          <p>PT. Indra Manufacturing</p>
        </div>
        <table>
          <tr><th>No. Purchase Request</th><td>${pr.id.substring(0, 8).toUpperCase()}</td></tr>
          <tr><th>Tanggal</th><td>${new Date(pr.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</td></tr>
          <tr><th>Status</th><td><span class="status">${pr.status}</span></td></tr>
          <tr><th>Kode Item</th><td>${pr.itemCode}${!pr.itemId ? ' (Custom)' : ''}</td></tr>
          <tr><th>Nama Item</th><td>${pr.itemName}</td></tr>
          <tr><th>Jumlah</th><td>${pr.quantity} ${pr.unit}</td></tr>
          <tr><th>Stok Saat Ini</th><td>${pr.currentStock} ${pr.unit}</td></tr>
          <tr><th>Stok Minimum</th><td>${pr.minimumStock} ${pr.unit}</td></tr>
          <tr><th>Alasan</th><td>${pr.reason}</td></tr>
          ${pr.status === 'COMPLETED' && pr.receivedAt ? `<tr><th>Diterima Tanggal</th><td>${new Date(pr.receivedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>` : ''}
        </table>
        <div class="footer">
          <div>
            <div class="line">Diminta Oleh</div>
          </div>
          <div>
            <div class="line">Disetujui Oleh</div>
          </div>
        </div>
      </body>
      </html>
    `);
    doc.close();

    printFrame.contentWindow?.focus();
    printFrame.contentWindow?.print();

    setTimeout(() => document.body.removeChild(printFrame), 1000);
  };

  function formatCurrency(amount: number) {
    return `Rp ${(amount || 0).toLocaleString('id-ID')}`;
  }

  const selectedSparePart = spareParts.find(sp => sp.id === form.itemId);

  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Purchase Requests</h1>
            <p className="text-sm text-slate-500">Daftar permintaan pembelian spare part</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          {canCreatePR && (
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4" /> Buat Purchase Request
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Semua Status</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="ORDERED">Ordered</option>
            <option value="COMPLETED">Selesai</option>
          </select>
          {status && (
            <button onClick={() => setStatus('')} className="text-sm text-blue-600 hover:text-blue-800">
              Reset
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <Loading text="Loading purchase requisitions..." />
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">Belum ada Purchase Request</h3>
          <p className="text-sm text-slate-500">Klik "Buat Purchase Request" untuk membuat permintaan pembelian baru.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Item</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Alasan</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Tanggal</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((pr) => (
                  <tr key={pr.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{pr.itemName}</div>
                      <div className="text-xs text-slate-500">{pr.itemCode}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {pr.quantity} {pr.unit}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-[250px] truncate">
                      {pr.reason}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[pr.status] || 'bg-slate-100 text-slate-700'}`}>
                        {pr.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {new Date(pr.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setShowDetailModal(pr)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Detail"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {pr.status === 'DRAFT' && canApproveOrder && (
                          <button
                            onClick={() => openEditModal(pr)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {userRoles.includes('ADMIN') && (
                          <button
                            onClick={() => setShowDeleteConfirm(pr)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handlePrint(pr)}
                          className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Print"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Create PR Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Buat Purchase Request</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <input
                  type="checkbox"
                  id="isCustom"
                  checked={form.isCustom}
                  onChange={(e) => setForm({ ...form, isCustom: e.target.checked, itemId: '', customItemName: '', customItemCode: '' })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isCustom" className="text-sm font-medium text-slate-700">Pembelian di luar daftar spare part</label>
              </div>

              {form.isCustom ? (
                <>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-700">Kode Item</label>
                    <input
                      type="text"
                      value={form.customItemCode}
                      onChange={(e) => setForm({ ...form, customItemCode: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Kode item (opsional)"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-700">Nama Item *</label>
                    <input
                      type="text"
                      value={form.customItemName}
                      onChange={(e) => setForm({ ...form, customItemName: e.target.value })}
                      className={`w-full rounded-lg border px-3 py-2 text-sm ${formErrors.customItemName ? 'border-red-300' : 'border-slate-300'} focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
                      placeholder="Nama barang yang akan dibeli"
                    />
                    {formErrors.customItemName && <p className="text-sm text-red-600">{formErrors.customItemName}</p>}
                  </div>
                </>
              ) : (
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">Spare Part *</label>
                  <select
                    value={form.itemId}
                    onChange={(e) => setForm({ ...form, itemId: e.target.value })}
                    className={`w-full rounded-lg border px-3 py-2 text-sm ${formErrors.itemId ? 'border-red-300' : 'border-slate-300'} focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
                  >
                    <option value="">Pilih spare part</option>
                    {spareParts.map(sp => (
                      <option key={sp.id} value={sp.id}>{sp.itemCode} - {sp.itemName} (Stok: {sp.currentStock} {sp.unit})</option>
                    ))}
                  </select>
                  {formErrors.itemId && <p className="text-sm text-red-600">{formErrors.itemId}</p>}
                </div>
              )}

              {selectedSparePart && !form.isCustom && (
                <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-slate-500">Stok Saat Ini</span><span className="font-medium">{selectedSparePart.currentStock} {selectedSparePart.unit}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Stok Minimum</span><span className="font-medium">{selectedSparePart.minimumStock} {selectedSparePart.unit}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Harga Satuan</span><span className="font-medium">{formatCurrency(selectedSparePart.unitCost)}</span></div>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Jumlah *</label>
                <input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${formErrors.quantity ? 'border-red-300' : 'border-slate-300'} focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
                  min="1"
                  placeholder="Jumlah yang dibutuhkan"
                />
                {formErrors.quantity && <p className="text-sm text-red-600">{formErrors.quantity}</p>}
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Alasan</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={2}
                  placeholder="Alasan pembelian (opsional)"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>Batal</Button>
                <Button type="submit" loading={creating}>Buat Purchase Request</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail + Action Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Detail Purchase Request</h2>
              <button onClick={() => setShowDetailModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm mb-6">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">No. Purchase Request</span>
                <span className="font-medium text-slate-900">{showDetailModal.id.substring(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Item</span>
                <span className="font-medium text-slate-900">
                  {showDetailModal.itemCode} - {showDetailModal.itemName}
                  {!showDetailModal.itemId && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Custom</span>}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Jumlah</span>
                <span className="font-medium text-slate-900">{showDetailModal.quantity} {showDetailModal.unit}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Stok Saat Ini</span>
                <span className="font-medium text-red-600">{showDetailModal.currentStock} {showDetailModal.unit}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Alasan</span>
                <span className="font-medium text-slate-900">{showDetailModal.reason}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Status</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[showDetailModal.status]}`}>{showDetailModal.status}</span>
              </div>
              {showDetailModal.status === 'COMPLETED' && showDetailModal.receivedAt && (
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Diterima Tanggal</span>
                  <span className="font-medium text-emerald-600">{new Date(showDetailModal.receivedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Tanggal</span>
                <span className="font-medium text-slate-900">{new Date(showDetailModal.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-200">
              <div className="flex gap-2">
                {showDetailModal.status === 'DRAFT' && canApproveOrder && (
                  <>
                    <Button variant="primary" size="sm" onClick={() => { handleStatusChange(showDetailModal.id, 'PENDING'); setShowDetailModal(null); }}>
                      Submit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => { handleStatusChange(showDetailModal.id, 'REJECTED'); setShowDetailModal(null); }}>
                      Cancel Purchase Request
                    </Button>
                  </>
                )}
                {showDetailModal.status === 'PENDING' && canApproveOrder && (
                  <Button variant="success" size="sm" onClick={() => { handleStatusChange(showDetailModal.id, 'APPROVED'); setShowDetailModal(null); }}>
                    Approve
                  </Button>
                )}
                {showDetailModal.status === 'APPROVED' && canApproveOrder && (
                  <>
                    <Button variant="primary" size="sm" onClick={() => { handleStatusChange(showDetailModal.id, 'ORDERED'); setShowDetailModal(null); }}>
                      Order
                    </Button>
                    {erpIntegrated && (
                      <Button variant="secondary" size="sm" onClick={() => { handleSyncZahir(showDetailModal.id); setShowDetailModal(null); }}>
                        <Cloud className="h-4 w-4" /> Kirim ke ERP
                      </Button>
                    )}
                  </>
                )}
                {showDetailModal.status === 'ORDERED' && canApproveOrder && (
                  <Button variant="success" size="sm" onClick={async () => {
                    const now = new Date().toISOString();
                    await api.put(`/purchase-requisitions/${showDetailModal.id}`, { status: 'COMPLETED', receivedAt: now });
                    addToast('Barang telah diterima', 'success');
                    setShowDetailModal(null);
                    fetchData();
                  }}>
                    Selesai - Barang Diterima
                  </Button>
                )}
                {showDetailModal.status === 'COMPLETED' && (
                  <span className="text-sm text-emerald-600 font-medium">
                    Barang diterima: {showDetailModal.receivedAt ? new Date(showDetailModal.receivedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {showDetailModal.status === 'DRAFT' && canApproveOrder && (
                  <Button variant="warning" size="sm" onClick={() => { setShowDetailModal(null); openEditModal(showDetailModal); }}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                )}
                {userRoles.includes('ADMIN') && (
                  <Button variant="danger" size="sm" onClick={() => { setShowDetailModal(null); setShowDeleteConfirm(showDetailModal); }}>
                    <Trash2 className="h-4 w-4" /> Hapus
                  </Button>
                )}
                {showDetailModal.status !== 'DRAFT' && (
                  <Button variant="secondary" size="sm" onClick={() => handlePrint(showDetailModal)}>
                    <Printer className="h-4 w-4" /> Print
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit PR Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Edit Purchase Request</h2>
              <button onClick={() => setShowEditModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              {form.isCustom ? (
                <>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-700">Kode Item</label>
                    <input
                      type="text"
                      value={form.customItemCode}
                      onChange={(e) => setForm({ ...form, customItemCode: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Kode item (opsional)"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-700">Nama Item *</label>
                    <input
                      type="text"
                      value={form.customItemName}
                      onChange={(e) => setForm({ ...form, customItemName: e.target.value })}
                      className={`w-full rounded-lg border px-3 py-2 text-sm ${formErrors.customItemName ? 'border-red-300' : 'border-slate-300'} focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
                      placeholder="Nama barang yang akan dibeli"
                    />
                    {formErrors.customItemName && <p className="text-sm text-red-600">{formErrors.customItemName}</p>}
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-700">Spare Part *</label>
                    <select
                      value={form.itemId}
                      onChange={(e) => setForm({ ...form, itemId: e.target.value })}
                      className={`w-full rounded-lg border px-3 py-2 text-sm ${formErrors.itemId ? 'border-red-300' : 'border-slate-300'} focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
                    >
                      <option value="">Pilih spare part</option>
                      {spareParts.map(sp => (
                        <option key={sp.id} value={sp.id}>{sp.itemCode} - {sp.itemName} (Stok: {sp.currentStock} {sp.unit})</option>
                      ))}
                    </select>
                    {formErrors.itemId && <p className="text-sm text-red-600">{formErrors.itemId}</p>}
                  </div>
                  {selectedSparePart && (
                    <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                      <div className="flex justify-between"><span className="text-slate-500">Stok Saat Ini</span><span className="font-medium">{selectedSparePart.currentStock} {selectedSparePart.unit}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Stok Minimum</span><span className="font-medium">{selectedSparePart.minimumStock} {selectedSparePart.unit}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Harga Satuan</span><span className="font-medium">{formatCurrency(selectedSparePart.unitCost)}</span></div>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Jumlah *</label>
                <input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${formErrors.quantity ? 'border-red-300' : 'border-slate-300'} focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
                  min="1"
                  placeholder="Jumlah yang dibutuhkan"
                />
                {formErrors.quantity && <p className="text-sm text-red-600">{formErrors.quantity}</p>}
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Alasan</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={2}
                  placeholder="Alasan pembelian (opsional)"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" type="button" onClick={() => setShowEditModal(null)}>Batal</Button>
                <Button type="submit" loading={creating}>Simpan</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Hapus Purchase Request?</h2>
              <button onClick={() => setShowDeleteConfirm(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Purchase Request <strong>{showDeleteConfirm.itemCode} - {showDeleteConfirm.itemName}</strong> akan dihapus permanen.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>Batal</Button>
              <Button variant="danger" onClick={handleDelete} loading={deleting}>
                <Trash2 className="h-4 w-4" /> Hapus
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
