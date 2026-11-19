import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, UserCog } from 'lucide-react';
import { api, errorMessage, fieldErrors } from '../lib/api';
import { queryKeys } from '../lib/queries';
import { dateOnly } from '../lib/format';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SelectField, TextField } from '../components/Field';
import type { User } from '../types';

interface UserForm {
  name: string;
  email: string;
  role: 'admin' | 'kasir';
  password: string;
}

const emptyForm: UserForm = { name: '', email: '', role: 'kasir', password: '' };

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);

  const usersQuery = useQuery({
    queryKey: queryKeys.users,
    queryFn: async () => (await api.get<{ data: User[] }>('/users')).data.data,
  });

  const openForm = (user: User | null) => {
    setErrors({});
    setEditing(user);
    setForm(user ? { name: user.name, email: user.email, role: user.role, password: '' } : emptyForm);
    setModalOpen(true);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    const payload = { name: form.name, email: form.email, role: form.role, ...(form.password ? { password: form.password } : {}) };
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, payload);
        toast.success('Pengguna diperbarui.');
      } else {
        await api.post('/users', payload);
        toast.success('Pengguna ditambahkan.');
      }
      setModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.users });
    } catch (caught) {
      setErrors(fieldErrors(caught));
      toast.error(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      toast.success('Pengguna dihapus.');
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.users });
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<User>[] = [
    {
      header: 'Nama',
      cell: (user) => (
        <div className="cell-with-media">
          <span className="cell-thumb cell-thumb--icon"><UserCog size={16} aria-hidden="true" /></span>
          <span><strong>{user.name}</strong><small>{user.email}</small></span>
        </div>
      ),
    },
    {
      header: 'Role',
      cell: (user) => <span className={`badge ${user.role === 'admin' ? 'badge--amber' : 'badge--soft'}`}>{user.role === 'admin' ? 'Admin' : 'Kasir'}</span>,
    },
    { header: 'Bergabung', cell: (user) => dateOnly(user.created_at) },
    {
      header: 'Aksi',
      cell: (user) => (
        <div className="row-actions">
          <button type="button" className="icon-button" onClick={() => openForm(user)} aria-label={`Ubah ${user.name}`}>
            <Pencil size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button icon-button--danger"
            onClick={() => setDeleteTarget(user)}
            disabled={user.id === currentUser?.id}
            aria-label={`Hapus ${user.name}`}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Administrasi"
        title="Pengguna"
        description="Kelola akun kasir dan administrator."
        actions={
          <button type="button" className="button button--primary" onClick={() => openForm(null)}>
            <Plus size={16} aria-hidden="true" /> Tambah Pengguna
          </button>
        }
      />

      <section className="panel">
        {usersQuery.isLoading ? (
          <div className="loading-card">Memuat pengguna…</div>
        ) : (
          <DataTable
            columns={columns}
            rows={usersQuery.data ?? []}
            rowKey={(user) => user.id}
            label="Daftar pengguna"
            empty="Belum ada pengguna."
          />
        )}
      </section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Ubah Pengguna' : 'Tambah Pengguna'}
        size="sm"
        footer={
          <>
            <button type="button" className="button button--ghost" onClick={() => setModalOpen(false)}>Batal</button>
            <button type="submit" form="user-form" className="button button--primary" disabled={saving}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </>
        }
      >
        <form id="user-form" className="form-stack" onSubmit={(event) => void save(event)} noValidate>
          <TextField
            label="Nama"
            required
            value={form.name}
            error={errors.name?.[0]}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <TextField
            label="Email"
            type="email"
            required
            value={form.email}
            error={errors.email?.[0]}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <SelectField
            label="Role"
            value={form.role}
            error={errors.role?.[0]}
            onChange={(event) => setForm({ ...form, role: event.target.value as UserForm['role'] })}
          >
            <option value="kasir">Kasir</option>
            <option value="admin">Admin</option>
          </SelectField>
          <TextField
            label={editing ? 'Password baru' : 'Password'}
            type="password"
            required={!editing}
            minLength={6}
            autoComplete="new-password"
            hint={editing ? 'Kosongkan jika tidak diubah.' : undefined}
            value={form.password}
            error={errors.password?.[0]}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus pengguna"
        message={`Yakin ingin menghapus "${deleteTarget?.name ?? ''}"? Riwayat transaksi kasir ini tetap tersimpan.`}
        busy={saving}
        onConfirm={() => void remove()}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
