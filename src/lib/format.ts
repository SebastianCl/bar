export const APP_TIME_ZONE = 'America/Bogota';

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: APP_TIME_ZONE,
});

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeZone: APP_TIME_ZONE,
});

const dateKeyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const relativeFormatter = new Intl.RelativeTimeFormat('es-CO', { numeric: 'auto' });

export function formatCurrency(value: number | string | null | undefined): string {
  const numericValue = typeof value === 'string' ? Number(value) : (value ?? 0);
  return currencyFormatter.format(Number.isFinite(numericValue) ? numericValue : 0);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

export function toBogotaDateKey(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = dateKeyFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : '';
}

export function bogotaDayRange(dateKey: string): { start: string; end: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  const nextKey = [
    next.getUTCFullYear(),
    String(next.getUTCMonth() + 1).padStart(2, '0'),
    String(next.getUTCDate()).padStart(2, '0'),
  ].join('-');
  return {
    start: `${dateKey}T00:00:00-05:00`,
    end: `${nextKey}T00:00:00-05:00`,
  };
}

export function formatRelativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const deltaMinutes = Math.round((date.getTime() - Date.now()) / 60_000);
  if (Math.abs(deltaMinutes) < 60)
    return relativeFormatter.format(deltaMinutes, 'minute');
  const deltaHours = Math.round(deltaMinutes / 60);
  if (Math.abs(deltaHours) < 24) return relativeFormatter.format(deltaHours, 'hour');
  return relativeFormatter.format(Math.round(deltaHours / 24), 'day');
}

export function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: 'Administrador',
    owner: 'Propietario',
    cashier: 'Caja',
    staff: 'Operación',
  };
  return labels[role] ?? role;
}
