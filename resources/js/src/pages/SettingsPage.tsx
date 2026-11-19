import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImageUp, Save, TestTube2 } from 'lucide-react';
import { api, errorMessage, fieldErrors } from '../lib/api';
import { queryKeys, useSettings } from '../lib/queries';
import { useToast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { CheckField, SelectField, TextAreaField, TextField } from '../components/Field';
import { Receipt as ReceiptModal } from '../components/Receipt';
import type { ReceiptPayload, StoreSettings } from '../types';

export function SettingsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useSettings();
  const [form, setForm] = useState<StoreSettings | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [testReceipt, setTestReceipt] = useState<ReceiptPayload | null>(null);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (values: StoreSettings) => {
      await api.put('/settings', values);
    },
    onSuccess: async () => {
      toast.success('Pengaturan toko disimpan.');
      setErrors({});
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
    onError: (caught) => {
      setErrors(fieldErrors(caught));
      toast.error(errorMessage(caught));
    },
  });

  const logoMutation = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append('logo', file);
      await api.post('/settings/logo', body);
    },
    onSuccess: async () => {
      toast.success('Logo toko diperbarui.');
      setLogo(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const testPrint = async () => {
    try {
      const response = await api.post<{ data: ReceiptPayload }>('/receipt/test');
      setTestReceipt(response.data.data);
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form) saveMutation.mutate(form);
  };

  if (isLoading || !form) return <div className="loading-card">Memuat pengaturan…</div>;

  const update = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Administrasi"
        title="Pengaturan Toko"
        description="Atur identitas toko, struk, pajak, dan printer."
      />

      <form className="settings-layout" onSubmit={save} noValidate>
        <div className="settings-main">
          <section className="panel">
            <div className="panel__header">
              <div><h3>Identitas Toko</h3><p>Muncul di struk dan antarmuka kasir.</p></div>
            </div>
            <div className="form-grid">
              <TextField
                label="Nama toko"
                required
                value={form.store_name}
                error={errors.store_name?.[0]}
                onChange={(event) => update('store_name', event.target.value)}
              />
              <TextField
                label="Nomor telepon"
                value={form.store_phone}
                onChange={(event) => update('store_phone', event.target.value)}
              />
              <TextField
                label="Email"
                type="email"
                value={form.store_email}
                error={errors.store_email?.[0]}
                onChange={(event) => update('store_email', event.target.value)}
              />
              <TextField
                label="Mata uang"
                value={form.currency}
                error={errors.currency?.[0]}
                onChange={(event) => update('currency', event.target.value)}
              />
              <div className="form-grid__full">
                <TextAreaField
                  label="Alamat toko"
                  rows={2}
                  value={form.store_address}
                  onChange={(event) => update('store_address', event.target.value)}
                />
              </div>
              <div className="form-grid__full field">
                <label className="field__label" htmlFor="store-logo">Logo toko</label>
                <div className="logo-upload">
                  {form.logo_url && <img src={form.logo_url} alt="Logo toko saat ini" />}
                  <div>
                    <input
                      id="store-logo"
                      className="input file-input"
                      type="file"
                      accept="image/*"
                      onChange={(event) => setLogo(event.target.files?.[0] ?? null)}
                    />
                    {logo && (
                      <button
                        type="button"
                        className="button button--small button--secondary"
                        onClick={() => logoMutation.mutate(logo)}
                        disabled={logoMutation.isPending}
                      >
                        <ImageUp size={14} aria-hidden="true" /> Unggah logo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div><h3>Struk & Pajak</h3><p>Teks yang tampil pada cetakan struk.</p></div>
            </div>
            <div className="form-grid">
              <div className="form-grid__full">
                <TextField
                  label="Header struk"
                  value={form.receipt_header}
                  onChange={(event) => update('receipt_header', event.target.value)}
                />
              </div>
              <div className="form-grid__full">
                <TextAreaField
                  label="Footer struk"
                  rows={2}
                  value={form.receipt_footer}
                  onChange={(event) => update('receipt_footer', event.target.value)}
                />
              </div>
              <SelectField
                label="Lebar kertas"
                value={form.receipt_width}
                onChange={(event) => update('receipt_width', event.target.value as StoreSettings['receipt_width'])}
              >
                <option value="58">58 mm</option>
                <option value="80">80 mm</option>
              </SelectField>
              <TextField
                label="Zona waktu"
                value={form.timezone}
                onChange={(event) => update('timezone', event.target.value)}
              />
              <TextField
                label="Ambang stok minimum global"
                type="number"
                min="0"
                value={String(form.low_stock_threshold)}
                onChange={(event) => update('low_stock_threshold', Number(event.target.value))}
              />
              <div className="form-stack">
                <CheckField
                  label="Aktifkan pajak"
                  checked={form.tax_enabled}
                  onChange={(checked) => update('tax_enabled', checked)}
                />
                <TextField
                  label="Tarif pajak (%)"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={String(form.tax_rate)}
                  onChange={(event) => update('tax_rate', Number(event.target.value))}
                  disabled={!form.tax_enabled}
                />
              </div>
            </div>
          </section>
        </div>

        <aside className="settings-side">
          <section className="panel">
            <div className="panel__header">
              <div><h3>Printer Struk</h3><p>Pilih jalur cetak.</p></div>
            </div>
            <div className="form-stack">
              <SelectField
                label="Metode cetak"
                value={form.print_method}
                onChange={(event) => update('print_method', event.target.value as StoreSettings['print_method'])}
              >
                <option value="browser">Browser / print dialog</option>
                <option value="serial">Thermal via Web Serial</option>
              </SelectField>
              <TextField
                label="Baud rate"
                type="number"
                min="1200"
                max="115200"
                value={String(form.serial_baud_rate)}
                onChange={(event) => update('serial_baud_rate', Number(event.target.value))}
                hint="Umumnya 9600 untuk printer thermal USB."
              />
              <CheckField
                label="Cetak otomatis setelah transaksi"
                hint="Hanya berlaku untuk metode Browser. Thermal butuh konfirmasi picker port."
                checked={form.auto_print}
                onChange={(checked) => update('auto_print', checked)}
              />
              <div className="callout">
                <strong>Catatan printer thermal</strong>
                <p>Gunakan Chrome atau Edge dengan HTTPS/localhost. Klik <em>Cetak Thermal</em> lalu pilih port printer saat diminta browser.</p>
              </div>
              <button type="button" className="button button--secondary button--block" onClick={() => void testPrint()}>
                <TestTube2 size={16} aria-hidden="true" /> Cetak Contoh Struk
              </button>
            </div>
          </section>

          <div className="settings-save">
            <button type="submit" className="button button--primary button--block button--large" disabled={saveMutation.isPending}>
              <Save size={16} aria-hidden="true" /> {saveMutation.isPending ? 'Menyimpan…' : 'Simpan Pengaturan'}
            </button>
          </div>
        </aside>
      </form>

      {testReceipt && <ReceiptModal receipt={testReceipt} onClose={() => setTestReceipt(null)} />}
    </div>
  );
}
