import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Eye, Printer, Search, ShieldX } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { queryKeys } from '../lib/queries';
import { dateTime, money, paymentLabel, todayISO } from '../lib/format';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Pagination } from '../components/Pagination';
import { Receipt as ReceiptModal } from '../components/Receipt';
import { TextField } from '../components/Field';
import type { Paginated, ReceiptPayload, Sale } from '../types';

interface SaleDetail {
  data: Sale;
  receipt: ReceiptPayload;
}

export function SalesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(todayISO());
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const salesQuery = useQuery({
    queryKey: [...queryKeys.sales, { search, status, from, to, page }],
    queryFn: async () =>
      (await api.get<Paginated<Sale>>('/sales', {
        params: { search: search || undefined, status: status || undefined, from: from || undefined, to: to || undefined, page, per_page: 12 },
      })).data,
  });

  const detailQuery = useQuery({
    queryKey: [...queryKeys.sales, 'detail', selectedId],
    enabled: selectedId !== null,
    queryFn: async () => (await api.get<SaleDetail>(`/sales/${selectedId}`)).data,
  });

  const sale = detailQuery.data?.data ?? null;

  const closeDetail = () => {
    setSelectedId(null);
    setVoidOpen(false);
  };

  const doVoid = async () => {
    if (!sale) return;
    setBusy(true);
    try {
      await api.post(`/sales/${sale.id}/void`);
      toast.success('Transaksi dibatalkan. Stok dikembalikan.');
      setVoidOpen(false);
      closeDetail();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.sales }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: queryKeys.stock }),
        queryClient.invalidateQueries({ queryKey: queryKeys.products }),
      ]);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const downloadRaw = async (target: Sale) => {
    try {
      const response = await api.get<Blob>(`/sales/${target.id}/raw`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `struk-${target.invoice_number.replace(/[^\w-]+/g, '-')}.bin`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('File ESC/POS diunduh.');
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  const columns: Column<Sale>[] = [
    { header: 'No. Invoice', cell: (item) => <strong>{item.invoice_number}</strong> },
    { header: 'Waktu', cell: (item) => dateTime(item.created_at) },
    { header: 'Pelanggan', cell: (item) => item.customer_name ?? 'Umum' },
    { header: 'Kasir', cell: (item) => item.cashier?.name ?? '—' },
    { header: 'Metode', cell: (item) => <span className="badge">{paymentLabel(item.payment_method)}</span> },
    {
      header: 'Status',
      cell: (item) => (
        <span className={`badge ${item.status === 'void' ? 'badge--danger' : 'badge--success'}`}>
          {item.status === 'void' ? 'Dibatalkan' : 'Selesai'}
        </span>
      ),
    },
    { header: 'Total', cell: (item) => money(item.total), className: 'text-right' },
    {
      header: 'Aksi',
      cell: (item) => (
        <button type="button" className="icon-button" onClick={() => setSelectedId(item.id)} aria-label={`Lihat transaksi ${item.invoice_number}`}>
          <Eye size={15} aria-hidden="true" />
        </button>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Laporan"
        title="Riwayat Penjualan"
        description="Telusuri transaksi dan cetak ulang struk."
      />

      <section className="panel">
        <div className="filter-bar">
          <div className="search-box search-box--inline">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Cari invoice atau pelanggan…"
              aria-label="Cari transaksi"
            />
          </div>
          <select
            className="input select select--filter"
            value={status}
            onChange={(event) => { setStatus(event.target.value); setPage(1); }}
            aria-label="Filter status"
          >
            <option value="">Semua status</option>
            <option value="completed">Selesai</option>
            <option value="void">Dibatalkan</option>
          </select>
          <TextField label="Dari" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
          <TextField label="Sampai" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
        </div>

        {salesQuery.isLoading ? (
          <div className="loading-card">Memuat transaksi…</div>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={salesQuery.data?.data ?? []}
              rowKey={(item) => item.id}
              label="Riwayat penjualan"
              empty="Belum ada transaksi."
            />
            <Pagination
              page={salesQuery.data?.meta.current_page ?? 1}
              lastPage={salesQuery.data?.meta.last_page ?? 1}
              onPage={setPage}
            />
          </>
        )}
      </section>

      <Modal
        open={selectedId !== null}
        onClose={closeDetail}
        title={sale ? `Transaksi ${sale.invoice_number}` : 'Detail Transaksi'}
        description={sale ? `${dateTime(sale.created_at)} · ${sale.cashier?.name ?? 'Kasir'}` : undefined}
        size="lg"
        footer={sale && (
          <>
            <button type="button" className="button button--ghost" onClick={closeDetail}>Tutup</button>
            <button type="button" className="button button--secondary" onClick={() => void downloadRaw(sale)}>
              <Download size={16} aria-hidden="true" /> ESC/POS
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={() => { setReceipt(detailQuery.data?.receipt ?? null); setSelectedId(null); }}
            >
              <Printer size={16} aria-hidden="true" /> Cetak Struk
            </button>
            {isAdmin && sale.status === 'completed' && (
              <button type="button" className="button button--danger" onClick={() => setVoidOpen(true)}>
                <ShieldX size={16} aria-hidden="true" /> Void
              </button>
            )}
          </>
        )}
      >
        {detailQuery.isLoading && <div className="loading-card">Memuat detail…</div>}
        {detailQuery.isError && <div className="alert alert--error">Gagal memuat detail transaksi.</div>}
        {sale && (
          <div className="sale-detail">
            <dl className="detail-grid">
              <div><dt>Status</dt><dd><span className={`badge ${sale.status === 'void' ? 'badge--danger' : 'badge--success'}`}>{sale.status === 'void' ? 'Dibatalkan' : 'Selesai'}</span></dd></div>
              <div><dt>Metode</dt><dd>{paymentLabel(sale.payment_method)}</dd></div>
              <div><dt>Pelanggan</dt><dd>{sale.customer_name ?? 'Umum'}</dd></div>
              <div><dt>Catatan</dt><dd>{sale.notes ?? '—'}</dd></div>
            </dl>
            <div className="table-scroll" role="region" aria-label="Item transaksi" tabIndex={0}>
              <table className="data-table data-table--compact">
                <thead>
                  <tr>
                    <th scope="col">Produk</th>
                    <th scope="col">Qty</th>
                    <th scope="col">Harga</th>
                    <th scope="col">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.product_name}</strong><small className="cell-small">{item.sku}</small></td>
                      <td>{item.quantity}</td>
                      <td>{money(item.unit_price)}</td>
                      <td>{money(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="summary-list summary-list--boxed">
              <div><dt>Subtotal</dt><dd>{money(sale.subtotal)}</dd></div>
              {sale.discount > 0 && <div><dt>Diskon</dt><dd>-{money(sale.discount)}</dd></div>}
              {sale.tax > 0 && <div><dt>Pajak</dt><dd>{money(sale.tax)}</dd></div>}
              <div className="summary-list__total"><dt>Total</dt><dd>{money(sale.total)}</dd></div>
              <div><dt>Bayar</dt><dd>{money(sale.amount_paid)}</dd></div>
              <div><dt>Kembali</dt><dd>{money(sale.change)}</dd></div>
            </dl>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={voidOpen}
        title="Batalkan transaksi"
        message="Stok produk akan dikembalikan dan transaksi ditandai dibatalkan. Lanjutkan?"
        confirmLabel="Ya, batalkan"
        busy={busy}
        onConfirm={() => void doVoid()}
        onClose={() => setVoidOpen(false)}
      />

      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
