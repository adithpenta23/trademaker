/**
 * Exact money arithmetic.
 *
 * Strategy
 * - User inputs (prices, costs, quantities, percentages) are decimals with at
 *   most 4 decimal places. They are converted to integers scaled by 10^4
 *   ("scaled-4") using their decimal string form, so no binary floating-point
 *   error leaks into calculations.
 * - Monetary results are integers in the currency's minor unit (e.g. cents).
 * - Every multiplication/division goes through BigInt and is rounded exactly
 *   once, using the rounding mode named at the call site.
 *
 * Rounding policy: ROUND HALF UP (half away from zero), applied when a value
 * is converted to minor units — per line amount, per discount, per tax
 * component and per deposit. Automatic prices round UP so they never fall
 * short of the target.
 */

export const INPUT_DECIMALS = 4;
const SCALE = 10_000n; // 10^INPUT_DECIMALS

/** Largest absolute minor-unit amount the app will compute with (100 billion major units at 2dp). */
export const MAX_MINOR = 10_000_000_000_000;

export type RoundingMode = 'halfUp' | 'ceil' | 'floor';

export class MoneyRangeError extends Error {
  constructor(message = 'Amount is outside the supported range') {
    super(message);
    this.name = 'MoneyRangeError';
  }
}

/** Convert a decimal input value to a bigint scaled by 10^4 (half-up beyond 4dp). */
export function scaled(value: number): bigint {
  if (!Number.isFinite(value)) return 0n;
  if (Math.abs(value) >= 1e15) throw new MoneyRangeError();
  // toFixed works on the exact binary value; inputs with ≤4dp round-trip exactly.
  const fixed = value.toFixed(INPUT_DECIMALS);
  const negative = fixed.startsWith('-');
  const digits = fixed.replace('-', '').replace('.', '');
  const result = BigInt(digits);
  return negative ? -result : result;
}

/** Integer division with an explicit rounding mode. */
export function divide(numerator: bigint, denominator: bigint, mode: RoundingMode = 'halfUp'): bigint {
  if (denominator === 0n) throw new RangeError('Division by zero');
  if (denominator < 0n) {
    numerator = -numerator;
    denominator = -denominator;
  }
  const negative = numerator < 0n;
  const abs = negative ? -numerator : numerator;
  const q = abs / denominator;
  const r = abs % denominator;
  let rounded: bigint;
  if (r === 0n) rounded = q;
  else if (mode === 'halfUp') rounded = r * 2n >= denominator ? q + 1n : q;
  else if (mode === 'ceil') rounded = negative ? q : q + 1n;
  else rounded = negative ? q + 1n : q;
  return negative ? -rounded : rounded;
}

export function pow10(exp: number): bigint {
  return 10n ** BigInt(exp);
}

/** Convert a bigint minor amount to a JS number, enforcing the supported range. */
export function toSafeNumber(value: bigint): number {
  if (value > BigInt(MAX_MINOR) || value < -BigInt(MAX_MINOR)) throw new MoneyRangeError();
  return Number(value);
}

/** Major-unit decimal → integer minor units. */
export function toMinor(major: number, decimals: number, mode: RoundingMode = 'halfUp'): number {
  return toSafeNumber(divide(scaled(major), pow10(INPUT_DECIMALS - decimals), mode));
}

/** Integer minor units → major-unit number (for display and editing only). */
export function fromMinor(minor: number, decimals: number): number {
  return minor / 10 ** decimals;
}

/** quantity × unit price, rounded to minor units. */
export function lineAmount(quantity: number, unitPrice: number, decimals: number, mode: RoundingMode = 'halfUp'): number {
  const product = scaled(quantity) * scaled(unitPrice); // scaled by 10^8
  return toSafeNumber(divide(product, pow10(2 * INPUT_DECIMALS - decimals), mode));
}

/** `percent`% of an integer minor amount, rounded to minor units. */
export function percentOf(minor: number, percent: number, mode: RoundingMode = 'halfUp'): number {
  // percent scaled-4 means 1% = 10_000; dividing by 100 × 10^4 = 10^6.
  return toSafeNumber(divide(BigInt(minor) * scaled(percent), 1_000_000n, mode));
}

/** minor × numerator / denominator with rounding; all integers. */
export function mulDiv(minor: number, numerator: bigint, denominator: bigint, mode: RoundingMode = 'halfUp'): number {
  return toSafeNumber(divide(BigInt(minor) * numerator, denominator, mode));
}

/**
 * Split an integer total across weights so the parts add up exactly
 * (largest-remainder method). Weights must be non-negative and not all zero.
 */
export function allocate(total: number, weights: readonly number[]): number[] {
  const big = weights.map((w) => BigInt(Math.max(0, Math.round(w))));
  const sum = big.reduce((a, b) => a + b, 0n);
  if (sum === 0n) throw new RangeError('Cannot allocate across zero weights');
  const t = BigInt(total);
  const parts = big.map((w) => (t * w) / sum);
  const remainders = big.map((w, i) => ({ i, r: (t * w) % sum }));
  let left = t - parts.reduce((a, b) => a + b, 0n);
  remainders.sort((a, b) => (b.r > a.r ? 1 : b.r < a.r ? -1 : a.i - b.i));
  for (const { i } of remainders) {
    if (left <= 0n) break;
    parts[i] = (parts[i] ?? 0n) + 1n;
    left -= 1n;
  }
  return parts.map(toSafeNumber);
}

/** Ratio as a percentage with 2 decimal places of precision, or null when undefined. */
export function ratioPercent(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  const basisPoints = divide(BigInt(numerator) * 10_000n, BigInt(denominator), 'halfUp');
  return Number(basisPoints) / 100;
}

/** Scaled-4 representation of a unit price expressed in minor units (for auto prices). */
export function minorToScaledPrice(minor: number, decimals: number): bigint {
  return BigInt(minor) * pow10(INPUT_DECIMALS - decimals);
}

/** Convert a scaled-4 bigint back to a decimal number (exact for ≤4dp values in range). */
export function scaledToNumber(value: bigint): number {
  return Number(value) / Number(SCALE);
}
