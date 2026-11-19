import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

export function money(value: number, currency = 'IDR'): string {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);
  } catch {
    return `Rp ${new Intl.NumberFormat('id-ID').format(Number(value) || 0)}`;
  }
}

export function number(value: number): string {
  return new Intl.NumberFormat('id-ID').format(Number(value) || 0);
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return format(parseISO(value), 'dd MMM yyyy, HH:mm', { locale: idLocale });
  } catch {
    return value;
  }
}

export function dateOnly(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return format(parseISO(value), 'dd MMM yyyy', { locale: idLocale });
  } catch {
    return value;
  }
}

export function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function paymentLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: 'Tunai',
    card: 'Kartu',
    qris: 'QRIS',
    transfer: 'Transfer',
  };
  return labels[method] ?? method;
}
