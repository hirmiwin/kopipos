import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api, errorMessage, fieldErrors } from '../lib/api';
import { queryKeys, useCategories } from '../lib/queries';
import { money, number } from '../lib/format';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Pagination } from '../components/Pagination';
import { CheckField, SelectField, TextAreaField, TextField } from '../components/Field';
import type { Category, Paginated, Product } from '../types';

interface ProductForm {
  name: string;
  sku: string;
  barcode: string;
  category_id: string;
  description: string;
  price: string;
  cost: string;
  low_stock_threshold: string;
  is_active: boolean;
  image: File | null;
}

const emptyProductForm: ProductForm = {
  name: '',
  sku: '',
  barcode: '',
  category_id: '',
  description: '',
  price: '',
  cost: '0',
  low_stock_threshold: '5',
  is_active: true,
  image: null,
};

interface CategoryForm {
  id: number | null;
  name: string;
}

type DeleteTarget = { kind: 'product' | 'category'; id: number; name: string } | null;

export function ProductsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [productModal, setProductModal] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [categoryModal, setCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>({ id: null, name: '' });
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleteError, setDeleteError] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const { data: categories } = useCategories();
  const productsQuery = useQuery({
    queryKey: [...queryKeys.products, { search, categoryFilter, lowOnly, page }],
    queryFn: async () =>
      (await api.get<Paginated<Product>>('/products', {
        params: {
          search: search || undefined,
          category_id: categoryFilter || undefined,
          low_stock: lowOnly || undefined,
          page,
          per_page: 10,
        },
      })).data,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.products }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      queryClient.invalidateQueries({ queryKey: queryKeys.stock }),
      queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
    ]);
  };

  const openProduct = (product: Product | null) => {
    setErrors({});
    setProductForm(
      product
        ? {
            name: product.name,
            sku: product.sku,
            barcode: product.barcode ?? '',
            category_id: product.category_id ? String(product.category_id) : '',
            description: product.description ?? '',
            price: String(product.price),
            cost: String(product.cost),
            low_stock_threshold: String(product.low_stock_threshold),
            is_active: product.is_active,
            image: null,
          }
        : emptyProductForm,
    );
    setProductModal({ open: true, product });
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrors({});
    const body = new FormData();
    body.append('name', productForm.name);
    body.append('sku', productForm.sku);
    body.append('barcode', productForm.barcode);
    body.append('category_id', productForm.category_id);
    body.append('description', productForm.description);
    body.append('price', productForm.price);
    body.append('cost', productForm.cost);
    body.append('low_stock_threshold', productForm.low_stock_threshold);
    body.append('is_active', productForm.is_active ? '1' : '0');
    if (productForm.image) body.append('image', productForm.image);

    try {
      if (productModal.product) {
        body.append('_method', 'PUT');
        await api.post(`/products/${productModal.product.id}`, body);
        toast.success('Produk diperbarui.');
      } else {
        await api.post('/products', body);
        toast.success('Produk ditambahkan.');
      }
      setProductModal({ open: false, product: null });
      await refresh();
    } catch (caught) {
      setErrors(fieldErrors(caught));
      toast.error(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const openCategory = (category: Category | null) => {
    setErrors({});
    setCategoryForm({ id: category?.id ?? null, name: category?.name ?? '' });
    setCategoryModal(true);
  };

  const saveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrors({});
    try {
      if (categoryForm.id) {
        await api.put(`/categories/${categoryForm.id}`, { name: categoryForm.name });
        toast.success('Kategori diperbarui.');
      } else {
        await api.post('/categories', { name: categoryForm.name });
        toast.success('Kategori ditambahkan.');
      }
      setCategoryModal(false);
      await refresh();
    } catch (caught) {
      setErrors(fieldErrors(caught));
      toast.error(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const closeProductModal = () => {
    if (saving) return;
    setErrors({});
    setProductModal({ open: false, product: null });
  };

  const closeCategoryModal = () => {
    if (saving) return;
    setErrors({});
    setCategoryModal(false);
  };

  const closeDelete = () => {
    if (saving) return;
    setDeleteError('');
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || saving) return;
    const { kind, id, name } = deleteTarget;
    const wasLastRowOnPage = kind === 'product' && (productsQuery.data?.data.length ?? 0) === 1;

    setSaving(true);
    setDeleteError('');
    try {
      await api.delete(`/${kind === 'product' ? 'products' : 'categories'}/${id}`);
      toast.success(`${name} dihapus.`);
      setDeleteTarget(null);
      if (wasLastRowOnPage && page > 1) setPage(page - 1);
      await refresh();
    } catch (caught) {
      const message = errorMessage(caught);
      setDeleteError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const productColumns: Column<Product>[] = [
    {
      header: 'Produk',
      cell: (product) => (
        <div className="cell-with-media">
          <span className="cell-thumb">
            {product.image_url ? <img src={product.image_url} alt="" /> : <span>{product.name.charAt(0)}</span>}
          </span>
          <span>
            <strong>{product.name}</strong>
            <small>{product.sku}</small>
          </span>
        </div>
      ),
    },
    { header: 'Kategori', cell: (product) => product.category?.name ?? '—' },
    { header: 'Harga', cell: (product) => money(product.price), className: 'text-right' },
    {
      header: 'Stok',
      cell: (product) => (
        <span className={`badge ${product.stock <= product.low_stock_threshold ? 'badge--danger' : 'badge--success'}`}>
          {number(product.stock)} pcs
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (product) => (
        <span className={`badge ${product.is_active ? 'badge--soft' : 'badge--muted'}`}>
          {product.is_active ? 'Aktif' : 'Nonaktif'}
        </span>
      ),
    },
    {
      header: 'Aksi',
      cell: (product) =>
        isAdmin ? (
          <div className="row-actions">
            <button type="button" className="icon-button" onClick={() => openProduct(product)} aria-label={`Ubah ${product.name}`}>
              <Pencil size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-button icon-button--danger"
              onClick={() => {
                setDeleteError('');
                setDeleteTarget({ kind: 'product', id: product.id, name: product.name });
              }}
              aria-label={`Hapus ${product.name}`}
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <span className="muted">—</span>
        ),
    },
  ];

  const categoryColumns: Column<Category>[] = [
    { header: 'Nama Kategori', cell: (category) => <strong>{category.name}</strong> },
    { header: 'Slug', cell: (category) => <code>{category.slug}</code> },
    { header: 'Produk', cell: (category) => `${category.products_count ?? 0} produk` },
    {
      header: 'Aksi',
      cell: (category) =>
        isAdmin ? (
          <div className="row-actions">
            <button type="button" className="icon-button" onClick={() => openCategory(category)} aria-label={`Ubah kategori ${category.name}`}>
              <Pencil size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-button icon-button--danger"
              onClick={() => {
                setDeleteError('');
                setDeleteTarget({ kind: 'category', id: category.id, name: category.name });
              }}
              aria-label={`Hapus kategori ${category.name}`}
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <span className="muted">—</span>
        ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Katalog"
        title="Produk & Kategori"
        description="Kelola daftar jual, harga, dan kategori produk."
        actions={
          isAdmin && (
            <button type="button" className="button button--primary" onClick={() => openProduct(null)}>
              <Plus size={16} aria-hidden="true" /> Tambah Produk
            </button>
          )
        }
      />

      <section className="panel">
        <div className="filter-bar">
          <div className="search-box search-box--inline">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Cari nama atau SKU…"
              aria-label="Cari produk"
            />
          </div>
          <select
            className="input select select--filter"
            value={categoryFilter}
            onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }}
            aria-label="Filter kategori"
          >
            <option value="">Semua kategori</option>
            {(categories ?? []).map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <label className="switch-filter">
            <input
              type="checkbox"
              checked={lowOnly}
              onChange={(event) => { setLowOnly(event.target.checked); setPage(1); }}
            />
            Stok menipis
          </label>
        </div>

        {productsQuery.isLoading ? (
          <div className="loading-card">Memuat produk…</div>
        ) : productsQuery.isError ? (
          <div className="alert alert--error">Gagal memuat produk.</div>
        ) : (
          <>
            <DataTable
              columns={productColumns}
              rows={productsQuery.data?.data ?? []}
              rowKey={(product) => product.id}
              label="Daftar produk"
              empty="Belum ada produk."
            />
            <Pagination
              page={productsQuery.data?.meta.current_page ?? 1}
              lastPage={productsQuery.data?.meta.last_page ?? 1}
              onPage={setPage}
            />
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>Kategori</h3>
            <p>Atur pengelompokan produk.</p>
          </div>
          {isAdmin && (
            <button type="button" className="button button--secondary button--small" onClick={() => openCategory(null)}>
              <Plus size={14} aria-hidden="true" /> Kategori
            </button>
          )}
        </div>
        <DataTable
          columns={categoryColumns}
          rows={categories ?? []}
          rowKey={(category) => category.id}
          label="Daftar kategori"
          empty="Belum ada kategori."
          compact
        />
      </section>

      <Modal
        open={productModal.open}
        onClose={closeProductModal}
        title={productModal.product ? 'Ubah Produk' : 'Tambah Produk'}
        description="Stok awal diubah melalui menu Manajemen Stok."
        size="lg"
        dismissible={!saving}
        footer={
          <>
            <button type="button" className="button button--ghost" onClick={closeProductModal} disabled={saving}>Batal</button>
            <button type="submit" form="product-form" className="button button--primary" disabled={saving}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </>
        }
      >
        <form id="product-form" className="form-grid" onSubmit={(event) => void saveProduct(event)} noValidate>
          <TextField
            label="Nama produk"
            required
            autoFocus
            value={productForm.name}
            error={errors.name?.[0]}
            onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
          />
          <TextField
            label="SKU"
            hint="Kosongkan untuk membuat otomatis"
            value={productForm.sku}
            error={errors.sku?.[0]}
            onChange={(event) => setProductForm({ ...productForm, sku: event.target.value })}
          />
          <TextField
            label="Barcode"
            value={productForm.barcode}
            error={errors.barcode?.[0]}
            onChange={(event) => setProductForm({ ...productForm, barcode: event.target.value })}
          />
          <SelectField
            label="Kategori"
            value={productForm.category_id}
            onChange={(event) => setProductForm({ ...productForm, category_id: event.target.value })}
          >
            <option value="">Tanpa kategori</option>
            {(categories ?? []).map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </SelectField>
          <TextField
            label="Harga jual"
            type="number"
            min="0"
            required
            prefix="Rp"
            value={productForm.price}
            error={errors.price?.[0]}
            onChange={(event) => setProductForm({ ...productForm, price: event.target.value })}
          />
          <TextField
            label="Harga modal"
            type="number"
            min="0"
            prefix="Rp"
            value={productForm.cost}
            error={errors.cost?.[0]}
            onChange={(event) => setProductForm({ ...productForm, cost: event.target.value })}
          />
          <TextField
            label="Ambang stok minimum"
            type="number"
            min="0"
            value={productForm.low_stock_threshold}
            error={errors.low_stock_threshold?.[0]}
            onChange={(event) => setProductForm({ ...productForm, low_stock_threshold: event.target.value })}
          />
          <div className="field">
            <label className="field__label" htmlFor="product-image">Foto produk</label>
            <input
              id="product-image"
              className="input file-input"
              type="file"
              accept="image/*"
              onChange={(event) => setProductForm({ ...productForm, image: event.target.files?.[0] ?? null })}
            />
            {errors.image?.[0] && <p className="field__error">{errors.image[0]}</p>}
          </div>
          <div className="form-grid__full">
            <TextAreaField
              label="Deskripsi"
              rows={3}
              value={productForm.description}
              onChange={(event) => setProductForm({ ...productForm, description: event.target.value })}
            />
          </div>
          <div className="form-grid__full">
            <CheckField
              label="Produk aktif"
              hint="Nonaktifkan jika produk tidak dijual sementara."
              checked={productForm.is_active}
              onChange={(active) => setProductForm({ ...productForm, is_active: active })}
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={categoryModal}
        onClose={closeCategoryModal}
        title={categoryForm.id ? 'Ubah Kategori' : 'Tambah Kategori'}
        size="sm"
        dismissible={!saving}
        footer={
          <>
            <button type="button" className="button button--ghost" onClick={closeCategoryModal} disabled={saving}>Batal</button>
            <button type="submit" form="category-form" className="button button--primary" disabled={saving}>Simpan</button>
          </>
        }
      >
        <form id="category-form" onSubmit={(event) => void saveCategory(event)} noValidate>
          <TextField
            label="Nama kategori"
            required
            autoFocus
            value={categoryForm.name}
            error={errors.name?.[0]}
            onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.kind === 'category' ? 'Hapus kategori' : 'Hapus produk'}
        message={
          deleteTarget?.kind === 'category'
            ? `Yakin ingin menghapus kategori "${deleteTarget.name}"? Kategori yang masih dipakai produk tidak bisa dihapus.`
            : `Yakin ingin menghapus produk "${deleteTarget?.name ?? ''}"? Produk yang sudah punya riwayat transaksi sebaiknya dinonaktifkan saja.`
        }
        busy={saving}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onClose={closeDelete}
      />
    </div>
  );
}
