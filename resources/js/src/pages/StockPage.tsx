import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Boxes, Plus, RefreshCw } from 'lucide-react';
import { api, errorMessage, fieldErrors } from '../lib/api';
import { queryKeys } from '../lib/queries';
import { dateTime, number, todayISO } from '../lib/format';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { SelectField, TextAreaField, TextField } from '../components/Field';
import type { Paginated, Product, StockMovement, StockMovementType } from '../types';

const TYPE_LABEL: Record<StockMovementType, string> = {
  in: 'Stok masuk',
  out: 'Stok keluar',
  adjustment: 'Penyesuaian',
  sale: 'Penjualan',
  void: 'Pembatalan',
};

export function StockPage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [productId, setProductId] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(todayISO());
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<{ product_id: string; type: 'in' | 'out' | 'adjustment'; quantity: string; note: string }>({
    product_id: '',
    type: 'in',
    quantity: '',
    note: '',
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const productsQuery = useQuery({
    queryKey: [...queryKeys.products, 'stock-select'],
    queryFn: async () => (await api.get<Paginated<Product>>('/products', { params: { per_page: 100, is_active: true } })).data,
  });

  const lowQuery = useQuery({
    queryKey: [...queryKeys.stock, 'low'],
    queryFn: async () => (await api.get<{ data: Product[] }>('/stock/low')).data.data,
  });

  const movementsQuery = useQuery({
    queryKey: [...queryKeys.stock, { productId, type, from, to, page }],
    queryFn: async () =>
      (await api.get<Paginated<StockMovement>>('/stock/movements', {
        params: {
          product_id: productId || undefined,
          type: type || undefined,
          from: from || undefined,
          to: to || undefined,
          page,
          per_page: 12,
        },
      })).data,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.stock }),
      queryClient.invalidateQueries({ queryKey: queryKeys.products }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
    ]);
  };

  const openAdjust = () => {
    setErrors({});
    setForm({ product_id: productsQuery.data?.data[0] ? String(productsQuery.data.data[0].id) : '', type: 'in', quantity: '', note: '' });
    setModalOpen(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const response = await api.post<{ message: string }>('/stock/movements', {
        product_id: Number(form.product_id),
        type: form.type,
        quantity: Number(form.quantity),
        note: form.note || null,
      });
      toast.success(response.data.message ?? 'Stok berhasil diperbarui.');
      setModalOpen(false);
      await refresh();
    } catch (caught) {
      setErrors(fieldErrors(caught));
      toast.error(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<StockMovement>[] = [
    {
      header: 'Produk',
      cell: (movement) => (
        <span>
          <strong>{movement.product?.name ?? 'Produk dihapus'}</strong>
          <small className="cell-small">{movement.product?.sku}</small>
        </span>
      ),
    },
    {
      header: 'Jenis',
      cell: (movement) => (
        <span className={`badge ${movement.type === 'in' ? 'badge--success' : movement.type === 'sale' || movement.type === 'out' ? 'badge--danger' : 'badge--soft'}`}>
          {TYPE_LABEL[movement.type]}
        </span>
      ),
    },
    {
      header: 'Perubahan',
      cell: (movement) => (
        <strong className={movement.quantity > 0 ? 'text-positive' : 'text-negative'}>
          {movement.quantity > 0 ? '+' : ''}{number(movement.quantity)}
        </strong>
      ),
      className: 'text-right',
    },
    { header: 'Petugas', cell: (movement) => movement.user?.name ?? '—' },
    { header: 'Catatan', cell: (movement) => movement.note ?? '—' },
    { header: 'Waktu', cell: (movement) => dateTime(movement.created_at) },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Inventaris"
        title="Manajemen Stok"
        description="Catat stok masuk, keluar, dan penyesuaian."
        actions={
          isAdmin && (
            <button type="button" className="button button--primary" onClick={openAdjust}>
              <Plus size={16} aria-hidden="true" /> Sesuaikan Stok
            </button>
          )
        }
      />

      <section className="panel">
        <div className="filter-bar">
          <div className="search-box search-box--inline">
            <Boxes size={17} aria-hidden="true" />
            <select
              className="plain-select"
              value={productId}
              onChange={(event) => { setProductId(event.target.value); setPage(1); }}
              aria-label="Filter produk"
            >
              <option value="">Semua produk</option>
              {(productsQuery.data?.data ?? []).map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
          </div>
          <select
            className="input select select--filter"
            value={type}
            onChange={(event) => { setType(event.target.value); setPage(1); }}
            aria-label="Filter jenis pergerakan"
          >
            <option value="">Semua jenis</option>
            <option value="in">Stok masuk</option>
            <option value="out">Stok keluar</option>
            <option value="adjustment">Penyesuaian</option>
            <option value="sale">Penjualan</option>
            <option value="void">Pembatalan</option>
          </select>
          <TextField label="Dari" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
          <TextField label="Sampai" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => { setProductId(''); setType(''); setFrom(''); setTo(todayISO()); setPage(1); }}
          >
            <RefreshCw size={14} aria-hidden="true" /> Reset
          </button>
        </div>

        {movementsQuery.isLoading ? (
          <div className="loading-card">Memuat riwayat stok…</div>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={movementsQuery.data?.data ?? []}
              rowKey={(movement) => movement.id}
              label="Riwayat pergerakan stok"
              empty="Belum ada pergerakan stok."
            />
            <Pagination
              page={movementsQuery.data?.meta.current_page ?? 1}
              lastPage={movementsQuery.data?.meta.last_page ?? 1}
              onPage={setPage}
            />
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>Produk Stok Menipis</h3>
            <p>Segera lakukan pengisian ulang.</p>
          </div>
          <span className="badge badge--danger">{lowQuery.data?.length ?? 0} produk</span>
        </div>
        <ul className="compact-list compact-list--stack">
          {(lowQuery.data ?? []).map((product) => (
            <li key={product.id}>
              <span className={`compact-list__icon ${product.stock <= 0 ? 'compact-list__icon--danger' : ''}`}>
                {product.stock <= 0 ? <ArrowDownLeft size={16} aria-hidden="true" /> : <ArrowUpRight size={16} aria-hidden="true" />}
              </span>
              <span className="compact-list__body">
                <strong>{product.name}</strong>
                <small>{product.sku} · minimum {product.low_stock_threshold}</small>
              </span>
              <span className="badge badge--danger">{product.stock} pcs</span>
            </li>
          ))}
          {(lowQuery.data?.length ?? 0) === 0 && <div className="empty-state">Semua stok aman.</div>}
        </ul>
      </section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Sesuaikan Stok"
        description="Perubahan akan tercatat pada riwayat pergerakan stok."
        size="sm"
        footer={
          <>
            <button type="button" className="button button--ghost" onClick={() => setModalOpen(false)}>Batal</button>
            <button type="submit" form="stock-form" className="button button--primary" disabled={saving}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </>
        }
      >
        <form id="stock-form" className="form-stack" onSubmit={(event) => void submit(event)} noValidate>
          <SelectField
            label="Produk"
            required
            value={form.product_id}
            error={errors.product_id?.[0]}
            onChange={(event) => setForm({ ...form, product_id: event.target.value })}
          >
            {(productsQuery.data?.data ?? []).map((product) => (
              <option key={product.id} value={product.id}>{product.name} (stok {product.stock})</option>
            ))}
          </SelectField>
          <SelectField
            label="Jenis pergerakan"
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value as typeof form.type })}
          >
            <option value="in">Stok masuk</option>
            <option value="out">Stok keluar</option>
            <option value="adjustment">Penyesuaian</option>
          </SelectField>
          <TextField
            label="Jumlah"
            type="number"
            min="1"
            required
            value={form.quantity}
            error={errors.quantity?.[0]}
            onChange={(event) => setForm({ ...form, quantity: event.target.value })}
          />
          <TextAreaField
            label="Catatan"
            rows={2}
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
          />
        </form>
      </Modal>
    </div>
  );
}
