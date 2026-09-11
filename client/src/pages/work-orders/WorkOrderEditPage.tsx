import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../api/client';
import { Asset } from '../../api/types';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Card, { CardHeader, CardBody, CardTitle } from '../../components/ui/Card';
import Loading from '../../components/ui/Loading';
import { useNotification } from '../../context/NotificationContext';

const priorityOptions = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

export default function WorkOrderEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    assetId: '',
    title: '',
    description: '',
    priority: 'MEDIUM',
    problemDescription: '',
    rootCause: '',
    actionTaken: '',
    dueDate: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [woRes, assetsRes] = await Promise.all([
          api.get<any>(`/work-orders/${id}`),
          api.get<any>('/assets?limit=1000'),
        ]);
        setAssets(Array.isArray(assetsRes.data) ? assetsRes.data : Array.isArray(assetsRes) ? assetsRes : []);
        setForm({
          assetId: String(woRes.assetId || ''),
          title: woRes.title || '',
          description: woRes.description || '',
          priority: woRes.priority || 'MEDIUM',
          problemDescription: woRes.problemDescription || '',
          rootCause: woRes.rootCause || '',
          actionTaken: woRes.actionTaken || '',
          dueDate: woRes.dueDate ? woRes.dueDate.split('T')[0] : '',
        });
      } catch (err) {
        addToast('Failed to load work order', 'error');
        navigate('/work-orders');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.assetId) newErrors.assetId = 'Asset harus dipilih';
    if (!form.title.trim()) newErrors.title = 'Title harus diisi';
    if (!form.dueDate) newErrors.dueDate = 'Due date harus diisi';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      await api.put(`/work-orders/${id}`, form);
      addToast('Work order updated', 'success');
      navigate(`/work-orders/${id}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading text="Loading work order..." />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(`/work-orders/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">Edit Work Order</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Work Order Details</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Select
              label="Asset *"
              options={assets.map((a) => ({ value: String(a.id), label: `${a.assetCode} - ${a.assetName}` }))}
              value={form.assetId}
              onChange={(e) => setForm({ ...form, assetId: e.target.value })}
              error={errors.assetId}
              placeholder="Select asset"
            />

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

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Root Cause</label>
              <textarea
                value={form.rootCause}
                onChange={(e) => setForm({ ...form, rootCause: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={2}
                placeholder="Root cause analysis..."
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Action Taken</label>
              <textarea
                value={form.actionTaken}
                onChange={(e) => setForm({ ...form, actionTaken: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={2}
                placeholder="Actions taken..."
              />
            </div>

            <Input
              label="Due Date *"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              error={errors.dueDate}
            />
          </CardBody>
        </Card>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" type="button" onClick={() => navigate(`/work-orders/${id}`)}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
