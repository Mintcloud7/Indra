import React, { useState, useEffect, useRef } from 'react';
import { Settings, Save, Building2, Mail, Bell, Wrench, AlertTriangle, Upload, Image, BarChart3 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { api } from '../../api/client';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card, { CardHeader, CardBody, CardTitle } from '../../components/ui/Card';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';
import { useNotification } from '../../context/NotificationContext';

interface SettingsData {
  companyName: string;
  logoUrl: string;
  maintenanceEmail: string;
  autoAssignWorkOrders: boolean;
  pmNotificationDays: string;
  lowStockThreshold: string;
  downtime_good_threshold: string;
  downtime_warning_threshold: string;
  mtbf_good_threshold: string;
  mtbf_warning_threshold: string;
}

const defaults: SettingsData = {
  companyName: '',
  logoUrl: '',
  maintenanceEmail: '',
  autoAssignWorkOrders: false,
  pmNotificationDays: '7',
  lowStockThreshold: '5',
  downtime_good_threshold: '4',
  downtime_warning_threshold: '8',
  mtbf_good_threshold: '720',
  mtbf_warning_threshold: '168',
};

export default function SettingsPage() {
  const { addToast } = useNotification();
  const { hasPermission } = useAuth();
  const { refresh: refreshSettings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [settings, setSettings] = useState<SettingsData>(defaults);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<SettingsData>('/settings')
      .then(setSettings)
      .catch((err) => setLoadError(err.message || 'Gagal memuat settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings', settings);
      await refreshSettings();
      addToast('Settings berhasil disimpan', 'success');
    } catch (err) {
      addToast('Gagal menyimpan settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await api.uploadFile<{ logoUrl: string }>('/settings/logo', file, 'logo');
      setSettings({ ...settings, logoUrl: data.logoUrl });
      await refreshSettings();
      addToast('Logo berhasil diupload', 'success');
    } catch {
      addToast('Gagal upload logo', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    setSettings({ ...settings, logoUrl: '' });
    await api.put('/settings', { logoUrl: '' });
    await refreshSettings();
    addToast('Logo dihapus', 'success');
  };

  if (loading) return <Loading text="Loading settings..." />;
  if (loadError) return <ErrorState message={loadError} />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Konfigurasi sistem INDRA</p>
      </div>

      {/* Company Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            <CardTitle>Informasi Perusahaan</CardTitle>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="shrink-0">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="h-20 w-20 object-contain rounded-xl border border-slate-200" />
              ) : (
                <div className="h-20 w-20 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                  <Image className="h-8 w-8 text-slate-400" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-700 mb-2">Logo Perusahaan</p>
              <p className="text-xs text-slate-500 mb-3">Format: PNG, JPG, SVG, WebP. Maks 2MB.</p>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.svg,.webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Uploading...' : 'Upload Logo'}
                </Button>
                {settings.logoUrl && (
                  <Button variant="ghost" onClick={handleRemoveLogo}>
                    Hapus
                  </Button>
                )}
              </div>
            </div>
          </div>
          <Input
            label="Nama Perusahaan"
            value={settings.companyName}
            onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
            placeholder="INDRA"
          />
        </CardBody>
      </Card>

      {/* Work Order Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-orange-600" />
            <CardTitle>Work Order</CardTitle>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="autoAssign"
              checked={settings.autoAssignWorkOrders}
              onChange={(e) => setSettings({ ...settings, autoAssignWorkOrders: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <label htmlFor="autoAssign" className="text-sm font-medium text-slate-700">
                Auto-assign Work Orders
              </label>
              <p className="text-xs text-slate-500">Otomatis menugaskan WO ke teknisi yang tersedia</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-purple-600" />
            <CardTitle>Notifikasi</CardTitle>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <Input
            label="PM Notification Days Before"
            type="number"
            value={settings.pmNotificationDays}
            onChange={(e) => setSettings({ ...settings, pmNotificationDays: e.target.value })}
            helperText="Berapa hari sebelum jatuh tempo PM dikirim notifikasi"
          />
        </CardBody>
      </Card>

      {/* Inventory Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <CardTitle>Inventory</CardTitle>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <Input
            label="Low Stock Threshold"
            type="number"
            value={settings.lowStockThreshold}
            onChange={(e) => setSettings({ ...settings, lowStockThreshold: e.target.value })}
            helperText="Batas minimum stok sebelum peringatan"
          />
        </CardBody>
      </Card>

      {/* Downtime Threshold Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            <CardTitle>Color Coding Threshold (Downtime & MTBF)</CardTitle>
          </div>
        </CardHeader>
        <CardBody className="space-y-6">
          <p className="text-xs text-slate-500">
            Atur batas warna untuk laporan Downtime dan MTBF sesuai peraturan perusahaan.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Downtime */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">Downtime (Mean Time To Repair)</p>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500 shrink-0"></span>
                <span className="text-xs text-slate-600 w-14">Hijau ≤</span>
                <Input
                  type="number"
                  value={settings.downtime_good_threshold}
                  onChange={(e) => setSettings({ ...settings, downtime_good_threshold: e.target.value })}
                  className="flex-1"
                />
                <span className="text-xs text-slate-500">jam</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-500 shrink-0"></span>
                <span className="text-xs text-slate-600 w-14">Kuning ≤</span>
                <Input
                  type="number"
                  value={settings.downtime_warning_threshold}
                  onChange={(e) => setSettings({ ...settings, downtime_warning_threshold: e.target.value })}
                  className="flex-1"
                />
                <span className="text-xs text-slate-500">jam</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 shrink-0"></span>
                <span className="text-xs text-slate-600 w-14">Merah &gt;</span>
                <span className="text-xs text-slate-500">otomatis ({'>'} kuning)</span>
              </div>
            </div>
            {/* MTBF */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">MTBF (Mean Time Between Failures)</p>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500 shrink-0"></span>
                <span className="text-xs text-slate-600 w-14">Hijau ≥</span>
                <Input
                  type="number"
                  value={settings.mtbf_good_threshold}
                  onChange={(e) => setSettings({ ...settings, mtbf_good_threshold: e.target.value })}
                  className="flex-1"
                />
                <span className="text-xs text-slate-500">jam</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-500 shrink-0"></span>
                <span className="text-xs text-slate-600 w-14">Kuning ≥</span>
                <Input
                  type="number"
                  value={settings.mtbf_warning_threshold}
                  onChange={(e) => setSettings({ ...settings, mtbf_warning_threshold: e.target.value })}
                  className="flex-1"
                />
                <span className="text-xs text-slate-500">jam</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 shrink-0"></span>
                <span className="text-xs text-slate-600 w-14">Merah &lt;</span>
                <span className="text-xs text-slate-500">otomatis ('{'<'} kuning)</span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        {hasPermission('settings.update') && (
          <Button onClick={handleSave} loading={saving}>
            <Save className="h-4 w-4" />
            Simpan Settings
          </Button>
        )}
      </div>
    </div>
  );
}
