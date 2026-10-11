/** Number of minor-unit digits for an ISO 4217 currency (USD → 2, JPY → 0, KWD → 3). */
export function currencyDecimals(currency: string): number {
  try {
    const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
    return Math.min(Math.max(digits ?? 2, 0), 3);
  } catch {
    return 2;
  }
}

export function isValidCurrencyCode(code: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) return false;
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: code });
    return true;
  } catch {
    return false;
  }
}
