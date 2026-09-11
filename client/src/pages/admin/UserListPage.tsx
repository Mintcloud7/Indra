import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, UserCheck, UserX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { User, Role, PaginatedResponse } from '../../api/types';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import Pagination from '../../components/ui/Pagination';
import Loading from '../../components/ui/Loading';
import ErrorState from '../../components/ui/ErrorState';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { useNotification } from '../../context/NotificationContext';

interface UserForm {
  name: string;
  username: string;
  password: string;
  isActive: boolean;
  roleIds: string[];
}

const emptyForm: UserForm = {
  name: '',
  username: '',
  password: '',
  isActive: true,
  roleIds: [],
};

export default function UserListPage() {
  const { hasPermission } = useAuth();
  const { addToast } = useNotification();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (search) params.append('search', search);
      const res = await api.get<PaginatedResponse<User>>(`/users?${params.toString()}`);
      setUsers(res.data);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await api.get<Role[]>('/roles');
      setRoles(res);
    } catch {}
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    const userRoleIds = (user.roles || []).map((r: any) => typeof r === 'string' ? '' : r.id).filter(Boolean);
    setForm({
      name: user.name,
      username: (user as any).username || '',
      password: '',
      isActive: user.isActive,
      roleIds: userRoleIds,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      addToast('Nama wajib diisi', 'error');
      return;
    }
    if (!editingUser && !form.username.trim()) {
      addToast('Username wajib diisi', 'error');
      return;
    }
    if (!editingUser && !form.password) {
      addToast('Password wajib diisi untuk user baru', 'error');
      return;
    }
    if (form.password && form.password.length < 8) {
      addToast('Password minimal 8 karakter', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const payload: any = {
          name: form.name,
          username: form.username,
          isActive: form.isActive,
          roleIds: form.roleIds,
        };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editingUser.id}`, payload);
        addToast('User berhasil diupdate', 'success');
      } else {
        await api.post('/users', {
          name: form.name,
          username: form.username,
          password: form.password,
          isActive: form.isActive,
          roleIds: form.roleIds,
        });
        addToast('User berhasil dibuat', 'success');
      }
      setShowForm(false);
      fetchUsers();
    } catch (err: any) {
      addToast(err.message || 'Gagal menyimpan user', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${showDeleteConfirm.id}`);
      addToast('User berhasil dihapus', 'success');
      setShowDeleteConfirm(null);
      fetchUsers();
    } catch (err: any) {
      addToast(err.message || 'Gagal menghapus user', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const toggleRole = (roleId: string) => {
    setForm(prev => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter(id => id !== roleId)
        : [...prev.roleIds, roleId],
    }));
  };

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola akun pengguna sistem</p>
        </div>
        {hasPermission('users.create') && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Tambah User
          </Button>
        )}
      </div>

      <div className="flex gap-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Cari nama..."
          className="sm:w-64"
        />
      </div>

      {loading ? (
        <Loading text="Loading users..." />
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Username</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    {hasPermission('users.update') && (
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => {
                    const roleNames = (user.roles || []).map((r: any) => typeof r === 'string' ? r : r.name);
                    return (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">{user.name}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{(user as any).username}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {roleNames.map((name: string, idx: number) => (
                              <Badge key={idx} variant={name.toLowerCase()}>{name}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={user.isActive ? 'ACTIVE' : 'INACTIVE'}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        {hasPermission('users.update') && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEdit(user)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              {hasPermission('users.delete') && (
                                <button
                                  onClick={() => setShowDeleteConfirm(user)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Hapus"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">Tidak ada user ditemukan</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingUser ? 'Edit User' : 'Tambah User Baru'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Nama Lengkap"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Masukkan nama"
          />
          <Input
            label="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="Username untuk login"
          />
          <Input
            label={editingUser ? 'Password (kosongkan jika tidak diubah)' : 'Password'}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={editingUser ? 'Minimal 8 karakter' : 'Minimal 8 karakter'}
          />
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-slate-700">Active</label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Roles</label>
            <div className="grid grid-cols-2 gap-2">
              {roles.map((role: any) => (
                <label
                  key={role.id}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    form.roleIds.includes(role.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.roleIds.includes(role.id)}
                    onChange={() => toggleRole(role.id)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{role.name}</div>
                    {role.description && (
                      <div className="text-xs text-slate-500">{role.description}</div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Batal</Button>
            <Button onClick={handleSave} loading={saving}>
              {editingUser ? 'Simpan Perubahan' : 'Buat User'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="Hapus User"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Apakah Anda yakin ingin menghapus user <strong>{showDeleteConfirm?.name}</strong>?
            Tindakan ini tidak dapat dibatalkan.
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
