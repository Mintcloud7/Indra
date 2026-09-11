import React, { useState, useEffect } from 'react';
import { AlertTriangle, Package } from 'lucide-react';
import { api } from '../../api/client';
import { SparePart } from '../../api/types';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';
import { useNotification } from '../../context/NotificationContext';

function formatCurrency(amount: number) {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

export default function LowStockPage() {
  const [items, setItems] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { addToast } = useNotification();

  useEffect(() => {
    fetchLowStock();
  }, []);

  const fetchLowStock = async () => {
    setLoading(true);
    try {
      const data = await api.get<SparePart[]>('/spare-parts/low-stock');
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load low stock items');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePR = async (itemId: string) => {
    try {
      await api.post(`/spare-parts/${itemId}/generate-pr`);
      addToast('Purchase request generated', 'success');
    } catch (err) {
      addToast('Failed to generate purchase request', 'error');
    }
  };

  if (error) return <ErrorState message={error} onRetry={fetchLowStock} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-6 w-6 text-orange-500" />
        <h1 className="text-2xl font-bold text-slate-900">Low Stock Items</h1>
      </div>

      {loading ? (
        <Loading text="Loading low stock items..." />
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">All Stocked Up</h3>
          <p className="text-sm text-slate-500">No items are currently below minimum stock levels.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-red-200 shadow-sm p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-slate-900">{item.itemName}</h3>
                  <p className="text-xs text-slate-500">{item.itemCode}</p>
                </div>
                <Badge variant="CRITICAL">Low</Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Stock</span>
                  <span className="font-bold text-red-600">{item.currentStock} {item.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Minimum Stock</span>
                  <span className="text-slate-700">{item.minimumStock} {item.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Unit Cost</span>
                  <span className="text-slate-700">{formatCurrency(item.unitCost)}</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => handleGeneratePR(item.id)}
                >
                  Generate Purchase Request
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
