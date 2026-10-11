import { useMemo } from 'react';
import type { DateFormat } from '../domain/types';
import { useStore } from '../state/store';
import { formatDate, formatMoney, formatNumber, formatPercent, formatUnitPrice } from './format';

export interface Fmt {
  locale: string;
  currency: string;
  money: (minor: number) => string;
  unitPrice: (major: number) => string;
  pct: (value: number | null, decimals?: number) => string;
  num: (value: number, maxDecimals?: number) => string;
  date: (iso: string | null | undefined) => string;
}

export function makeFmt(locale: string, currency: string, dateFormat: DateFormat): Fmt {
  return {
    locale,
    currency,
    money: (minor) => formatMoney(minor, { locale, currency }),
    unitPrice: (major) => formatUnitPrice(major, { locale, currency }),
    pct: (value, decimals = 1) => formatPercent(value, locale, decimals),
    num: (value, maxDecimals = 2) => formatNumber(value, locale, maxDecimals),
    date: (iso) => formatDate(iso, { locale, dateFormat }),
  };
}

/** Formatter bound to the business locale; pass a quote's currency to format that quote. */
export function useFmt(currency?: string): Fmt {
  const { state } = useStore();
  const { locale, dateFormat } = state.business;
  const cur = currency ?? state.business.currency;
  return useMemo(() => makeFmt(locale, cur, dateFormat), [locale, cur, dateFormat]);
}
