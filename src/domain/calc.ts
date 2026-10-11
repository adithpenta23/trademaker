/**
 * TradeMaker calculation engine — the single source of truth for every number
 * shown in the editor, the profit panel, the customer preview, the PDF, the
 * dashboard and exports. Pure and deterministic: (quote) → QuoteCalculation.
 *
 * PIPELINE (all money in integer minor units; see money.ts for rounding)
 *
 *  1. Line costs (internal). For each line:
 *       labor      = hours × crew × labor cost rate
 *       unit cost  = quantity × unit cost   → bucket chosen by the line category
 *       + materials, equipment, travel, other (entered as line totals)
 *     Lines marked `optional` are excluded from job cost; `internal` lines count.
 *  2. Direct job cost = line costs + job-level costs + extra (non-billable) labor.
 *  3. Allocated overhead (none | fixed per job | per labor hour | % of direct cost).
 *     Total estimated job cost = direct cost + overhead. Overhead never depends
 *     on price, so there is no circularity.
 *  4. Unit prices.
 *       manual mode                 → the entered unit price.
 *       targetMargin / markup modes → lines flagged `autoPrice` are priced from cost:
 *         required revenue (excl. tax) = cost ÷ (1 − margin)   or   cost × (1 + markup)
 *         revenue still needed = required − revenue from manually priced lines
 *         split across auto lines in proportion to their direct cost, rounded UP.
 *  5. Line amount = quantity × unit price (half-up); item discount = % of that.
 *  6. Items subtotal = Σ included line amounts after item discounts.
 *  7. Quote discount (percent or fixed, capped at the subtotal) and the minimum
 *     job charge, in the order chosen by `minimumChargeBasis`:
 *       afterDiscount : subtotal − discount, then top up to the minimum
 *       beforeDiscount: top items subtotal up to the minimum, then discount
 *     Discount and minimum adjustment are shared between taxable and
 *     non-taxable items in proportion to their amounts.
 *  8. Tax on the taxable part of that subtotal.
 *       exclusive: tax added on top; components independent or compounding.
 *       inclusive: tax extracted from prices that already include it (never added again).
 *  9. Total; revenue excl. tax = total − tax (collected tax is never revenue).
 * 10. Deposit = % of total or fixed amount (capped at total); balance = total − deposit.
 *     The deposit is part of the total, not an extra charge.
 * 11. Profit = revenue excl. tax − total job cost.
 *       margin = profit ÷ revenue      markup = profit ÷ cost
 */

import { currencyDecimals } from './currency';
import { LIMITS } from './limits';
import {
  MoneyRangeError,
  allocate,
  divide,
  INPUT_DECIMALS,
  lineAmount,
  mulDiv,
  percentOf,
  pow10,
  ratioPercent,
  scaled,
  scaledToNumber,
  toMinor,
  toSafeNumber,
} from './money';
import type {
  CostCategory,
  DepositType,
  DiscountType,
  ID,
  LineCategory,
  LineItem,
  LineVisibility,
  MinimumChargeBasis,
  OverheadMethod,
  PricingMode,
  Quote,
  TaxCompounding,
  TaxMode,
} from './types';

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface CalcIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
  lineId?: ID;
}

export type ProfitStatus = 'healthy' | 'belowTarget' | 'lowMargin' | 'loss' | 'noRevenue' | 'invalid';

export interface LineResult {
  id: ID;
  visibility: LineVisibility;
  /** Unit price actually used, in major units (≤4dp). 0 for internal lines. */
  unitPrice: number;
  isAutoPriced: boolean;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  /** Person-hours (hours × crew). */
  laborHours: number;
  laborCost: number;
  unitCostTotal: number;
  unitCostCategory: CostCategory;
  materials: number;
  equipment: number;
  travel: number;
  other: number;
  directCost: number;
  /** (line revenue excl. tax − line direct cost) ÷ line revenue. Before overhead. */
  directMarginPercent: number | null;
}

export interface CostBreakdown {
  labor: number;
  materials: number;
  equipment: number;
  travel: number;
  disposal: number;
  subcontractor: number;
  other: number;
  direct: number;
  overhead: number;
  total: number;
}

export interface TaxLine {
  id: ID;
  name: string;
  ratePercent: number;
  amount: number;
}

export interface QuoteCalculation {
  currency: string;
  decimals: number;
  pricingMode: PricingMode;
  lines: LineResult[];
  includedLineCount: number;
  itemsGross: number;
  itemDiscounts: number;
  /** Included items after item discounts, before the quote discount and minimum. */
  itemsSubtotal: number;
  discount: {
    type: DiscountType;
    value: number;
    reason: string;
    amount: number;
    /** Discount as % of the subtotal it was applied to. */
    percentOfBase: number | null;
  };
  minimumCharge: {
    basis: MinimumChargeBasis;
    minimum: number;
    /** The subtotal that was compared against the minimum. */
    comparedSubtotal: number;
    adjustment: number;
  };
  /** After discounts and the minimum charge. Pre-tax in exclusive mode, tax-inclusive in inclusive mode. */
  subtotal: number;
  taxableAmount: number;
  tax: {
    mode: TaxMode;
    compounding: TaxCompounding;
    lines: TaxLine[];
    total: number;
  };
  total: number;
  revenueExTax: number;
  deposit: {
    type: DepositType;
    value: number;
    amount: number;
    balance: number;
  };
  optionalItemsTotal: number;
  costs: CostBreakdown;
  laborHours: number;
  /** Cost of the quote-level non-billable labor (included in costs.labor). */
  extraLaborCost: number;
  overheadMethod: OverheadMethod;
  profit: {
    directProfit: number;
    directMarginPercent: number | null;
    profit: number;
    marginPercent: number | null;
    markupPercent: number | null;
    /** Revenue excl. tax per labor person-hour (minor units). */
    effectiveHourlyRate: number | null;
    profitPerLaborHour: number | null;
  };
  target: {
    targetMarginPercent: number;
    minimumMarginPercent: number;
    /** Revenue excl. tax needed to reach the target margin; null when impossible. */
    requiredRevenue: number | null;
    shortfall: number;
    status: ProfitStatus;
  };
  issues: CalcIssue[];
}

const MILLION = 1_000_000n;

/** Which cost bucket a line's "unit cost" counts toward, based on its category. */
export function unitCostBucket(category: LineCategory): CostCategory {
  switch (category) {
    case 'labor':
    case 'materials':
    case 'equipment':
    case 'travel':
    case 'disposal':
    case 'subcontractor':
      return category;
    default:
      return 'other';
  }
}

/** Revenue needed for `marginPercent` gross margin on `costMinor`; null if margin ≥ 100. */
export function priceForTargetMargin(costMinor: number, marginPercent: number): number | null {
  const m = scaled(marginPercent);
  if (m < 0n || m >= MILLION) return null;
  return mulDiv(costMinor, MILLION, MILLION - m, 'ceil');
}

/** Revenue for `markupPercent` markup on `costMinor`. */
export function priceForMarkup(costMinor: number, markupPercent: number): number {
  return mulDiv(costMinor, MILLION + scaled(Math.max(0, markupPercent)), MILLION, 'ceil');
}

interface Sanitizer {
  num(value: number, min: number, max: number, label: string, lineId?: ID): number;
}

function makeSanitizer(issues: CalcIssue[]): Sanitizer {
  return {
    num(value, min, max, label, lineId) {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        issues.push({ severity: 'error', code: 'invalidNumber', message: `${label} is not a valid number.`, lineId });
        return min;
      }
      if (value < min || value > max) {
        issues.push({
          severity: 'error',
          code: 'outOfRange',
          message: `${label} must be between ${min} and ${max}.`,
          lineId,
        });
        return Math.min(Math.max(value, min), max);
      }
      return value;
    },
  };
}

/** Tax-inclusive factor as an exact fraction num/den. */
function taxFactor(ratesPpm: bigint[], compounding: TaxCompounding): { num: bigint; den: bigint } {
  if (ratesPpm.length === 0) return { num: 1n, den: 1n };
  if (compounding === 'compound') {
    return {
      num: ratesPpm.reduce((acc, r) => acc * (MILLION + r), 1n),
      den: MILLION ** BigInt(ratesPpm.length),
    };
  }
  return { num: MILLION + ratesPpm.reduce((a, r) => a + r, 0n), den: MILLION };
}

/**
 * Smallest-precision unit price (from currency decimals up to 4dp), rounded UP,
 * such that quantity × price covers `targetMinor`. Prefers whole minor units
 * when that overshoots the target by no more than 0.5%.
 */
function autoUnitPrice(targetMinor: number, quantity: number, decimals: number): number {
  const qty = scaled(quantity);
  if (qty <= 0n || targetMinor <= 0) return 0;
  const target8 = BigInt(targetMinor) * pow10(2 * INPUT_DECIMALS - decimals); // target in 10^-8 major units
  for (let d = decimals; d <= INPUT_DECIMALS; d++) {
    const step = pow10(INPUT_DECIMALS - d); // price granularity in scaled-4 units
    const priceScaled = divide(target8, qty * step, 'ceil') * step;
    const overshoot = qty * priceScaled - target8;
    if (d === INPUT_DECIMALS || overshoot * 200n <= target8) return scaledToNumber(priceScaled);
  }
  return 0;
}

function emptyCosts(): CostBreakdown {
  return { labor: 0, materials: 0, equipment: 0, travel: 0, disposal: 0, subcontractor: 0, other: 0, direct: 0, overhead: 0, total: 0 };
}

export function calculateQuote(quote: Quote): QuoteCalculation {
  try {
    return calculate(quote);
  } catch (error) {
    if (error instanceof MoneyRangeError || error instanceof RangeError) {
      return failedCalculation(quote, 'Some amounts are too large to calculate. Reduce quantities or prices.');
    }
    throw error;
  }
}

function failedCalculation(quote: Quote, message: string): QuoteCalculation {
  return {
    currency: quote.currency,
    decimals: currencyDecimals(quote.currency),
    pricingMode: quote.pricing.mode,
    lines: [],
    includedLineCount: 0,
    itemsGross: 0,
    itemDiscounts: 0,
    itemsSubtotal: 0,
    discount: { type: quote.discount.type, value: quote.discount.value, reason: quote.discount.reason, amount: 0, percentOfBase: null },
    minimumCharge: { basis: quote.pricing.minimumChargeBasis, minimum: 0, comparedSubtotal: 0, adjustment: 0 },
    subtotal: 0,
    taxableAmount: 0,
    tax: { mode: quote.tax.mode, compounding: quote.tax.compounding, lines: [], total: 0 },
    total: 0,
    revenueExTax: 0,
    deposit: { type: quote.deposit.type, value: quote.deposit.value, amount: 0, balance: 0 },
    optionalItemsTotal: 0,
    costs: emptyCosts(),
    laborHours: 0,
    extraLaborCost: 0,
    overheadMethod: quote.pricing.overhead.method,
    profit: {
      directProfit: 0,
      directMarginPercent: null,
      profit: 0,
      marginPercent: null,
      markupPercent: null,
      effectiveHourlyRate: null,
      profitPerLaborHour: null,
    },
    target: {
      targetMarginPercent: quote.pricing.targetMarginPercent,
      minimumMarginPercent: quote.pricing.minimumMarginPercent,
      requiredRevenue: null,
      shortfall: 0,
      status: 'invalid',
    },
    issues: [{ severity: 'error', code: 'outOfRange', message }],
  };
}

interface LineWork {
  item: LineItem;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  isAuto: boolean;
  laborHoursScaled: bigint; // person-hours × 10^4
  laborCost: number;
  unitCostTotal: number;
  unitCostCategory: CostCategory;
  materials: number;
  equipment: number;
  travel: number;
  other: number;
  directCost: number;
  gross: number;
  discount: number;
  net: number;
}

function calculate(quote: Quote): QuoteCalculation {
  const issues: CalcIssue[] = [];
  const s = makeSanitizer(issues);
  const dec = currencyDecimals(quote.currency);
  const p = quote.pricing;
  const mode = p.mode;

  const laborRate = s.num(p.laborCostPerHour, LIMITS.money.min, LIMITS.money.max, 'Labor cost per hour');
  const targetMargin = s.num(p.targetMarginPercent, LIMITS.targetMargin.min, LIMITS.targetMargin.max, 'Target margin');
  const markup = s.num(p.markupPercent, LIMITS.markup.min, LIMITS.markup.max, 'Markup');
  const minimumMargin = s.num(p.minimumMarginPercent, -100, LIMITS.targetMargin.max, 'Minimum acceptable margin');

  // ---- Tax rates -----------------------------------------------------------
  const taxMode = quote.tax.mode;
  const taxComponents = taxMode === 'none' ? [] : quote.tax.components.slice(0, LIMITS.taxComponents);
  const ratesPpm = taxComponents.map((c) =>
    scaled(s.num(c.ratePercent, LIMITS.percent.min, LIMITS.percent.max, `Tax rate "${c.name || 'Tax'}"`)),
  );
  const factor = taxFactor(ratesPpm, quote.tax.compounding);
  if (taxMode !== 'none' && (taxComponents.length === 0 || ratesPpm.every((r) => r === 0n))) {
    issues.push({ severity: 'warning', code: 'taxNoRates', message: 'Tax is turned on but no tax rate above 0% is set.' });
  }

  // ---- 1. Line costs -------------------------------------------------------
  const work: LineWork[] = quote.lineItems.map((item) => {
    const label = item.name.trim() || 'Untitled item';
    const quantity = s.num(item.quantity, LIMITS.quantity.min, LIMITS.quantity.max, `Quantity for "${label}"`, item.id);
    const c = item.costs;
    const hours = s.num(c.laborHours, LIMITS.hours.min, LIMITS.hours.max, `Labor hours for "${label}"`, item.id);
    const crew = Math.round(s.num(c.crewSize, LIMITS.crew.min, LIMITS.crew.max, `Crew size for "${label}"`, item.id));
    const laborHoursScaled = c.laborPerUnit
      ? divide(scaled(hours) * BigInt(crew) * scaled(quantity), 10_000n)
      : scaled(hours) * BigInt(crew);
    const laborCost = toSafeNumber(divide(laborHoursScaled * scaled(laborRate), pow10(2 * INPUT_DECIMALS - dec)));
    const money = (v: number, what: string) =>
      toMinor(s.num(v, LIMITS.money.min, LIMITS.money.max, `${what} for "${label}"`, item.id), dec);
    const unitCostTotal = lineAmount(
      quantity,
      s.num(c.unitCost, LIMITS.money.min, LIMITS.money.max, `Unit cost for "${label}"`, item.id),
      dec,
    );
    const materials = money(c.materials, 'Materials');
    const equipment = money(c.equipment, 'Equipment');
    const travel = money(c.travel, 'Travel');
    const other = money(c.other, 'Other cost');
    const directCost = laborCost + unitCostTotal + materials + equipment + travel + other;
    const unitPrice =
      item.visibility === 'internal'
        ? 0
        : s.num(item.unitPrice, LIMITS.money.min, LIMITS.money.max, `Unit price for "${label}"`, item.id);
    const discountPercent = s.num(item.discountPercent, LIMITS.percent.min, LIMITS.percent.max, `Discount for "${label}"`, item.id);
    if (item.visibility === 'included' && quantity === 0) {
      issues.push({ severity: 'warning', code: 'zeroQuantity', message: `"${label}" has a quantity of 0.`, lineId: item.id });
    }
    return {
      item,
      quantity,
      unitPrice,
      discountPercent,
      isAuto: false,
      laborHoursScaled,
      laborCost,
      unitCostTotal,
      unitCostCategory: unitCostBucket(item.category),
      materials,
      equipment,
      travel,
      other,
      directCost,
      gross: 0,
      discount: 0,
      net: 0,
    };
  });

  const costed = work.filter((w) => w.item.visibility !== 'optional');
  const included = work.filter((w) => w.item.visibility === 'included');
  const optional = work.filter((w) => w.item.visibility === 'optional');

  // ---- 2. Direct job cost --------------------------------------------------
  const costs = emptyCosts();
  for (const w of costed) {
    costs.labor += w.laborCost;
    costs.materials += w.materials;
    costs.equipment += w.equipment;
    costs.travel += w.travel;
    costs.other += w.other;
    costs[w.unitCostCategory] += w.unitCostTotal;
  }
  for (const jc of quote.jobCosts.slice(0, LIMITS.jobCosts)) {
    costs[jc.category] += toMinor(
      s.num(jc.amount, LIMITS.money.min, LIMITS.money.max, `Job cost "${jc.label || 'Untitled'}"`),
      dec,
    );
  }
  const extraHours = s.num(quote.extraLaborHours, LIMITS.hours.min, LIMITS.hours.max, 'Extra labor hours');
  const extraCrew = Math.round(s.num(quote.extraLaborCrew, LIMITS.crew.min, LIMITS.crew.max, 'Extra labor crew size'));
  const extraHoursScaled = scaled(extraHours) * BigInt(extraCrew);
  const extraLaborCost = toSafeNumber(divide(extraHoursScaled * scaled(laborRate), pow10(2 * INPUT_DECIMALS - dec)));
  costs.labor += extraLaborCost;
  costs.direct =
    costs.labor + costs.materials + costs.equipment + costs.travel + costs.disposal + costs.subcontractor + costs.other;

  const laborHoursScaled = costed.reduce((a, w) => a + w.laborHoursScaled, 0n) + extraHoursScaled;
  const laborHours = scaledToNumber(laborHoursScaled);

  // ---- 3. Overhead ----------------------------------------------------------
  const oh = quote.pricing.overhead;
  const ohAmount =
    oh.method === 'percentOfDirectCost'
      ? s.num(oh.amount, LIMITS.percent.min, 1_000, 'Overhead percentage')
      : s.num(oh.amount, LIMITS.money.min, LIMITS.money.max, 'Overhead amount');
  /** Variable overhead for a given direct cost and labor time (the fixed per-job amount is added once below). */
  const variableOverhead = (direct: number, hoursScaled: bigint): number => {
    if (oh.method === 'perLaborHour') return toSafeNumber(divide(hoursScaled * scaled(ohAmount), pow10(2 * INPUT_DECIMALS - dec)));
    if (oh.method === 'percentOfDirectCost') return percentOf(direct, ohAmount);
    return 0;
  };
  costs.overhead = oh.method === 'perJob' ? toMinor(ohAmount, dec) : variableOverhead(costs.direct, laborHoursScaled);
  if (oh.method === 'perLaborHour' && laborHoursScaled === 0n && ohAmount > 0) {
    issues.push({
      severity: 'info',
      code: 'overheadNoHours',
      message: 'Overhead is allocated per labor hour, but no labor hours are entered, so no overhead is included.',
    });
  }
  costs.total = costs.direct + costs.overhead;

  // ---- 4. Unit prices --------------------------------------------------------
  const requiredFor = (cost: number): number | null => {
    if (mode === 'targetMargin') return priceForTargetMargin(cost, targetMargin);
    if (mode === 'markup') return priceForMarkup(cost, markup);
    return null;
  };
  /** Ex-tax → customer price basis (tax-inclusive for taxable lines in inclusive mode). */
  const toCustomerBasis = (exTax: number, taxable: boolean) =>
    taxMode === 'inclusive' && taxable ? mulDiv(exTax, factor.num, factor.den, 'ceil') : exTax;
  const toExTax = (amount: number, taxable: boolean) =>
    taxMode === 'inclusive' && taxable ? mulDiv(amount, factor.den, factor.num) : amount;
  const net = (w: LineWork) => {
    const gross = lineAmount(w.quantity, w.unitPrice, dec);
    return gross - percentOf(gross, w.discountPercent);
  };

  if (mode !== 'manual') {
    // If the target was out of range it has been clamped above; never auto-price from a clamped target.
    const targetValid = mode === 'targetMargin' ? targetMargin === p.targetMarginPercent : markup === p.markupPercent;
    const required = targetValid ? requiredFor(costs.total) : null;
    if (required === null) {
      issues.push({
        severity: 'error',
        code: 'invalidTargetMargin',
        message: 'Target margin must be below 100%. Automatic prices are paused until it is fixed.',
      });
    } else {
      const auto = included.filter((w) => w.item.autoPrice && w.quantity > 0);
      const manualRevenue = included
        .filter((w) => !auto.includes(w))
        .reduce((a, w) => a + toExTax(net(w), w.item.taxable), 0);
      const needed = Math.max(0, required - manualRevenue);
      if (auto.length > 0) {
        let weights = auto.map((w) => w.directCost);
        if (weights.every((x) => x === 0)) {
          weights = auto.map((w) => lineAmount(w.quantity, w.unitPrice, dec));
          if (weights.every((x) => x === 0)) weights = auto.map(() => 1);
        } else {
          for (const w of auto) {
            if (w.directCost === 0) {
              issues.push({
                severity: 'warning',
                code: 'autoLineNoCost',
                lineId: w.item.id,
                message: `"${w.item.name.trim() || 'Untitled item'}" has no internal costs, so automatic pricing gives it no price. Add its costs or enter a manual price.`,
              });
            }
          }
        }
        const shares = allocate(needed, weights);
        auto.forEach((w, i) => {
          w.isAuto = true;
          w.unitPrice = autoUnitPrice(toCustomerBasis(shares[i] ?? 0, w.item.taxable), w.quantity, dec);
        });
      }
      for (const w of optional) {
        if (!w.item.autoPrice || w.quantity <= 0) continue;
        w.isAuto = true;
        // Priced so that, if the customer adds it, it carries its own variable overhead at the target.
        const req = requiredFor(w.directCost + variableOverhead(w.directCost, w.laborHoursScaled)) ?? 0;
        w.unitPrice = autoUnitPrice(toCustomerBasis(req, w.item.taxable), w.quantity, dec);
        if (w.directCost === 0) {
          issues.push({
            severity: 'warning',
            code: 'autoLineNoCost',
            lineId: w.item.id,
            message: `Optional item "${w.item.name.trim() || 'Untitled item'}" has no internal costs, so automatic pricing gives it no price.`,
          });
        }
      }
    }
  }

  // ---- 5. Line amounts ---------------------------------------------------------
  for (const w of work) {
    if (w.item.visibility === 'internal') continue;
    w.gross = lineAmount(w.quantity, w.unitPrice, dec);
    w.discount = percentOf(w.gross, w.discountPercent);
    w.net = w.gross - w.discount;
  }

  // ---- 6. Items subtotal --------------------------------------------------------
  const itemsGross = included.reduce((a, w) => a + w.gross, 0);
  const itemDiscounts = included.reduce((a, w) => a + w.discount, 0);
  const itemsSubtotal = included.reduce((a, w) => a + w.net, 0);
  const taxableItems = included.filter((w) => w.item.taxable).reduce((a, w) => a + w.net, 0);
  const anyTaxable = included.some((w) => w.item.taxable);

  // ---- 7. Discount & minimum charge ---------------------------------------------
  const d = quote.discount;
  const discountOf = (base: number): number => {
    if (d.type === 'percent') {
      return percentOf(base, s.num(d.value, LIMITS.percent.min, LIMITS.percent.max, 'Discount percentage'));
    }
    if (d.type === 'fixed') {
      const amount = toMinor(s.num(d.value, LIMITS.money.min, LIMITS.money.max, 'Discount amount'), dec);
      if (amount > base) {
        issues.push({
          severity: 'error',
          code: 'discountExceedsSubtotal',
          message: 'The discount is larger than the subtotal it applies to. It has been limited to the subtotal.',
        });
        return base;
      }
      return amount;
    }
    return 0;
  };
  const share = (amount: number, part: number, whole: number) =>
    whole > 0 ? mulDiv(amount, BigInt(part), BigInt(whole)) : anyTaxable ? amount : 0;

  const minimum = included.length > 0 ? toMinor(s.num(p.minimumCharge, LIMITS.money.min, LIMITS.money.max, 'Minimum job charge'), dec) : 0;
  let discountAmount: number;
  let adjustment: number;
  let compared: number;
  let subtotal: number;
  let taxableAmount: number;
  let discountBase: number;

  if (p.minimumChargeBasis === 'beforeDiscount') {
    compared = itemsSubtotal;
    adjustment = Math.max(0, minimum - itemsSubtotal);
    discountBase = itemsSubtotal + adjustment;
    const baseTaxable = taxableItems + share(adjustment, taxableItems, itemsSubtotal);
    discountAmount = discountOf(discountBase);
    subtotal = discountBase - discountAmount;
    taxableAmount = baseTaxable - (discountBase > 0 ? mulDiv(discountAmount, BigInt(baseTaxable), BigInt(discountBase)) : 0);
  } else {
    discountBase = itemsSubtotal;
    discountAmount = discountOf(itemsSubtotal);
    const afterDiscount = itemsSubtotal - discountAmount;
    const taxableAfterDiscount =
      taxableItems - (itemsSubtotal > 0 ? mulDiv(discountAmount, BigInt(taxableItems), BigInt(itemsSubtotal)) : 0);
    compared = afterDiscount;
    adjustment = Math.max(0, minimum - afterDiscount);
    subtotal = afterDiscount + adjustment;
    taxableAmount = taxableAfterDiscount + share(adjustment, taxableAfterDiscount, afterDiscount);
  }
  if (taxMode === 'none') taxableAmount = 0;
  if (adjustment > 0) {
    issues.push({
      severity: 'info',
      code: 'minimumApplied',
      message: 'The minimum job charge raised this quote above the calculated subtotal.',
    });
  }

  // ---- 8. Tax ------------------------------------------------------------------------
  const taxLines: TaxLine[] = taxComponents.map((c) => ({ id: c.id, name: c.name, ratePercent: c.ratePercent, amount: 0 }));
  let taxTotal = 0;
  if (taxMode === 'exclusive') {
    let running = taxableAmount;
    taxLines.forEach((line, i) => {
      const base = quote.tax.compounding === 'compound' ? running : taxableAmount;
      line.amount = toSafeNumber(divide(BigInt(base) * (ratesPpm[i] ?? 0n), MILLION));
      running += line.amount;
    });
    taxTotal = taxLines.reduce((a, l) => a + l.amount, 0);
  } else if (taxMode === 'inclusive' && taxLines.length > 0) {
    const base = mulDiv(taxableAmount, factor.den, factor.num);
    taxTotal = taxableAmount - base;
    let running = base;
    taxLines.forEach((line, i) => {
      const lineBase = quote.tax.compounding === 'compound' ? running : base;
      line.amount = toSafeNumber(divide(BigInt(lineBase) * (ratesPpm[i] ?? 0n), MILLION));
      running += line.amount;
    });
    // Assign any rounding difference to the largest component so the parts add up exactly.
    const diff = taxTotal - taxLines.reduce((a, l) => a + l.amount, 0);
    if (diff !== 0) {
      let largest = 0;
      ratesPpm.forEach((r, i) => {
        if (r > (ratesPpm[largest] ?? 0n)) largest = i;
      });
      const target = taxLines[largest];
      if (target) target.amount += diff;
    }
  }

  // ---- 9. Total & revenue ---------------------------------------------------------------
  const total = taxMode === 'exclusive' ? subtotal + taxTotal : subtotal;
  const revenueExTax = total - taxTotal;

  // ---- 10. Deposit -------------------------------------------------------------------------
  let depositAmount = 0;
  if (quote.deposit.type === 'percent') {
    depositAmount = percentOf(total, s.num(quote.deposit.value, LIMITS.percent.min, LIMITS.percent.max, 'Deposit percentage'));
  } else if (quote.deposit.type === 'fixed') {
    depositAmount = toMinor(s.num(quote.deposit.value, LIMITS.money.min, LIMITS.money.max, 'Deposit amount'), dec);
    if (depositAmount > total) {
      if (included.length > 0) {
        issues.push({
          severity: 'warning',
          code: 'depositExceedsTotal',
          message: 'The fixed deposit is larger than the quote total, so it has been limited to the total.',
        });
      }
      depositAmount = total;
    }
  }

  // ---- 11. Profit ------------------------------------------------------------------------------
  const directProfit = revenueExTax - costs.direct;
  const profit = revenueExTax - costs.total;
  const marginPercent = ratioPercent(profit, revenueExTax);
  const requiredRevenue = priceForTargetMargin(costs.total, targetMargin);
  if (revenueExTax > 0 && costs.total === 0) {
    issues.push({
      severity: 'info',
      code: 'noCosts',
      message: 'No costs are entered, so estimated profit equals revenue. Add costs for a realistic estimate.',
    });
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  let status: ProfitStatus;
  if (hasErrors) status = 'invalid';
  else if (revenueExTax === 0) status = costs.total > 0 ? 'loss' : 'noRevenue';
  else if (profit < 0) status = 'loss';
  else {
    // Compare the margin as displayed (one decimal place) so rounding never mislabels a quote.
    const shown = Math.round((marginPercent ?? 0) * 10) / 10;
    status = shown >= targetMargin ? 'healthy' : shown >= minimumMargin ? 'belowTarget' : 'lowMargin';
  }

  const perHour = (amount: number) =>
    laborHoursScaled > 0n ? toSafeNumber(divide(BigInt(amount) * 10_000n, laborHoursScaled)) : null;

  const lines: LineResult[] = work.map((w) => {
    const lineRevenue = w.item.visibility === 'internal' ? 0 : toExTax(w.net, w.item.taxable);
    return {
      id: w.item.id,
      visibility: w.item.visibility,
      unitPrice: w.unitPrice,
      isAutoPriced: w.isAuto,
      grossAmount: w.gross,
      discountAmount: w.discount,
      netAmount: w.net,
      laborHours: scaledToNumber(w.laborHoursScaled),
      laborCost: w.laborCost,
      unitCostTotal: w.unitCostTotal,
      unitCostCategory: w.unitCostCategory,
      materials: w.materials,
      equipment: w.equipment,
      travel: w.travel,
      other: w.other,
      directCost: w.directCost,
      directMarginPercent: ratioPercent(lineRevenue - w.directCost, lineRevenue),
    };
  });

  return {
    currency: quote.currency,
    decimals: dec,
    pricingMode: mode,
    lines,
    includedLineCount: included.length,
    itemsGross,
    itemDiscounts,
    itemsSubtotal,
    discount: {
      type: d.type,
      value: d.value,
      reason: d.reason,
      amount: discountAmount,
      percentOfBase: ratioPercent(discountAmount, discountBase),
    },
    minimumCharge: { basis: p.minimumChargeBasis, minimum, comparedSubtotal: compared, adjustment },
    subtotal,
    taxableAmount,
    tax: { mode: taxMode, compounding: quote.tax.compounding, lines: taxLines, total: taxTotal },
    total,
    revenueExTax,
    deposit: { type: quote.deposit.type, value: quote.deposit.value, amount: depositAmount, balance: total - depositAmount },
    optionalItemsTotal: optional.reduce((a, w) => a + w.net, 0),
    costs,
    laborHours,
    extraLaborCost,
    overheadMethod: oh.method,
    profit: {
      directProfit,
      directMarginPercent: ratioPercent(directProfit, revenueExTax),
      profit,
      marginPercent,
      markupPercent: ratioPercent(profit, costs.total),
      effectiveHourlyRate: perHour(revenueExTax),
      profitPerLaborHour: perHour(profit),
    },
    target: {
      targetMarginPercent: targetMargin,
      minimumMarginPercent: minimumMargin,
      requiredRevenue,
      shortfall: requiredRevenue === null ? 0 : Math.max(0, requiredRevenue - revenueExTax),
      status,
    },
    issues,
  };
}
