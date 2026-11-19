import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  CreditCard,
  Minus,
  PackageSearch,
  Plus,
  QrCode,
  Receipt,
  Search,
  ShoppingCart,
  Trash2,
  Wallet,
} from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { queryKeys, useCategories, useSettings } from '../lib/queries';
import { money } from '../lib/format';
import { useToast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { TextField } from '../components/Field';
import { Receipt as ReceiptModal } from '../components/Receipt';
import type { Paginated, PaymentMethod, Product, ReceiptPayload } from '../types';

interface CartLine {
  product: Product;
  quantity: number;
  discount: number;
}

const METHODS: Array<{ value: PaymentMethod; label: string; icon: typeof Banknote }> = [
  { value: 'cash', label: 'Tunai', icon: Banknote },
  { value: 'card', label: 'Kartu', icon: CreditCard },
  { value: 'qris', label: 'QRIS', icon: QrCode },
  { value: 'transfer', label: 'Transfer', icon: Wallet },
];

export function PosPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const { data: categories } = useCategories();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [headerDiscount, setHeaderDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.products, 'pos'],
    queryFn: async () =>
      (await api.get<Paginated<Product>>('/products', { params: { per_page: 100, is_active: true } })).data,
  });

  const products = data?.data ?? [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = categoryId === null || product.category_id === categoryId;
      const matchesTerm =
        !term ||
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term) ||
        (product.barcode ?? '').toLowerCase().includes(term);
      return matchesCategory && matchesTerm;
    });
  }, [products, search, categoryId]);

  const lineSubtotal = cart.reduce((sum, line) => sum + line.product.price * line.quantity - line.discount, 0);
  const discount = Math.min(Number(headerDiscount) || 0, lineSubtotal);
  const taxRate = settings?.tax_enabled ? Number(settings.tax_rate) || 0 : 0;
  const tax = Math.round((lineSubtotal - discount) * (taxRate / 100));
  const total = Math.max(0, lineSubtotal - discount + tax);
  const paid = Number(amountPaid) || 0;
  const change = Math.max(0, paid - total);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast.error(`${product.name} sedang habis.`);
      return;
    }
    setCart((current) => {
      const found = current.find((line) => line.product.id === product.id);
      if (found) {
        if (found.quantity + 1 > product.stock) {
          toast.error(`Stok ${product.name} hanya ${product.stock}.`);
          return current;
        }
        return current.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, { product, quantity: 1, discount: 0 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((current) =>
      current
        .map((line) =>
          line.product.id === productId
            ? { ...line, quantity: Math.min(line.product.stock, Math.max(0, line.quantity + delta)) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  };

  const removeLine = (productId: number) => {
    setCart((current) => current.filter((line) => line.product.id !== productId));
  };

  const handleBarcode = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const term = search.trim().toLowerCase();
    if (!term) return;
    const exact = products.find(
      (product) =>
        product.sku.toLowerCase() === term ||
        product.barcode?.toLowerCase() === term ||
        product.name.toLowerCase() === term,
    );
    if (exact) {
      addToCart(exact);
      setSearch('');
    } else if (filtered.length === 1) {
      addToCart(filtered[0]);
      setSearch('');
    } else if (filtered.length === 0) {
      toast.error('Produk tidak ditemukan.');
    }
  };

  const resetTransaction = () => {
    setCart([]);
    setCustomerName('');
    setHeaderDiscount('0');
    setPaymentMethod('cash');
    setAmountPaid('');
    setNotes('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (cart.length === 0) {
      toast.error('Keranjang masih kosong.');
      return;
    }
    const finalPaid = paymentMethod === 'cash' ? paid : total;
    if (paymentMethod === 'cash' && finalPaid + 0.001 < total) {
      toast.error('Jumlah bayar kurang dari total belanja.');
      return;
    }

    setBusy(true);
    try {
      const response = await api.post<{
        data: unknown;
        receipt: ReceiptPayload;
        message: string;
      }>('/sales', {
        items: cart.map((line) => ({
          product_id: line.product.id,
          quantity: line.quantity,
          discount: line.discount,
        })),
        discount,
        customer_name: customerName || null,
        payment_method: paymentMethod,
        amount_paid: finalPaid,
        notes: notes || null,
      });
      setAutoPrint(Boolean(settings?.auto_print));
      setReceipt(response.data.receipt);
      toast.success(response.data.message ?? 'Transaksi berhasil.');
      resetTransaction();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: queryKeys.products }),
        queryClient.invalidateQueries({ queryKey: queryKeys.stock }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sales }),
      ]);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const preview = async () => {
    if (cart.length === 0) {
      toast.error('Keranjang masih kosong.');
      return;
    }
    try {
      const response = await api.post<{ data: ReceiptPayload }>('/receipt/preview', {
        items: cart.map((line) => ({ product_id: line.product.id, quantity: line.quantity })),
        discount,
        customer_name: customerName || null,
        payment_method: paymentMethod,
        amount_paid: paid || total,
      });
      setAutoPrint(false);
      setReceipt(response.data.data);
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Transaksi"
        title="Kasir"
        description="Pilih produk, scan barcode, lalu selesaikan pembayaran."
      />

      <div className="pos-layout">
        <section className="panel pos-catalog" aria-labelledby="pos-catalog-title">
          <div className="pos-catalog__toolbar">
            <div className="search-box">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={handleBarcode}
                placeholder="Cari nama, SKU, atau scan barcode…"
                aria-label="Cari produk atau scan barcode"
              />
            </div>
            <div className="chip-row" role="group" aria-label="Filter kategori">
              <button
                type="button"
                className={`chip ${categoryId === null ? 'chip--active' : ''}`}
                onClick={() => setCategoryId(null)}
              >
                Semua
              </button>
              {(categories ?? []).map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`chip ${categoryId === category.id ? 'chip--active' : ''}`}
                  onClick={() => setCategoryId(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          <h3 id="pos-catalog-title" className="visually-hidden">Daftar produk</h3>
          {isLoading ? (
            <div className="loading-card">Memuat produk…</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><PackageSearch size={28} aria-hidden="true" /> Produk tidak ditemukan.</div>
          ) : (
            <div className="product-grid">
              {filtered.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className={`product-card ${product.stock <= 0 ? 'product-card--empty' : ''}`}
                  onClick={() => addToCart(product)}
                  aria-label={`Tambah ${product.name}, ${money(product.price)}`}
                >
                  <span className="product-card__media">
                    {product.image_url ? (
                      <img src={product.image_url} alt="" />
                    ) : (
                      <span className="product-card__initial">{product.name.charAt(0)}</span>
                    )}
                    {product.stock <= product.low_stock_threshold && (
                      <span className="product-card__stock">Stok {product.stock}</span>
                    )}
                  </span>
                  <span className="product-card__body">
                    <small>{product.category?.name ?? 'Produk'}</small>
                    <strong>{product.name}</strong>
                    <span className="product-card__price">{money(product.price)}</span>
                  </span>
                  <span className="product-card__add" aria-hidden="true"><Plus size={16} /></span>
                </button>
              ))}
            </div>
          )}
        </section>

        <form className="pos-cart" onSubmit={(event) => void submit(event)}>
          <section className="panel pos-cart__panel">
            <div className="panel__header">
              <div>
                <h3>Keranjang</h3>
                <p>{itemCount} item dipilih</p>
              </div>
              <ShoppingCart size={18} aria-hidden="true" />
            </div>

            {cart.length === 0 ? (
              <div className="empty-state empty-state--cart">
                <ShoppingCart size={30} aria-hidden="true" />
                <strong>Keranjang kosong</strong>
                <span>Klik produk untuk menambahkannya.</span>
              </div>
            ) : (
              <ul className="cart-list">
                {cart.map((line) => (
                  <li key={line.product.id} className="cart-line">
                    <strong className="cart-line__name">{line.product.name}</strong>
                    <button
                      type="button"
                      className="icon-button icon-button--danger cart-line__remove"
                      onClick={() => removeLine(line.product.id)}
                      aria-label={`Hapus ${line.product.name}`}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                    <small className="cart-line__unit">{money(line.product.price)} / pcs</small>
                    <div className="qty-control" role="group" aria-label={`Jumlah ${line.product.name}`}>
                      <button type="button" onClick={() => updateQuantity(line.product.id, -1)} aria-label="Kurangi jumlah">
                        <Minus size={14} aria-hidden="true" />
                      </button>
                      <span>{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.product.id, 1)}
                        disabled={line.quantity >= line.product.stock}
                        aria-label="Tambah jumlah"
                      >
                        <Plus size={14} aria-hidden="true" />
                      </button>
                    </div>
                    <strong className="cart-line__total">{money(line.product.price * line.quantity - line.discount)}</strong>
                  </li>
                ))}
              </ul>
            )}

            <div className="cart-fields">
              <TextField
                label="Nama pelanggan"
                placeholder="Opsional"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
              />
              <TextField
                label="Diskon (Rp)"
                type="number"
                min="0"
                step="1000"
                value={headerDiscount}
                onChange={(event) => setHeaderDiscount(event.target.value)}
                prefix="Rp"
              />
            </div>

            <fieldset className="method-fieldset">
              <legend>Metode pembayaran</legend>
              <div className="method-grid">
                {METHODS.map((method) => (
                  <label key={method.value} className={`method-option ${paymentMethod === method.value ? 'method-option--active' : ''}`}>
                    <input
                      type="radio"
                      name="payment_method"
                      value={method.value}
                      checked={paymentMethod === method.value}
                      onChange={() => setPaymentMethod(method.value)}
                    />
                    <method.icon size={16} aria-hidden="true" />
                    <span>{method.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {paymentMethod === 'cash' && (
              <div className="pay-field">
                <TextField
                  label="Jumlah bayar"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0"
                  value={amountPaid}
                  onChange={(event) => setAmountPaid(event.target.value)}
                  prefix="Rp"
                />
                <div className="quick-cash" aria-label="Jumlah bayar cepat">
                  <button type="button" onClick={() => setAmountPaid(String(total))}>Pas</button>
                  {[5000, 10000, 20000, 50000].map((nominal) => (
                    <button
                      key={nominal}
                      type="button"
                      onClick={() => setAmountPaid(String(Math.ceil(total / nominal) * nominal))}
                    >
                      {nominal / 1000}rb
                    </button>
                  ))}
                </div>
              </div>
            )}

            <TextField
              label="Catatan"
              placeholder="Opsional"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </section>

          <section className="panel pos-summary" aria-label="Ringkasan pembayaran">
            <dl className="summary-list">
              <div><dt>Subtotal</dt><dd>{money(lineSubtotal)}</dd></div>
              {discount > 0 && <div><dt>Diskon</dt><dd>-{money(discount)}</dd></div>}
              {tax > 0 && <div><dt>Pajak</dt><dd>{money(tax)}</dd></div>}
              <div className="summary-list__total"><dt>Total</dt><dd>{money(total)}</dd></div>
              {paymentMethod === 'cash' && <div><dt>Kembali</dt><dd>{money(change)}</dd></div>}
            </dl>
            <div className="pos-summary__actions">
              <button type="button" className="button button--secondary" onClick={() => void preview()} disabled={cart.length === 0}>
                <Receipt size={16} aria-hidden="true" /> Pratinjau
              </button>
              <button type="submit" className="button button--primary button--large" disabled={busy || cart.length === 0}>
                {busy ? 'Memproses…' : 'Selesaikan Transaksi'}
              </button>
            </div>
          </section>
        </form>
      </div>

      {receipt && (
        <ReceiptModal receipt={receipt} autoPrint={autoPrint} onClose={() => { setReceipt(null); setAutoPrint(false); }} />
      )}
    </div>
  );
}
