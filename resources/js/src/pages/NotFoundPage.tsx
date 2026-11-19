import { Link } from 'react-router-dom';
import { Coffee } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="not-found">
      <Coffee size={56} aria-hidden="true" />
      <strong>404</strong>
      <h2>Halaman tidak ditemukan</h2>
      <p>Link yang Anda buka tidak tersedia.</p>
      <Link to="/" className="button button--primary">Kembali ke Dashboard</Link>
    </div>
  );
}
