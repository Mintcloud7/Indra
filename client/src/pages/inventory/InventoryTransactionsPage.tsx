import React, { useState, useEffect, useCallback } from 'react';
import { Package, Truck, Wrench, RotateCcw, ArrowUpDown } from 'lucide-react';
import { api } from '../../api/client';
import { SparePart, Warehouse, PaginatedResponse } from '../../api/types';
import Badge from '../../components/ui/Badge';
import SearchInput from '../../components/ui/SearchInput';
import Select from '../../components/ui/Select';
import Pagination from '../../components/ui/Pagination';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';

const typeOptions = [
  { value: '', label: 'All Types' },
  { value: 'IN', label: 'Stock In' },
  { value: 'OUT', label: 'Stock Out' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
  { value: 'RETURN', label: 'Return' },
];

const transactionIcons: Record<string, React.ReactNode> = {
  IN: <Truck className="h-4 w-4" />,
  OUT: <Package className="h-4 w-4" />,
  ADJUSTMENT: <Wrench className="h-4 w-4" />,
  RETURN: <RotateCcw className="h-4 w-4" />,
};

const transactionColors: Record<string, string> = {
  IN: 'text-green-600 bg-green-50',
  OUT: 'text-orange-600 bg-orange-50',
  ADJUSTMENT: 'text-yellow-600 bg-yellow-50',
  RETURN: 'text-blue-600 bg-blue-50',
};

const typeLabels: Record<string, string> = {
  IN: 'Stock In',
  OUT: 'Stock Out',
  ADJUSTMENT: 'Adjustment',
  RETURN: 'Return',
};

function formatCurrency(amount: number) {
  return `Rp ${Number(amount).toLocaleString('id-ID')}`;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface TransactionFormData {
  itemId: string;
  warehouseId: string;
  quantity: number;
  unitCost: number;
  notes: string;
}

const emptyForm: TransactionFormData = {
  itemId: '',
  warehouseId: '',
  quantity: 0,
  unitCost: 0,
  notes: '',
};

export default function InventoryTransactionsPage() {
  const { hasPermission } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [type, setType] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Summary stats
  const [stats, setStats] = useState({ inCount: 0, outCount: 0, adjCount: 0, retCount: 0, totalValue: 0 });

  // Reference data
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<string>('IN');
  const [formData, setFormData] = useState<TransactionFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Expanded rows
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (type) params.append('transactionType', type);
      if (warehouseFilter) params.append('warehouseId', warehouseFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate + 'T23:59:59');

      const res = await api.get<PaginatedResponse<any>>(`/transactions?${params.toString()}`);
      let filteredData = res.data;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredData = filteredData.filter((t: any) =>
          (t.itemName && t.itemName.toLowerCase().includes(term)) ||
          (t.itemCode && t.itemCode.toLowerCase().includes(term)) ||
          (t.createdByName && t.createdByName.toLowerCase().includes(term)) ||
          (t.notes && t.notes.toLowerCase().includes(term))
        );
      }

      setTransactions(filteredData);
      setTotalPages(res.totalPages);
      setTotal(res.total);

      // Compute stats from all loaded data (approximate)
      const inCount = filteredData.filter((t: any) => t.transactionType === 'IN').length;
      const outCount = filteredData.filter((t: any) => t.transactionType === 'OUT').length;
      const adjCount = filteredData.filter((t: any) => t.transactionType === 'ADJUSTMENT').length;
      const retCount = filteredData.filter((t: any) => t.transactionType === 'RETURN').length;
      const totalValue = filteredData.reduce((sum: number, t: any) => sum + (Number(t.unitCost) * Number(t.quantity)), 0);
      setStats({ inCount, outCount, adjCount, retCount, totalValue });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, type, warehouseFilter, startDate, endDate, searchTerm]);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [spRes, whRes] = await Promise.all([
        api.get<PaginatedResponse<SparePart>>('/spare-parts?limit=500'),
        api.get<any>('/warehouses'),
      ]);
      setSpareParts(spRes.data);
      setWarehouses(Array.isArray(whRes) ? whRes : whRes.data || []);
    } catch {}
  }, []);

  useEffect(() => { fetchReferenceData(); }, [fetchReferenceData]);
  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const resetFilters = () => {
    setType('');
    setWarehouseFilter('');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
    setPage(1);
  };

  const openCreate = (t: string) => {
    setCreateType(t);
    setFormData(emptyForm);
    setFormErrors({});
    setShowCreateModal(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.itemId) errors.itemId = 'Item harus dipilih';
    if (!formData.warehouseId) errors.warehouseId = 'Gudang harus dipilih';
    if (formData.quantity <= 0) errors.quantity = 'Jumlah harus lebih dari 0';
    if (formData.unitCost < 0) errors.unitCost = 'Harga tidak boleh negatif';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const endpoint = createType === 'IN' ? '/stock-in'
        : createType === 'OUT' ? '/stock-out'
        : createType === 'ADJUSTMENT' ? '/adjustment'
        : '/return';

      await api.post(endpoint, {
        itemId: formData.itemId,
        warehouseId: formData.warehouseId,
        quantity: Number(formData.quantity),
        unitCost: Number(formData.unitCost),
        notes: formData.notes || undefined,
      });

      setShowCreateModal(false);
      fetchTransactions();
    } catch (err: any) {
      setFormErrors({ submit: err.message || 'Gagal menyimpan transaksi' });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSparePart = spareParts.find(sp => sp.id === formData.itemId);

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory Transactions</h1>
          <p className="text-sm text-slate-500 mt-1">{total} transaksi tercatat</p>
        </div>
        {hasPermission('inventory.update') && (
          <div className="flex gap-2">
            <button onClick={() => openCreate('IN')} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
              <Truck className="h-4 w-4" /> Stock In
            </button>
            <button onClick={() => openCreate('OUT')} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium">
              <Package className="h-4 w-4" /> Stock Out
            </button>
            <button onClick={() => openCreate('ADJUSTMENT')} className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm font-medium">
              <Wrench className="h-4 w-4" /> Adjust
            </button>
            <button onClick={() => openCreate('RETURN')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
              <RotateCcw className="h-4 w-4" /> Return
            </button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500 mb-1">Total Transaksi</div>
          <div className="text-2xl font-bold text-slate-900">{total}</div>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-4">
          <div className="text-xs font-medium text-green-600 mb-1">Stock In</div>
          <div className="text-2xl font-bold text-green-700">{stats.inCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-orange-200 p-4">
          <div className="text-xs font-medium text-orange-600 mb-1">Stock Out</div>
          <div className="text-2xl font-bold text-orange-700">{stats.outCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-yellow-200 p-4">
          <div className="text-xs font-medium text-yellow-600 mb-1">Adjustment</div>
          <div className="text-2xl font-bold text-yellow-700">{stats.adjCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-4">
          <div className="text-xs font-medium text-blue-600 mb-1">Return</div>
          <div className="text-2xl font-bold text-blue-700">{stats.retCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <SearchInput
              value={searchTerm}
              onChange={(val) => { setSearchTerm(val); setPage(1); }}
              placeholder="Cari item, kode, atau catatan..."
            />
          </div>
          <div className="w-44">
            <Select
              options={typeOptions}
              value={type}
              onChange={(e) => { setType(e.target.value); setPage(1); }}
            />
          </div>
          <div className="w-44">
            <Select
              options={[
                { value: '', label: 'Semua Gudang' },
                ...warehouses.map(w => ({ value: w.id, label: w.name })),
              ]}
              value={warehouseFilter}
              onChange={(e) => { setWarehouseFilter(e.target.value); setPage(1); }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Dari</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="h-10 px-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Sampai</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="h-10 px-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {(type || warehouseFilter || startDate || endDate || searchTerm) && (
            <button onClick={resetFilters} className="h-10 px-3 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <Loading text="Loading transaksi..." />
      ) : transactions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">Tidak ada transaksi ditemukan</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="w-12 px-4 py-3"></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tanggal</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Item</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tipe</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Gudang</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Jumlah</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Total Nilai</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Oleh</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {transactions.map((t: any) => (
                    <React.Fragment key={t.id}>
                      <tr
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                      >
                        <td className="px-4 py-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${transactionColors[t.transactionType] || 'text-slate-400 bg-slate-50'}`}>
                            {transactionIcons[t.transactionType] || <ArrowUpDown className="h-4 w-4" />}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-slate-900">{new Date(t.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                          <div className="text-xs text-slate-500">{new Date(t.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 text-sm">{t.itemName || '-'}</div>
                          <div className="text-xs text-slate-500">{t.itemCode || ''}</div>
                        </td>
                        <td className="px-4 py-3"><Badge variant={t.transactionType}>{typeLabels[t.transactionType] || t.transactionType}</Badge></td>
                        <td className="px-4 py-3 text-sm text-slate-700">{t.warehouseName || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold text-sm ${t.transactionType === 'OUT' ? 'text-red-600' : t.transactionType === 'IN' ? 'text-green-600' : 'text-slate-900'}`}>
                            {t.transactionType === 'OUT' ? '-' : '+'}{Number(t.quantity)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm">{formatCurrency(Number(t.unitCost) * Number(t.quantity))}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{t.createdByName || '-'}</td>
                      </tr>
                      {expandedId === t.id && (
                        <tr>
                          <td colSpan={8} className="px-4 py-3 bg-slate-50 border-t border-slate-100">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-xs text-slate-500">ID Transaksi</span>
                                <div className="font-mono text-xs text-slate-700 mt-0.5">{t.id}</div>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500">Harga Satuan</span>
                                <div className="text-slate-900 mt-0.5">{formatCurrency(Number(t.unitCost))}</div>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500">Total Nilai</span>
                                <div className="font-semibold text-slate-900 mt-0.5">{formatCurrency(Number(t.unitCost) * Number(t.quantity))}</div>
                              </div>
                              <div>
                                <span className="text-xs text-slate-500">Waktu</span>
                                <div className="text-slate-900 mt-0.5">{formatDate(t.createdAt)}</div>
                              </div>
                            </div>
                            {t.notes && (
                              <div className="mt-3">
                                <span className="text-xs text-slate-500">Catatan</span>
                                <div className="text-sm text-slate-700 mt-0.5">{t.notes}</div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Create Transaction Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={`New ${typeLabels[createType] || createType}`}
        size="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className={`flex items-center gap-2 p-3 rounded-lg ${transactionColors[createType]}`}>
            {transactionIcons[createType]}
            <span className="font-medium text-sm">{typeLabels[createType]}</span>
          </div>

          <Select
            label="Item *"
            options={spareParts.map(sp => ({
              value: String(sp.id),
              label: `${sp.itemCode} - ${sp.itemName} (Stok: ${sp.currentStock})`,
            }))}
            value={formData.itemId}
            onChange={e => setFormData({ ...formData, itemId: e.target.value })}
            error={formErrors.itemId}
            placeholder="Pilih item"
          />

          {selectedSparePart && (
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 rounded-lg p-2">
                <div className="text-slate-500">Stok Saat Ini</div>
                <div className="font-bold text-slate-900">{selectedSparePart.currentStock} {selectedSparePart.unit}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <div className="text-slate-500">Min Stok</div>
                <div className="font-bold text-slate-900">{selectedSparePart.minimumStock}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <div className="text-slate-500">Harga Satuan</div>
                <div className="font-bold text-slate-900">{formatCurrency(Number(selectedSparePart.unitCost))}</div>
              </div>
            </div>
          )}

          <Select
            label="Gudang *"
            options={warehouses.map(w => ({ value: w.id, label: w.name }))}
            value={formData.warehouseId}
            onChange={e => setFormData({ ...formData, warehouseId: e.target.value })}
            error={formErrors.warehouseId}
            placeholder="Pilih gudang"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Jumlah *"
              type="number"
              min={1}
              value={String(formData.quantity)}
              onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })}
              error={formErrors.quantity}
            />
            <Input
              label="Harga Satuan (Rp)"
              type="number"
              min={0}
              value={String(formData.unitCost)}
              onChange={e => setFormData({ ...formData, unitCost: Number(e.target.value) })}
              error={formErrors.unitCost}
            />
          </div>

          {formData.quantity > 0 && formData.unitCost > 0 && (
            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <span className="text-blue-600 font-medium">Total: </span>
              <span className="font-bold text-blue-800">{formatCurrency(formData.quantity * formData.unitCost)}</span>
            </div>
          )}

          {createType === 'OUT' && selectedSparePart && formData.quantity > selectedSparePart.currentStock && (
            <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">
              Stok tidak mencukupi! Tersedia: {selectedSparePart.currentStock}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="w-full h-20 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Catatan opsional..."
            />
          </div>

          {formErrors.submit && (
            <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{formErrors.submit}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || (createType === 'OUT' && selectedSparePart && formData.quantity > selectedSparePart.currentStock)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Transaksi'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
