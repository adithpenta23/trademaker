import type { ISODate } from './types';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local calendar date as YYYY-MM-DD. */
export function toISODate(date: Date): ISODate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD as a local date; null if malformed or not a real date. */
export function parseISODate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) return null;
  return date;
}

export function isISODate(value: unknown): value is ISODate {
  return typeof value === 'string' && parseISODate(value) !== null;
}

export function addDays(iso: ISODate, days: number): ISODate {
  const date = parseISODate(iso) ?? new Date();
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** The effective expiry date of a quote. */
export function quoteExpiryDate(quote: { createdDate: ISODate; validityDays: number; expiryDate: ISODate | null }): ISODate {
  return quote.expiryDate ?? addDays(quote.createdDate, quote.validityDays);
}
