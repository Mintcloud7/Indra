import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../api/client';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Card, { CardHeader, CardBody, CardTitle } from '../../components/ui/Card';
import { useNotification } from '../../context/NotificationContext';

const typeOptions = [
  { value: 'MACHINE', label: 'Machine' },
  { value: 'VEHICLE', label: 'Vehicle' },
  { value: 'TOOL', label: 'Tool' },
  { value: 'FACILITY', label: 'Facility' },
  { value: 'OTHER', label: 'Other' },
];

const statusOptions = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const criticalityOptions = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

export default function AssetCreatePage() {
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    type: 'MACHINE',
    location: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    installDate: '',
    warrantyExpiry: '',
    criticality: 'MEDIUM',
    status: 'ACTIVE',
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.code.trim()) newErrors.code = 'Code is required';
    if (!form.name.trim()) newErrors.name = 'Name is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await api.post('/assets', form);
      addToast('Asset created successfully', 'success');
      navigate('/assets');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to create asset', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setForm({ ...form, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/assets')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">Add Asset</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Asset Information</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Code *"
                value={form.code}
                onChange={(e) => handleChange('code', e.target.value)}
                error={errors.code}
                placeholder="Asset code"
              />
              <Input
                label="Name *"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                error={errors.name}
                placeholder="Asset name"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={3}
                placeholder="Asset description..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Type"
                options={typeOptions}
                value={form.type}
                onChange={(e) => handleChange('type', e.target.value)}
              />
              <Select
                label="Status"
                options={statusOptions}
                value={form.status}
                onChange={(e) => handleChange('status', e.target.value)}
              />
              <Input
                label="Location"
                value={form.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder="Location"
              />
              <Select
                label="Criticality"
                options={criticalityOptions}
                value={form.criticality}
                onChange={(e) => handleChange('criticality', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Manufacturer"
                value={form.manufacturer}
                onChange={(e) => handleChange('manufacturer', e.target.value)}
                placeholder="Manufacturer"
              />
              <Input
                label="Model"
                value={form.model}
                onChange={(e) => handleChange('model', e.target.value)}
                placeholder="Model"
              />
              <Input
                label="Serial Number"
                value={form.serialNumber}
                onChange={(e) => handleChange('serialNumber', e.target.value)}
                placeholder="Serial number"
              />
              <Input
                label="Install Date"
                type="date"
                value={form.installDate}
                onChange={(e) => handleChange('installDate', e.target.value)}
              />
              <Input
                label="Warranty Expiry"
                type="date"
                value={form.warrantyExpiry}
                onChange={(e) => handleChange('warrantyExpiry', e.target.value)}
              />
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" type="button" onClick={() => navigate('/assets')}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create Asset
          </Button>
        </div>
      </form>
    </div>
  );
}
