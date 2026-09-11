import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../api/client';
import { SparePart } from '../../api/types';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card, { CardHeader, CardBody, CardTitle } from '../../components/ui/Card';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';

function formatCurrency(amount: number) {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

export default function SparePartDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [part, setPart] = useState<SparePart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<SparePart>(`/spare-parts/${id}`)
      .then(setPart)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loading text="Loading spare part..." />;
  if (error) return <ErrorState message={error} />;
  if (!part) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/inventory/spare-parts')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{part.itemCode}</h1>
            <Badge variant={part.currentStock <= part.minimumStock ? 'CRITICAL' : 'info'}>
              {part.currentStock <= part.minimumStock ? 'Low Stock' : 'In Stock'}
            </Badge>
            {part.currentStock <= part.minimumStock && (
              <span className="badge badge-critical">Low Stock</span>
            )}
          </div>
          <p className="text-slate-600 mt-1">{part.itemName}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Spare Part Details</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-slate-500">Code</dt>
              <dd className="text-sm font-medium text-slate-900">{part.itemCode}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Name</dt>
              <dd className="text-sm font-medium text-slate-900">{part.itemName}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Category</dt>
              <dd className="text-sm font-medium text-slate-900">{part.category}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Unit</dt>
              <dd className="text-sm font-medium text-slate-900">{part.unit}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Current Stock</dt>
              <dd className={`text-sm font-medium ${part.currentStock <= part.minimumStock ? 'text-red-600' : 'text-slate-900'}`}>
                {part.currentStock}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Minimum Stock</dt>
              <dd className="text-sm font-medium text-slate-900">{part.minimumStock}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Maximum Stock</dt>
              <dd className="text-sm font-medium text-slate-900">{part.maximumStock}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Unit Cost</dt>
              <dd className="text-sm font-medium text-slate-900">{formatCurrency(part.unitCost)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-sm text-slate-500">Location</dt>
              <dd className="text-sm font-medium text-slate-900">{part.stockLocation || '-'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-sm text-slate-500">Specification</dt>
              <dd className="text-sm text-slate-700">{part.specification || '-'}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}
