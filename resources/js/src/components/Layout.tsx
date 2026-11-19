import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Boxes,
  CircleUserRound,
  Coffee,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Settings,
  ShoppingCart,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useBrandSettings } from '../lib/queries';

const MOBILE_QUERY = '(max-width: 820px)';
const COLLAPSE_KEY = 'kopipos:sidebar-collapsed';

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/kasir': 'Kasir',
  '/produk': 'Produk & Kategori',
  '/stok': 'Manajemen Stok',
  '/penjualan': 'Riwayat Penjualan',
  '/pengaturan': 'Pengaturan Toko',
  '/pengguna': 'Pengguna',
};

export function Layout() {
  const { user, logout } = useAuth();
  const { data: brand } = useBrandSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const sync = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, isMobile]);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* storage bisa diblokir; abaikan */
    }
  }, [collapsed]);

  const sidebarVisible = isMobile ? menuOpen : !collapsed;

  useEffect(() => {
    if (!isMobile || !menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      menuButtonRef.current?.focus({ preventScroll: true });
    };
  }, [isMobile, menuOpen]);

  const toggleSidebar = () => {
    if (isMobile) setMenuOpen((open) => !open);
    else setCollapsed((value) => !value);
  };

  const nav = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/kasir', label: 'Kasir', icon: ShoppingCart, end: false },
    { to: '/produk', label: 'Produk', icon: Package, end: false },
    { to: '/stok', label: 'Stok', icon: Boxes, end: false },
    { to: '/penjualan', label: 'Penjualan', icon: ReceiptText, end: false },
  ];

  const adminNav = [
    { to: '/pengaturan', label: 'Pengaturan', icon: Settings, end: false },
    { to: '/pengguna', label: 'Pengguna', icon: Users, end: false },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const brandName = brand?.store_name ?? 'Kopi POS';
  const title = TITLES[location.pathname] ?? brandName;

  useEffect(() => {
    document.title = `${title} — ${brandName}`;
  }, [title, brandName]);

  return (
    <div className={`app-shell ${!isMobile && collapsed ? 'app-shell--sidebar-collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">Lewati ke konten utama</a>

      {isMobile && menuOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Tutup menu navigasi"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        id="main-sidebar"
        className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}
        aria-label="Navigasi utama"
        role={isMobile && menuOpen ? 'dialog' : undefined}
        aria-modal={isMobile && menuOpen ? true : undefined}
        inert={!sidebarVisible}
      >
        <div className="brand">
          <span className="brand__mark"><Coffee size={22} aria-hidden="true" /></span>
          <span className="brand__text">
            <strong>{brandName}</strong>
            <small>KASIR & STOK</small>
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-button sidebar__close"
            aria-label="Tutup menu"
            onClick={() => setMenuOpen(false)}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Menu">
          <p className="sidebar__label">Menu Utama</p>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
            >
              <item.icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {user?.role === 'admin' && (
            <>
              <p className="sidebar__label sidebar__label--spaced">Administrasi</p>
              {adminNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
                >
                  <item.icon size={18} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="sidebar__footer">
          <div className="user-card">
            <span className="user-card__avatar"><CircleUserRound size={22} aria-hidden="true" /></span>
            <span className="user-card__info">
              <strong>{user?.name}</strong>
              <small>{user?.role === 'admin' ? 'Administrator' : 'Kasir'}</small>
            </span>
          </div>
          <button type="button" className="button button--ghost button--block" onClick={() => void handleLogout()}>
            <LogOut size={16} aria-hidden="true" /> Keluar
          </button>
        </div>
      </aside>

      <div className="app-main" inert={isMobile && menuOpen}>
        <header className="topbar">
          <button
            ref={menuButtonRef}
            type="button"
            className="icon-button topbar__menu"
            aria-label={sidebarVisible ? 'Sembunyikan navigasi' : 'Tampilkan navigasi'}
            aria-controls="main-sidebar"
            aria-expanded={sidebarVisible}
            onClick={toggleSidebar}
          >
            {isMobile ? (
              <Menu size={20} aria-hidden="true" />
            ) : sidebarVisible ? (
              <PanelLeftClose size={20} aria-hidden="true" />
            ) : (
              <PanelLeftOpen size={20} aria-hidden="true" />
            )}
          </button>
          <div className="topbar__title">
            <h1>{title}</h1>
            <p>{brandName}</p>
          </div>
          <div className="topbar__meta">
            <span className="badge badge--soft">{user?.role === 'admin' ? 'Admin' : 'Kasir'}</span>
          </div>
        </header>

        <main className="content" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
