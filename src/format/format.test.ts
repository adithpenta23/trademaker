import { describe, expect, it } from 'vitest';
import { formatDate, formatMoney, formatPercent, formatUnitPrice, parseDecimal, toInputString } from './format';

describe('formatting', () => {
  it('formats minor units in the currency and locale', () => {
    expect(formatMoney(123_456, { locale: 'en-US', currency: 'USD' })).toBe('$1,234.56');
    expect(formatMoney(123_456, { locale: 'en-IN', currency: 'INR' })).toBe('₹1,234.56');
    expect(formatMoney(1235, { locale: 'ja-JP', currency: 'JPY' })).toMatch(/1,235/);
    expect(formatMoney(-5000, { locale: 'en-GB', currency: 'GBP' })).toBe('-£50.00');
  });

  it('shows extra unit-price decimals only when needed', () => {
    expect(formatUnitPrice(0.125, { locale: 'en-US', currency: 'USD' })).toBe('$0.125');
    expect(formatUnitPrice(12, { locale: 'en-US', currency: 'USD' })).toBe('$12.00');
  });

  it('formats percentages and handles undefined ratios', () => {
    expect(formatPercent(28.57, 'en-US')).toBe('28.6%');
    expect(formatPercent(null, 'en-US')).toBe('—');
  });

  it('formats dates in the chosen style', () => {
    expect(formatDate('2026-03-09', { locale: 'en-US', dateFormat: 'dmy' })).toBe('09/03/2026');
    expect(formatDate('2026-03-09', { locale: 'en-US', dateFormat: 'mdy' })).toBe('03/09/2026');
    expect(formatDate('not-a-date', { locale: 'en-US', dateFormat: 'ymd' })).toBe('');
  });
});

describe('parseDecimal', () => {
  it('parses plain and grouped numbers', () => {
    expect(parseDecimal('12.5', 'en-US')).toEqual({ ok: true, value: 12.5 });
    expect(parseDecimal('1,250', 'en-US')).toEqual({ ok: true, value: 1250 });
    expect(parseDecimal('$ 1,250.75', 'en-US')).toEqual({ ok: true, value: 1250.75 });
  });

  it('respects comma-decimal locales', () => {
    expect(parseDecimal('12,5', 'de-DE')).toEqual({ ok: true, value: 12.5 });
    expect(parseDecimal('1.234,5', 'de-DE')).toEqual({ ok: true, value: 1234.5 });
    expect(parseDecimal('12.5', 'de-DE')).toEqual({ ok: true, value: 12.5 });
  });

  it('rejects junk instead of guessing', () => {
    expect(parseDecimal('', 'en-US')).toEqual({ ok: false, reason: 'empty' });
    expect(parseDecimal('12a4', 'en-US')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseDecimal('1.2.3', 'en-US')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('round-trips input strings', () => {
    expect(toInputString(12.5, 'de-DE')).toBe('12,5');
    expect(toInputString(0.1 + 0.2, 'en-US')).toBe('0.3');
  });
});
