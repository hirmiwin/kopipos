import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Coffee, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useBrandSettings } from '../lib/queries';
import { errorMessage, fieldErrors } from '../lib/api';
import { TextField } from '../components/Field';

export function LoginPage() {
  const { user, login } = useAuth();
  const { data: brand } = useBrandSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const brandName = brand?.store_name ?? 'Kopi POS';

  useEffect(() => {
    document.title = `${brandName} — Masuk`;
  }, [brandName]);

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (caught) {
      setError(errorMessage(caught));
      setErrors(fieldErrors(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-art" aria-hidden="true">
        <div className="login-art__glow" />
        <Coffee size={72} strokeWidth={1.3} />
        <h2>{brandName}</h2>
        <p>Kasir cepat, stok terkontrol, struk tercetak rapi.</p>
        <div className="login-art__stats">
          <span><strong>9+</strong><small>Produk</small></span>
          <span><strong>2</strong><small>Metode cetak</small></span>
          <span><strong>24/7</strong><small>Siap pakai</small></span>
        </div>
      </div>

      <div className="login-panel">
        <form className="login-card" onSubmit={(event) => void submit(event)} noValidate>
          <div className="login-card__brand">
            <span><Coffee size={22} aria-hidden="true" /></span>
            <div><strong>Masuk Kasir</strong><small>{brandName}</small></div>
          </div>

          <div className="login-card__intro">
            <h1>Selamat datang kembali</h1>
            <p>Masuk untuk mengelola transaksi dan stok toko.</p>
          </div>

          {error && <div className="alert alert--error" role="alert">{error}</div>}

          <TextField
            label="Email"
            type="email"
            name="email"
            autoComplete="username"
            placeholder="nama@toko.com"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={errors.email?.[0]}
          />

          <div className="password-field">
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              placeholder="Masukkan password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={errors.password?.[0]}
            />
            <button
              type="button"
              className="password-field__toggle"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>

          <button type="submit" className="button button--primary button--block button--large" disabled={busy}>
            {busy ? 'Memeriksa…' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}
