import React, { useState } from 'react';
import { Lock, Save, User, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card, { CardHeader, CardBody, CardTitle } from '../../components/ui/Card';
import { useNotification } from '../../context/NotificationContext';

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const { addToast } = useNotification();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleChangePassword = async () => {
    if (!form.currentPassword) {
      addToast('Password saat ini wajib diisi', 'error');
      return;
    }
    if (!form.newPassword) {
      addToast('Password baru wajib diisi', 'error');
      return;
    }
    if (form.newPassword.length < 8) {
      addToast('Password baru minimal 8 karakter', 'error');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      addToast('Konfirmasi password tidak cocok', 'error');
      return;
    }

    setSaving(true);
    try {
      await api.put('/users/me/password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      addToast('Password berhasil diubah', 'success');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      addToast(err.message || 'Gagal mengubah password', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Kelola akun dan ubah password Anda</p>
      </div>

      {/* Profile Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            <CardTitle>Profil Saya</CardTitle>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-orange-600" />
            <CardTitle>Ubah Password</CardTitle>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <Input
            label="Password Saat Ini"
            type="password"
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            placeholder="Masukkan password saat ini"
          />
          <Input
            label="Password Baru"
            type="password"
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            placeholder="Minimal 8 karakter"
          />
          <Input
            label="Konfirmasi Password Baru"
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            placeholder="Ulangi password baru"
          />
          <div className="flex justify-end pt-2">
            <Button onClick={handleChangePassword} loading={saving}>
              <Save className="h-4 w-4" />
              Ubah Password
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
