/**
 * Display formatting and locale-aware number parsing. All formatting goes
 * through Intl so currency symbols, separators and decimals follow the
 * business locale. Formatters are cached because Intl construction is slow.
 */
import { currencyDecimals } from '../domain/currency';
import { parseISODate } from '../domain/dates';
import type { DateFormat } from '../domain/types';

const cache = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let fmt = cache.get(key);
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat(locale, options);
    } catch {
      fmt = new Intl.NumberFormat('en-US', options);
    }
    cache.set(key, fmt);
  }
  return fmt;
}

export interface FormatContext {
  locale: string;
  currency: string;
  dateFormat: DateFormat;
}

/** Integer minor units → localized currency string. */
export function formatMoney(minor: number, ctx: Pick<FormatContext, 'locale' | 'currency'>): string {
  const decimals = currencyDecimals(ctx.currency);
  return numberFormat(ctx.locale, {
    style: 'currency',
    currency: ctx.currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(minor / 10 ** decimals);
}

/** A unit price (major units, up to 4dp): currency decimals, extended only when needed. */
export function formatUnitPrice(major: number, ctx: Pick<FormatContext, 'locale' | 'currency'>): string {
  const decimals = currencyDecimals(ctx.currency);
  return numberFormat(ctx.locale, {
    style: 'currency',
    currency: ctx.currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: 4,
  }).format(major);
}

export function formatNumber(value: number, locale: string, maxDecimals = 2): string {
  return numberFormat(locale, { maximumFractionDigits: maxDecimals }).format(value);
}

export function formatPercent(value: number | null, locale: string, decimals = 1): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${numberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)}%`;
}

export function currencySymbol(currency: string, locale: string): string {
  try {
    const part = numberFormat(locale, { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency');
    return part?.value ?? currency;
  } catch {
    return currency;
  }
}

export function formatDate(iso: string | null | undefined, ctx: Pick<FormatContext, 'locale' | 'dateFormat'>): string {
  const date = parseISODate(iso);
  if (!date) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  switch (ctx.dateFormat) {
    case 'dmy':
      return `${dd}/${mm}/${yyyy}`;
    case 'mdy':
      return `${mm}/${dd}/${yyyy}`;
    case 'ymd':
      return `${yyyy}-${mm}-${dd}`;
    default:
      try {
        return new Intl.DateTimeFormat(ctx.locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
      } catch {
        return `${yyyy}-${mm}-${dd}`;
      }
  }
}

export function decimalSeparator(locale: string): string {
  return numberFormat(locale, {}).formatToParts(1.5).find((p) => p.type === 'decimal')?.value ?? '.';
}

export type ParseResult = { ok: true; value: number } | { ok: false; reason: 'empty' | 'invalid' };

/**
 * Parse a number typed by the user. Accepts the locale's decimal separator and
 * '.'; strips spaces, currency symbols and (for '.'-decimal locales) commas used
 * as thousands separators. Rejects anything else rather than guessing.
 */
export function parseDecimal(input: string, locale: string): ParseResult {
  let text = input.trim().replace(/[\s\u00a0\u202f'\u2019]/g, '');
  text = text.replace(/^[^\d.,-]+/, '').replace(/[^\d.,]+$/, '');
  if (text === '' || text === '-') return { ok: false, reason: 'empty' };
  const dec = decimalSeparator(locale);
  if (dec === ',') {
    // "1.234,5" → thousands '.' and decimal ','. A lone '.' is treated as decimal.
    if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  } else {
    text = text.replace(/,/g, '');
  }
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(text)) return { ok: false, reason: 'invalid' };
  const value = Number(text);
  return Number.isFinite(value) ? { ok: true, value } : { ok: false, reason: 'invalid' };
}

/** Number → string for an editable input (no grouping, locale decimal separator). */
export function toInputString(value: number, locale: string, maxDecimals = 4, minDecimals = 0): string {
  if (!Number.isFinite(value)) return '';
  let fixed = Number(value.toFixed(maxDecimals)).toString();
  const have = fixed.split('.')[1]?.length ?? 0;
  // Pad non-zero values to the currency's decimals (0.6 → 0.60) but keep a plain "0".
  if (value !== 0 && have < minDecimals) fixed = value.toFixed(Math.min(minDecimals, maxDecimals));
  return decimalSeparator(locale) === ',' ? fixed.replace('.', ',') : fixed;
}

export function countDecimals(value: number): number {
  if (!Number.isFinite(value) || Number.isInteger(value)) return 0;
  const text = value.toString();
  if (text.includes('e-')) return Number(text.split('e-')[1] ?? 0);
  return text.split('.')[1]?.length ?? 0;
}
