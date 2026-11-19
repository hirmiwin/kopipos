import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Usb, X } from 'lucide-react';
import { Modal } from './Modal';
import { useToast } from '../lib/toast';
import { dateTime, money, paymentLabel } from '../lib/format';
import { printEscpos, serialSupported } from '../lib/escpos';
import type { ReceiptPayload } from '../types';

const PAGE_STYLE_ID = 'receipt-page-size';

export function printReceiptWindow(width: '58' | '80' = '80') {
  let style = document.getElementById(PAGE_STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = PAGE_STYLE_ID;
    document.head.append(style);
  }
  style.textContent = `@page { size: ${width}mm auto; margin: ${width === '58' ? '2mm' : '3mm'}; }`;

  document.body.classList.add('receipt-printing');
  const cleanup = () => document.body.classList.remove('receipt-printing');
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  window.setTimeout(cleanup, 1500);
}

interface ReceiptProps {
  receipt: ReceiptPayload;
  onClose: () => void;
  autoPrint?: boolean;
}

export function Receipt({ receipt, onClose, autoPrint = false }: ReceiptProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const autoPrinted = useRef(false);
  const supportsSerial = serialSupported();
  const settings = receipt.settings;
  const paperWidth = settings.receipt_width === '58' ? '58' : '80';

  useEffect(() => {
    if (!autoPrint || autoPrinted.current || settings.print_method !== 'browser') return;
    autoPrinted.current = true;
    const timer = window.setTimeout(() => printReceiptWindow(paperWidth), 350);
    return () => window.clearTimeout(timer);
  }, [autoPrint, settings.print_method, paperWidth]);

  const thermalPrint = async () => {
    if (!supportsSerial) {
      toast.error('Web Serial tidak tersedia. Buka di Chrome/Edge atau pakai Cetak Browser.');
      return;
    }
    setBusy(true);
    try {
      await printEscpos(receipt.escpos_base64, settings.serial_baud_rate);
      toast.success('Struk dikirim ke printer thermal.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mencetak ke printer thermal.');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <Modal
      open
      onClose={onClose}
      title="Struk Transaksi"
      description="Pilih metode cetak sesuai printer yang terpasang."
      size="sm"
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onClose}>
            <X size={16} aria-hidden="true" /> Tutup
          </button>
          <button type="button" className="button button--secondary" onClick={() => printReceiptWindow(paperWidth)}>
            <Printer size={16} aria-hidden="true" /> Cetak Browser
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={() => void thermalPrint()}
            disabled={!supportsSerial || busy}
            title={supportsSerial ? undefined : 'Web Serial hanya tersedia di Chrome/Edge'}
          >
            <Usb size={16} aria-hidden="true" /> {busy ? 'Mengirim…' : 'Cetak Thermal'}
          </button>
        </>
      }
    >
      <div className={`receipt-paper ${settings.receipt_width === '58' ? 'receipt-paper--58' : ''}`}>
        {settings.logo_url && (
          <img className="receipt-paper__logo" src={settings.logo_url} alt={`Logo ${settings.store_name}`} />
        )}
        <div className="receipt-paper__brand">{settings.store_name}</div>
        {settings.store_address && <p>{settings.store_address}</p>}
        {settings.store_phone && <p>Telp: {settings.store_phone}</p>}
        {settings.store_email && <p>{settings.store_email}</p>}

        <div className="receipt-paper__divider" />
        {settings.receipt_header && <p className="receipt-paper__center">{settings.receipt_header}</p>}
        <div className="receipt-paper__divider" />

        <dl className="receipt-paper__meta">
          <div><dt>No</dt><dd>{receipt.invoice_number}</dd></div>
          <div><dt>Tanggal</dt><dd>{dateTime(receipt.created_at)}</dd></div>
          <div><dt>Kasir</dt><dd>{receipt.cashier}</dd></div>
          {receipt.customer_name && <div><dt>Pelanggan</dt><dd>{receipt.customer_name}</dd></div>}
        </dl>

        <div className="receipt-paper__divider" />
        <table className="receipt-paper__items">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Qty</th>
              <th scope="col">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.map((item, index) => (
              <tr key={`${item.name}-${index}`}>
                <td>
                  <strong>{item.name}</strong>
                  <span>{money(item.unit_price, settings.currency)}</span>
                </td>
                <td>{item.quantity}</td>
                <td>{money(item.subtotal, settings.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="receipt-paper__divider" />

        <dl className="receipt-paper__totals">
          <div><dt>Subtotal</dt><dd>{money(receipt.subtotal, settings.currency)}</dd></div>
          {receipt.discount > 0 && <div><dt>Diskon</dt><dd>-{money(receipt.discount, settings.currency)}</dd></div>}
          {receipt.tax > 0 && <div><dt>Pajak</dt><dd>{money(receipt.tax, settings.currency)}</dd></div>}
          <div className="receipt-paper__grand"><dt>Total</dt><dd>{money(receipt.total, settings.currency)}</dd></div>
          <div><dt>Bayar</dt><dd>{money(receipt.amount_paid, settings.currency)}</dd></div>
          <div><dt>Kembali</dt><dd>{money(receipt.change, settings.currency)}</dd></div>
          <div><dt>Metode</dt><dd>{paymentLabel(receipt.payment_method)}</dd></div>
        </dl>

        <div className="receipt-paper__divider" />
        <p className="receipt-paper__center">{settings.receipt_footer}</p>
        <p className="receipt-paper__center receipt-paper__thanks">-- Terima kasih --</p>
      </div>
    </Modal>,
    document.body,
  );
}
