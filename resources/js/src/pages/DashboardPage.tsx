import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  CircleAlert,
  Package,
  ReceiptText,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { api } from '../lib/api';
import { queryKeys } from '../lib/queries';
import { dateTime, money, paymentLabel } from '../lib/format';
import { PageHeader } from '../components/PageHeader';
import type { DashboardData } from '../types';

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: async () => (await api.get<{ data: DashboardData }>('/dashboard')).data.data,
  });

  if (isLoading) return <div className="loading-card">Memuat ringkasan…</div>;
  if (isError || !data) {
    return (
      <div className="alert alert--error">
        Gagal memuat dashboard. <button type="button" className="link-button" onClick={() => void refetch()}>Coba lagi</button>
      </div>
    );
  }

  const stats = [
    { label: 'Penjualan Hari Ini', value: money(data.today_revenue), icon: Wallet, tone: 'amber' },
    { label: 'Transaksi Hari Ini', value: String(data.today_transactions), icon: ReceiptText, tone: 'blue' },
    { label: 'Produk Aktif', value: String(data.total_products), icon: Package, tone: 'green' },
    { label: 'Stok Menipis', value: String(data.low_stock_products), icon: CircleAlert, tone: 'rose' },
  ];
  const maxRevenue = Math.max(...data.weekly_revenue.map((item) => item.total), 1);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="RingkasanToko"
        title="Dashboard"
        description="Pantau penjualan dan kondisi stok hari ini."
        actions={
          <Link to="/kasir" className="button button--primary">
            Buka Kasir <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        }
      />

      <section className="stat-grid" aria-label="Statistik utama">
        {stats.map((stat) => (
          <article key={stat.label} className={`stat-card stat-card--${stat.tone}`}>
            <span className="stat-card__icon"><stat.icon size={20} aria-hidden="true" /></span>
            <p>{stat.label}</p>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel__header">
            <div>
              <h3>Penjualan 7 Hari Terakhir</h3>
              <p>Total omzet per hari</p>
            </div>
            <TrendingUp size={18} aria-hidden="true" />
          </div>
          <div className="chart">
            {data.weekly_revenue.map((item) => (
              <div className="chart__column" key={item.date}>
                <div className="chart__bar-wrap">
                  <div
                    className="chart__bar"
                    style={{ height: `${Math.max(4, (item.total / maxRevenue) * 100)}%` }}
                    title={money(item.total)}
                  />
                </div>
                <span className="chart__label">
                  {new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(new Date(`${item.date}T00:00:00`))}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <h3>Stok Menipis</h3>
              <p>Produk yang perlu segera diisi</p>
            </div>
            <Link to="/stok" className="link-button">Lihat semua</Link>
          </div>
          {data.low_stock_list.length === 0 ? (
            <div className="empty-state">Semua stok dalam kondisi aman.</div>
          ) : (
            <ul className="compact-list">
              {data.low_stock_list.map((product) => (
                <li key={product.id}>
                  <span className="compact-list__dot" />
                  <span className="compact-list__body">
                    <strong>{product.name}</strong>
                    <small>{product.sku}</small>
                  </span>
                  <span className="badge badge--danger">{product.stock} pcs</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>Transaksi Terbaru</h3>
            <p>Penjualan terakhir di toko</p>
          </div>
          <Link to="/penjualan" className="link-button">Lihat riwayat</Link>
        </div>
        <div className="table-scroll" role="region" aria-label="Transaksi terbaru" tabIndex={0}>
          <table className="data-table data-table--compact">
            <thead>
              <tr>
                <th scope="col">No. Invoice</th>
                <th scope="col">Waktu</th>
                <th scope="col">Kasir</th>
                <th scope="col">Metode</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_sales.length === 0 ? (
                <tr><td colSpan={5}><div className="empty-state">Belum ada transaksi.</div></td></tr>
              ) : (
                data.recent_sales.map((sale) => (
                  <tr key={sale.id}>
                    <td><strong>{sale.invoice_number}</strong></td>
                    <td>{dateTime(sale.created_at)}</td>
                    <td>{sale.cashier?.name ?? '—'}</td>
                    <td><span className="badge">{paymentLabel(sale.payment_method)}</span></td>
                    <td className="text-right"><strong>{money(sale.total)}</strong></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
