import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Shield, ChevronRight, ChevronDown, Check, Eye, Edit, Trash, Plus as PlusIcon, Users, Settings, BarChart3, Wrench, Package, FileText, Bell, Database, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { Role } from '../../api/types';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { useNotification } from '../../context/NotificationContext';

interface Permission {
  id: string;
  name: string;
  module: string;
  action: string;
  description: string;
}

interface RoleForm {
  name: string;
  description: string;
  permissionIds: string[];
}

const emptyForm: RoleForm = {
  name: '',
  description: '',
  permissionIds: [],
};

const moduleConfig: Record<string, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  dashboard: { label: 'Dashboard', icon: <BarChart3 className="h-4 w-4" />, color: 'blue', description: 'Akses dashboard utama' },
  work_orders: { label: 'Work Order', icon: <Wrench className="h-4 w-4" />, color: 'orange', description: 'Kelola perintah kerja' },
  preventive_maintenance: { label: 'Preventive Maintenance', icon: <Settings className="h-4 w-4" />, color: 'green', description: 'Jadwal perawatan preventif' },
  assets: { label: 'Aset / Mesin', icon: <Database className="h-4 w-4" />, color: 'purple', description: 'Kelola data mesin dan aset' },
  inventory: { label: 'Inventaris', icon: <Package className="h-4 w-4" />, color: 'teal', description: 'Spare part dan pengadaan' },
  reports: { label: 'Laporan', icon: <FileText className="h-4 w-4" />, color: 'indigo', description: 'Laporan dan analitik' },
  users: { label: 'Pengguna', icon: <Users className="h-4 w-4" />, color: 'pink', description: 'Kelola akun pengguna' },
  roles: { label: 'Role & Akses', icon: <Lock className="h-4 w-4" />, color: 'red', description: 'Kelola role dan hak akses' },
  settings: { label: 'Pengaturan', icon: <Settings className="h-4 w-4" />, color: 'slate', description: 'Konfigurasi sistem' },
  integrations: { label: 'Integrasi', icon: <Bell className="h-4 w-4" />, color: 'yellow', description: 'Integrasi eksternal' },
  audit_logs: { label: 'Audit Log', icon: <FileText className="h-4 w-4" />, color: 'gray', description: 'Riwayat aktivitas' },
  log_books: { label: 'Log Book', icon: <FileText className="h-4 w-4" />, color: 'cyan', description: 'Catatan kegiatan' },
};

const actionConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  create: { label: 'Buat', icon: <PlusIcon className="h-3 w-3" />, color: 'green' },
  read: { label: 'Lihat', icon: <Eye className="h-3 w-3" />, color: 'blue' },
  update: { label: 'Edit', icon: <Edit className="h-3 w-3" />, color: 'yellow' },
  delete: { label: 'Hapus', icon: <Trash className="h-3 w-3" />, color: 'red' },
  assign: { label: 'Tugaskan', icon: <Users className="h-3 w-3" />, color: 'purple' },
  close: { label: 'Tutup', icon: <Lock className="h-3 w-3" />, color: 'gray' },
  approve: { label: 'Setujui', icon: <Check className="h-3 w-3" />, color: 'green' },
};

export default function RoleListPage() {
  const { hasPermission } = useAuth();
  const { addToast } = useNotification();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form, setForm] = useState<RoleForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [roleDetails, setRoleDetails] = useState<Record<string, any>>({});
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Role[]>('/roles');
      setRoles(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await api.get<Permission[]>('/roles/permissions');
      setPermissions(res);
    } catch {}
  }, []);

  useEffect(() => { fetchRoles(); fetchPermissions(); }, [fetchRoles, fetchPermissions]);

  const fetchRoleDetail = async (roleId: string) => {
    if (roleDetails[roleId]) return;
    try {
      const detail = await api.get<any>(`/roles/${roleId}`);
      setRoleDetails(prev => ({ ...prev, [roleId]: detail }));
    } catch {}
  };

  const toggleExpand = async (roleId: string) => {
    if (expandedRole === roleId) {
      setExpandedRole(null);
    } else {
      setExpandedRole(roleId);
      await fetchRoleDetail(roleId);
    }
  };

  const openCreate = () => {
    setEditingRole(null);
    setForm(emptyForm);
    setShowForm(true);
    setExpandedModules({});
  };

  const openEdit = async (role: Role) => {
    setEditingRole(role);
    try {
      const detail = await api.get<any>(`/roles/${role.id}`);
      setForm({
        name: detail.name,
        description: detail.description || '',
        permissionIds: (detail.permissions || []).map((p: any) => p.id),
      });
    } catch {
      setForm({ name: role.name, description: (role as any).description || '', permissionIds: [] });
    }
    setShowForm(true);
    setExpandedModules({});
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      addToast('Nama role wajib diisi', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingRole) {
        await api.put(`/roles/${editingRole.id}`, form);
        addToast('Role berhasil diupdate', 'success');
      } else {
        await api.post('/roles', form);
        addToast('Role berhasil dibuat', 'success');
      }
      setShowForm(false);
      fetchRoles();
    } catch (err: any) {
      addToast(err.message || 'Gagal menyimpan role', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    setDeleting(true);
    try {
      await api.delete(`/roles/${showDeleteConfirm.id}`);
      addToast('Role berhasil dihapus', 'success');
      setShowDeleteConfirm(null);
      fetchRoles();
    } catch (err: any) {
      addToast(err.message || 'Gagal menghapus role', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const togglePermission = (permId: string) => {
    setForm(prev => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(permId)
        ? prev.permissionIds.filter(id => id !== permId)
        : [...prev.permissionIds, permId],
    }));
  };

  const selectModulePermissions = (module: string) => {
    const modulePerms = permissions.filter(p => p.module === module).map(p => p.id);
    setForm(prev => {
      const allSelected = modulePerms.every(id => prev.permissionIds.includes(id));
      return {
        ...prev,
        permissionIds: allSelected
          ? prev.permissionIds.filter(id => !modulePerms.includes(id))
          : [...new Set([...prev.permissionIds, ...modulePerms])],
      };
    });
  };

  const toggleModuleExpand = (module: string) => {
    setExpandedModules(prev => ({ ...prev, [module]: !prev[module] }));
  };

  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Role & Hak Akses</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola role dan batasan akses setiap pengguna</p>
        </div>
        {hasPermission('roles.create') && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Tambah Role
          </Button>
        )}
      </div>

      {loading ? (
        <Loading text="Loading roles..." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role: any) => {
            const isExpanded = expandedRole === role.id;
            return (
              <div key={role.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-50">
                        <Shield className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <Badge variant={role.name.toLowerCase()} size="md">{role.name}</Badge>
                        {role.description && (
                          <p className="text-sm text-slate-500 mt-1">{role.description}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <span className="text-xs text-slate-400">{role.permissionCount || 0} hak akses</span>
                    <button
                      onClick={() => toggleExpand(role.id)}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      {isExpanded ? 'Tutup' : 'Lihat Detail'}
                      <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
                    <p className="text-xs font-medium text-slate-500 mb-2">Hak Akses:</p>
                    <div className="space-y-2">
                      {(Object.entries(
                        (roleDetails[role.id]?.permissions || []).reduce((acc: Record<string, any[]>, p: any) => {
                          if (!acc[p.module]) acc[p.module] = [];
                          acc[p.module].push(p);
                          return acc;
                        }, {} as Record<string, any[]>)
                      ) as [string, any[]][]).map(([module, perms]) => (
                        <div key={module} className="flex items-start gap-2">
                          <span className="text-xs font-semibold text-slate-700 uppercase min-w-[100px]">
                            {moduleConfig[module]?.label || module}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {perms.map((p: any) => (
                              <span key={p.id} className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-600">
                                {actionConfig[p.action]?.label || p.action}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                      {!roleDetails[role.id] && (
                        <span className="text-xs text-slate-400">Loading...</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-200 px-5 py-3 flex justify-end gap-2">
                  {hasPermission('roles.update') && (
                    <button
                      onClick={() => openEdit(role)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {hasPermission('roles.delete') && (
                    <button
                      onClick={() => setShowDeleteConfirm(role)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {roles.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-400">Tidak ada role ditemukan</div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingRole ? 'Edit Role' : 'Tambah Role Baru'}
        size="xl"
      >
        <div className="space-y-4">
          <Input
            label="Nama Role"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="contoh: SUPERVISOR"
          />
          <Input
            label="Deskripsi"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Deskripsi singkat role ini"
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Hak Akses (Permissions)</label>
            <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-200">
              {Object.entries(groupedPermissions).map(([module, perms]) => {
                const allSelected = perms.every(p => form.permissionIds.includes(p.id));
                const someSelected = perms.some(p => form.permissionIds.includes(p.id));
                const config = moduleConfig[module] || { label: module, icon: <Settings className="h-4 w-4" />, color: 'slate', description: '' };
                const isModExpanded = expandedModules[module];

                return (
                  <div key={module} className="p-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                          onChange={() => selectModulePermissions(module)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className={`p-1 rounded bg-${config.color}-50 text-${config.color}-600`}>
                          {config.icon}
                        </span>
                        <div>
                          <span className="text-sm font-semibold text-slate-900">{config.label}</span>
                          <span className="text-xs text-slate-400 ml-2">{config.description}</span>
                        </div>
                      </label>
                      <button
                        type="button"
                        onClick={() => toggleModuleExpand(module)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${isModExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {isModExpanded && (
                      <div className="mt-2 ml-8 grid grid-cols-2 gap-1">
                        {perms.map(perm => {
                          const actConf = actionConfig[perm.action] || { label: perm.action, icon: null, color: 'slate' };
                          return (
                            <label key={perm.id} className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-slate-100">
                              <input
                                type="checkbox"
                                checked={form.permissionIds.includes(perm.id)}
                                onChange={() => togglePermission(perm.id)}
                                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className={`text-xs text-${actConf.color}-600`}>{actConf.icon}</span>
                              <span className="text-xs text-slate-700">{actConf.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 mt-1">{form.permissionIds.length} hak akses dipilih</p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Batal</Button>
            <Button onClick={handleSave} loading={saving}>
              {editingRole ? 'Simpan Perubahan' : 'Buat Role'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="Hapus Role"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Apakah Anda yakin ingin menghapus role <strong>{showDeleteConfirm?.name}</strong>?
            Role yang sedang digunakan oleh user tidak dapat dihapus.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>Batal</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              <Trash2 className="h-4 w-4" />
              Hapus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
