import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { Asset } from '../../api/types';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Card, { CardHeader, CardBody, CardTitle } from '../../components/ui/Card';
import { useNotification } from '../../context/NotificationContext';

const frequencyOptions = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
];

interface ChecklistItem {
  title: string;
  description: string;
}

export default function PMCreatePage() {
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    assetId: '',
    title: '',
    description: '',
    frequency: 'MONTHLY',
  });

  const [checklists, setChecklists] = useState<ChecklistItem[]>([
    { title: '', description: '' },
  ]);

  useEffect(() => {
    api.get<any>('/assets?limit=1000').then((res) => {
      const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setAssets(items);
    }).catch(console.error);
  }, []);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.assetId) newErrors.assetId = 'Asset is required';
    if (!form.title.trim()) newErrors.title = 'Title is required';
    const validChecklists = checklists.filter(c => c.title.trim());
    if (validChecklists.length === 0) newErrors.checklists = 'At least one checklist item is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const addChecklist = () => {
    setChecklists([...checklists, { title: '', description: '' }]);
  };

  const removeChecklist = (index: number) => {
    setChecklists(checklists.filter((_, i) => i !== index));
  };

  const updateChecklist = (index: number, field: keyof ChecklistItem, value: string) => {
    const updated = [...checklists];
    updated[index][field] = value;
    setChecklists(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const validChecklists = checklists.filter(c => c.title.trim()).map(c => ({
        title: c.title.trim(),
        description: c.description.trim() || undefined,
      }));

      const data = {
        ...form,
        checklists: validChecklists,
      };

      await api.post('/preventive-maintenance', data);
      addToast('PM schedule created successfully', 'success');
      navigate('/preventive-maintenance/list');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to create PM schedule', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/preventive-maintenance/list')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">Create PM Schedule</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>PM Details</CardTitle>
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
              placeholder="PM schedule title"
            />

            <Select
              label="Frequency"
              options={frequencyOptions}
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value })}
            />
          </CardBody>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>List Pekerjaan (Checklist)</CardTitle>
              <Button type="button" size="sm" variant="secondary" onClick={addChecklist}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {errors.checklists && <p className="text-sm text-red-600">{errors.checklists}</p>}
            {checklists.map((item, index) => (
              <div key={index} className="flex items-start gap-2 bg-slate-50 rounded-lg p-3">
                <span className="text-sm font-medium text-slate-500 mt-2">{index + 1}.</span>
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateChecklist(index, 'title', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                    placeholder="Nama pekerjaan..."
                  />
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateChecklist(index, 'description', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                    placeholder="Deskripsi (opsional)..."
                  />
                </div>
                {checklists.length > 1 && (
                  <button type="button" onClick={() => removeChecklist(index)} className="mt-1 text-slate-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </CardBody>
        </Card>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" type="button" onClick={() => navigate('/preventive-maintenance/list')}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create PM Schedule
          </Button>
        </div>
      </form>
    </div>
  );
}
