import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Coffee } from 'lucide-react';
import { useAuth } from './lib/auth';
import { initFormA11y } from './lib/formA11y';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PosPage } from './pages/PosPage';
import { ProductsPage } from './pages/ProductsPage';
import { StockPage } from './pages/StockPage';
import { SalesPage } from './pages/SalesPage';
import { SettingsPage } from './pages/SettingsPage';
import { UsersPage } from './pages/UsersPage';
import { NotFoundPage } from './pages/NotFoundPage';

function LoadingScreen() {
  return (
    <div className="boot-screen">
      <Coffee size={38} aria-hidden="true" />
      <p>Menyiapkan kasir…</p>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const location = useLocation();

  useEffect(() => {
    initFormA11y();
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="kasir" element={<PosPage />} />
        <Route path="produk" element={<ProductsPage />} />
        <Route path="stok" element={<StockPage />} />
        <Route path="penjualan" element={<SalesPage />} />
        <Route path="pengaturan" element={<RequireAdmin><SettingsPage /></RequireAdmin>} />
        <Route path="pengguna" element={<RequireAdmin><UsersPage /></RequireAdmin>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
