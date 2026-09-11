import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';
import { Asset } from '../../api/types';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Card, { CardHeader, CardBody, CardTitle } from '../../components/ui/Card';
import FileUpload from '../../components/ui/FileUpload';
import { useNotification } from '../../context/NotificationContext';

const priorityOptions = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

export default function WorkOrderCreatePage() {
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    assetId: '',
    title: '',
    description: '',
    priority: 'MEDIUM',
    problemDescription: '',
    dueDate: '',
  });

  const [photo, setPhoto] = useState<File | null>(null);

  useEffect(() => {
    setLoadingAssets(true);
    setAssetError(null);
    api.get<any>('/assets?limit=1000')
      .then((res) => {
        const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        setAssets(items);
        if (items.length === 0) {
          setAssetError('No assets found. Please create an asset first.');
        }
      })
      .catch((err) => {
        console.error('Failed to load assets:', err);
        setAssetError(err?.message || 'Failed to load assets');
      })
      .finally(() => setLoadingAssets(false));
  }, []);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.assetId) newErrors.assetId = 'Asset is required';
    if (!form.title.trim()) newErrors.title = 'Title is required';
    if (!form.dueDate) newErrors.dueDate = 'Due date is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await api.post<{ id: string }>('/work-orders', form);

      if (photo) {
        await api.uploadFile(`/work-orders/${response.id}/attachments`, photo);
      }

      addToast('Work order created successfully', 'success');
      navigate(`/work-orders/${response.id}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to create work order', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/work-orders')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">Create Work Order</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Work Order Details</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            {loadingAssets ? (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Asset *</label>
                <div className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-400">
                  Loading assets...
                </div>
              </div>
            ) : assetError ? (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Asset *</label>
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {assetError}
                </div>
              </div>
            ) : (
              <Select
                label="Asset *"
                options={assets.map((a) => ({ value: String(a.id), label: `${a.assetCode} - ${a.assetName}` }))}
                value={form.assetId}
                onChange={(e) => setForm({ ...form, assetId: e.target.value })}
                error={errors.assetId}
                placeholder="Select asset"
              />
            )}

            <Input
              label="Title *"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              error={errors.title}
              placeholder="Work order title"
            />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={3}
                placeholder="Detailed description..."
              />
            </div>

            <Select
              label="Priority"
              options={priorityOptions}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Problem Description</label>
              <textarea
                value={form.problemDescription}
                onChange={(e) => setForm({ ...form, problemDescription: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={3}
                placeholder="Describe the problem..."
              />
            </div>

            <Input
              label="Due Date *"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              error={errors.dueDate}
            />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Photo</label>
              <FileUpload
                onFileSelect={setPhoto}
                file={photo}
                onRemove={() => setPhoto(null)}
                accept="image/*"
                label="Upload photo"
              />
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" type="button" onClick={() => navigate('/work-orders')}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create Work Order
          </Button>
        </div>
      </form>
    </div>
  );
}
