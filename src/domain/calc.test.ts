import { describe, expect, it } from 'vitest';
import { line, testQuote } from '../test/fixtures';
import { calculateQuote, priceForMarkup, priceForTargetMargin } from './calc';
import type { Quote, TaxSettings } from './types';

const tax = (mode: TaxSettings['mode'], rates: number[], compounding: TaxSettings['compounding'] = 'independent'): TaxSettings => ({
  mode,
  compounding,
  components: rates.map((r, i) => ({ id: `t${i}`, name: `Tax ${i + 1}`, ratePercent: r })),
});

const withPricing = (q: Quote, patch: Partial<Quote['pricing']>): Quote => ({ ...q, pricing: { ...q.pricing, ...patch } });

describe('calculateQuote — core profitability', () => {
  it('1. basic profitable job', () => {
    const calc = calculateQuote(testQuote({ lineItems: [line({ unitPrice: 500, costs: { unitCost: 200 } })] }));
    expect(calc.total).toBe(50_000);
    expect(calc.revenueExTax).toBe(50_000);
    expect(calc.costs.direct).toBe(20_000);
    expect(calc.costs.other).toBe(20_000); // service lines bucket unit cost under "other direct costs"
    expect(calc.profit.profit).toBe(30_000);
    expect(calc.profit.marginPercent).toBe(60);
    expect(calc.profit.markupPercent).toBe(150);
    expect(calc.target.status).toBe('healthy');
  });

  it('2. labor and materials', () => {
    const calc = calculateQuote(
      testQuote({ lineItems: [line({ unitPrice: 600, costs: { laborHours: 3, crewSize: 2, materials: 85.5 } })] }),
    );
    expect(calc.costs.labor).toBe(24_000); // 3h × 2 crew × $40
    expect(calc.costs.materials).toBe(8_550);
    expect(calc.costs.direct).toBe(32_550);
    expect(calc.profit.profit).toBe(27_450);
    expect(calc.profit.marginPercent).toBe(45.75);
    expect(calc.laborHours).toBe(6);
    expect(calc.profit.effectiveHourlyRate).toBe(10_000); // $600 / 6h
    expect(calc.profit.profitPerLaborHour).toBe(4_575);
  });

  it('2b. per-unit labor hours scale with quantity', () => {
    const calc = calculateQuote(
      testQuote({ lineItems: [line({ quantity: 24, unitPrice: 6, costs: { laborHours: 0.25, laborPerUnit: true, crewSize: 1 } })] }),
    );
    expect(calc.laborHours).toBe(6);
    expect(calc.costs.labor).toBe(24_000);
  });

  it('3. allocated overhead (per job, per labor hour, % of direct cost)', () => {
    const base = testQuote({ lineItems: [line({ unitPrice: 600, costs: { laborHours: 3, crewSize: 2, materials: 85.5 } })] });
    const perJob = calculateQuote(withPricing(base, { overhead: { method: 'perJob', amount: 50 } }));
    expect(perJob.costs.overhead).toBe(5_000);
    expect(perJob.costs.total).toBe(37_550);
    expect(perJob.profit.directProfit).toBe(27_450);
    expect(perJob.profit.profit).toBe(22_450);
    expect(perJob.profit.marginPercent).toBe(37.42);
    expect(perJob.profit.directMarginPercent).toBe(45.75);

    const perHour = calculateQuote(withPricing(base, { overhead: { method: 'perLaborHour', amount: 10 } }));
    expect(perHour.costs.overhead).toBe(6_000); // 6 person-hours × $10

    const pct = calculateQuote(withPricing(base, { overhead: { method: 'percentOfDirectCost', amount: 10 } }));
    expect(pct.costs.overhead).toBe(3_255);
  });

  it('3b. job-level costs and non-billable labor count once, alongside line costs', () => {
    const calc = calculateQuote(
      testQuote({
        lineItems: [line({ unitPrice: 400, costs: { materials: 50 } })],
        jobCosts: [
          { id: 'a', label: 'Dump fee', category: 'disposal', amount: 35 },
          { id: 'b', label: 'Fuel', category: 'travel', amount: 20 },
        ],
        extraLaborHours: 1,
        extraLaborCrew: 2,
      }),
    );
    expect(calc.costs.materials).toBe(5_000);
    expect(calc.costs.disposal).toBe(3_500);
    expect(calc.costs.travel).toBe(2_000);
    expect(calc.costs.labor).toBe(8_000);
    expect(calc.costs.direct).toBe(18_500);
    expect(calc.laborHours).toBe(2);
  });
});

describe('margin vs markup', () => {
  it('4. target gross margin: 40% on a cost of 100 needs 166.67, not 140', () => {
    expect(priceForTargetMargin(10_000, 40)).toBe(16_667);
    const calc = calculateQuote(
      withPricing(testQuote({ lineItems: [line({ autoPrice: true, costs: { unitCost: 100 } })] }), {
        mode: 'targetMargin',
        targetMarginPercent: 40,
      }),
    );
    expect(calc.lines[0]?.isAutoPriced).toBe(true);
    expect(calc.lines[0]?.unitPrice).toBe(166.67);
    expect(calc.total).toBe(16_667);
    expect(calc.profit.marginPercent).toBe(40);
    expect(calc.target.status).toBe('healthy');
  });

  it('5. markup on cost: 40% markup on 100 gives 140', () => {
    expect(priceForMarkup(10_000, 40)).toBe(14_000);
    const calc = calculateQuote(
      withPricing(testQuote({ lineItems: [line({ autoPrice: true, costs: { unitCost: 100 } })] }), {
        mode: 'markup',
        markupPercent: 40,
      }),
    );
    expect(calc.total).toBe(14_000);
    expect(calc.profit.markupPercent).toBe(40);
  });

  it('6. gross margin and markup are different numbers for the same job', () => {
    const calc = calculateQuote(testQuote({ lineItems: [line({ unitPrice: 140, costs: { unitCost: 100 } })] }));
    expect(calc.profit.markupPercent).toBe(40);
    expect(calc.profit.marginPercent).toBe(28.57);
  });

  it('7. manual price below target margin is flagged with the shortfall', () => {
    const calc = calculateQuote(testQuote({ lineItems: [line({ unitPrice: 150, costs: { unitCost: 100 } })] }));
    expect(calc.profit.marginPercent).toBe(33.33);
    expect(calc.target.status).toBe('belowTarget');
    expect(calc.target.requiredRevenue).toBe(16_667);
    expect(calc.target.shortfall).toBe(1_667);
    // Manual prices are never replaced.
    expect(calc.lines[0]?.unitPrice).toBe(150);
    expect(calc.lines[0]?.isAutoPriced).toBe(false);
  });

  it('7b. margin under the minimum acceptable threshold is "lowMargin"', () => {
    const calc = calculateQuote(testQuote({ lineItems: [line({ unitPrice: 110, costs: { unitCost: 100 } })] }));
    expect(calc.profit.marginPercent).toBe(9.09);
    expect(calc.target.status).toBe('lowMargin');
  });
});

describe('automatic (cost-based) pricing', () => {
  it('splits required revenue across auto lines in proportion to their direct cost', () => {
    const calc = calculateQuote(
      withPricing(
        testQuote({
          lineItems: [
            line({ autoPrice: true, costs: { unitCost: 100 } }),
            line({ autoPrice: true, costs: { unitCost: 300 } }),
          ],
        }),
        { mode: 'targetMargin', targetMarginPercent: 50 },
      ),
    );
    expect(calc.lines.map((l) => l.unitPrice)).toEqual([200, 600]);
    expect(calc.profit.marginPercent).toBe(50);
  });

  it('keeps manual overrides and prices auto lines to cover the rest', () => {
    const calc = calculateQuote(
      withPricing(
        testQuote({
          lineItems: [line({ autoPrice: false, unitPrice: 100 }), line({ autoPrice: true, costs: { unitCost: 300 } })],
        }),
        { mode: 'targetMargin', targetMarginPercent: 50 },
      ),
    );
    expect(calc.lines[0]?.unitPrice).toBe(100);
    expect(calc.lines[1]?.unitPrice).toBe(500);
    expect(calc.total).toBe(60_000);
  });

  it('recovers job-level costs and overhead through auto-priced lines', () => {
    const calc = calculateQuote(
      withPricing(
        testQuote({
          lineItems: [line({ autoPrice: true, costs: { unitCost: 100 } })],
          jobCosts: [{ id: 'j', label: 'Dump fee', category: 'disposal', amount: 20 }],
        }),
        { mode: 'targetMargin', targetMarginPercent: 40, overhead: { method: 'perJob', amount: 30 } },
      ),
    );
    expect(calc.costs.total).toBe(15_000);
    expect(calc.total).toBe(25_000);
    expect(calc.profit.marginPercent).toBe(40);
  });

  it('uses sub-cent unit prices only when whole cents would overshoot noticeably', () => {
    const calc = calculateQuote(
      withPricing(
        testQuote({
          lineItems: [
            line({ autoPrice: true, quantity: 1250, unit: 'sqft', costs: { unitCost: 0.05 } }),
            line({ autoPrice: true, quantity: 3, costs: { unitCost: 20 } }),
          ],
        }),
        { mode: 'markup', markupPercent: 150 },
      ),
    );
    // Cost 62.50 + 60.00 = 122.50 → ×2.5 = 306.25 split 156.25 / 150.00.
    expect(calc.lines[0]?.unitPrice).toBe(0.125);
    expect(calc.lines[1]?.unitPrice).toBe(50);
    expect(calc.total).toBe(30_625);
  });

  it('never falls short of the target because of rounding', () => {
    const calc = calculateQuote(
      withPricing(testQuote({ lineItems: [line({ autoPrice: true, quantity: 7, costs: { unitCost: 13.37 } })] }), {
        mode: 'targetMargin',
        targetMarginPercent: 37.5,
      }),
    );
    expect(calc.revenueExTax).toBeGreaterThanOrEqual(calc.target.requiredRevenue ?? Infinity);
    expect(calc.target.status).toBe('healthy');
  });

  it('grosses up auto prices for tax-inclusive pricing so revenue excludes tax', () => {
    const calc = calculateQuote(
      withPricing(
        testQuote({ tax: tax('inclusive', [10]), lineItems: [line({ autoPrice: true, costs: { unitCost: 100 } })] }),
        { mode: 'targetMargin', targetMarginPercent: 50 },
      ),
    );
    expect(calc.lines[0]?.unitPrice).toBe(220);
    expect(calc.total).toBe(22_000);
    expect(calc.tax.total).toBe(2_000);
    expect(calc.revenueExTax).toBe(20_000);
    expect(calc.profit.marginPercent).toBe(50);
  });

  it('prices optional extras from their own cost plus their variable overhead', () => {
    const calc = calculateQuote(
      withPricing(
        testQuote({
          lineItems: [
            line({ unitPrice: 500, costs: { unitCost: 100 } }),
            line({ visibility: 'optional', autoPrice: true, costs: { materials: 20, laborHours: 1, crewSize: 1 } }),
          ],
        }),
        { mode: 'targetMargin', targetMarginPercent: 50, overhead: { method: 'perLaborHour', amount: 20 } },
      ),
    );
    // Direct 20 + labor 40 = 60, plus 1h × $20 overhead = 80 → ÷ (1 − 0.5) = 160.
    expect(calc.lines[1]?.unitPrice).toBe(160);
    expect(calc.total).toBe(calc.lines[0]?.netAmount);
  });

  it('warns when an auto line has no costs while others do', () => {
    const calc = calculateQuote(
      withPricing(
        testQuote({ lineItems: [line({ autoPrice: true, costs: { unitCost: 100 } }), line({ id: 'empty', autoPrice: true })] }),
        { mode: 'targetMargin', targetMarginPercent: 40 },
      ),
    );
    expect(calc.issues.some((i) => i.code === 'autoLineNoCost' && i.lineId === 'empty')).toBe(true);
  });
});

describe('minimum charge and discounts', () => {
  it('8. minimum job charge tops up the subtotal and is shown separately', () => {
    const q = withPricing(testQuote({ lineItems: [line({ unitPrice: 80, costs: { unitCost: 60 } })] }), { minimumCharge: 150 });
    const calc = calculateQuote(q);
    expect(calc.itemsSubtotal).toBe(8_000);
    expect(calc.minimumCharge.comparedSubtotal).toBe(8_000);
    expect(calc.minimumCharge.adjustment).toBe(7_000);
    expect(calc.subtotal).toBe(15_000);
    expect(calc.lines[0]?.unitPrice).toBe(80); // line items are not modified
    expect(calc.profit.marginPercent).toBe(60); // margin recalculated on the minimum
    expect(calc.issues.some((i) => i.code === 'minimumApplied')).toBe(true);
  });

  it('8b. minimum basis: after discount vs before discount', () => {
    const base = testQuote({ lineItems: [line({ unitPrice: 80 })], discount: { type: 'percent', value: 10, reason: '' } });
    const after = calculateQuote(withPricing(base, { minimumCharge: 150, minimumChargeBasis: 'afterDiscount' }));
    expect(after.discount.amount).toBe(800);
    expect(after.minimumCharge.adjustment).toBe(7_800);
    expect(after.subtotal).toBe(15_000);
    const before = calculateQuote(withPricing(base, { minimumCharge: 150, minimumChargeBasis: 'beforeDiscount' }));
    expect(before.minimumCharge.adjustment).toBe(7_000);
    expect(before.discount.amount).toBe(1_500);
    expect(before.subtotal).toBe(13_500);
  });

  it('8c. no minimum charge on a quote without items', () => {
    const calc = calculateQuote(withPricing(testQuote(), { minimumCharge: 150 }));
    expect(calc.total).toBe(0);
    expect(calc.minimumCharge.adjustment).toBe(0);
  });

  it('9. fixed discount', () => {
    const calc = calculateQuote(testQuote({ lineItems: [line({ unitPrice: 500 })], discount: { type: 'fixed', value: 50, reason: 'Repeat customer' } }));
    expect(calc.discount.amount).toBe(5_000);
    expect(calc.subtotal).toBe(45_000);
    expect(calc.discount.percentOfBase).toBe(10);
  });

  it('9b. a fixed discount larger than the subtotal is limited and flagged', () => {
    const calc = calculateQuote(testQuote({ lineItems: [line({ unitPrice: 500 })], discount: { type: 'fixed', value: 600, reason: '' } }));
    expect(calc.discount.amount).toBe(50_000);
    expect(calc.total).toBe(0);
    expect(calc.issues.some((i) => i.code === 'discountExceedsSubtotal')).toBe(true);
    expect(calc.target.status).toBe('invalid');
  });

  it('10. percentage discount, rounded half-up once', () => {
    const calc = calculateQuote(testQuote({ lineItems: [line({ unitPrice: 333.33 })], discount: { type: 'percent', value: 12.5, reason: '' } }));
    expect(calc.discount.amount).toBe(4_167); // 41.66625 → 41.67
    expect(calc.subtotal).toBe(29_166);
  });

  it('10b. item-specific discount applies once, before the quote discount', () => {
    const calc = calculateQuote(
      testQuote({
        lineItems: [line({ unitPrice: 200, discountPercent: 25 }), line({ unitPrice: 100 })],
        discount: { type: 'percent', value: 10, reason: '' },
      }),
    );
    expect(calc.itemsGross).toBe(30_000);
    expect(calc.itemDiscounts).toBe(5_000);
    expect(calc.itemsSubtotal).toBe(25_000);
    expect(calc.discount.amount).toBe(2_500);
    expect(calc.total).toBe(22_500);
  });
});

describe('tax', () => {
  it('11. tax-exclusive pricing adds tax after discounts', () => {
    const calc = calculateQuote(
      testQuote({ tax: tax('exclusive', [8.875]), lineItems: [line({ unitPrice: 500 })], discount: { type: 'fixed', value: 50, reason: '' } }),
    );
    expect(calc.subtotal).toBe(45_000);
    expect(calc.tax.total).toBe(3_994); // 39.9375 → 39.94
    expect(calc.total).toBe(48_994);
    expect(calc.revenueExTax).toBe(45_000);
  });

  it('11b. multiple components: independent vs compound', () => {
    const independent = calculateQuote(testQuote({ tax: tax('exclusive', [5, 7]), lineItems: [line({ unitPrice: 100 })] }));
    expect(independent.tax.lines.map((l) => l.amount)).toEqual([500, 700]);
    expect(independent.total).toBe(11_200);
    const compound = calculateQuote(testQuote({ tax: tax('exclusive', [5, 7], 'compound'), lineItems: [line({ unitPrice: 100 })] }));
    expect(compound.tax.lines.map((l) => l.amount)).toEqual([500, 735]);
    expect(compound.total).toBe(11_235);
  });

  it('12. tax-inclusive pricing extracts tax instead of adding it', () => {
    const calc = calculateQuote(testQuote({ tax: tax('inclusive', [15]), lineItems: [line({ unitPrice: 115 })] }));
    expect(calc.total).toBe(11_500);
    expect(calc.tax.total).toBe(1_500);
    expect(calc.revenueExTax).toBe(10_000);

    const rounded = calculateQuote(testQuote({ tax: tax('inclusive', [15]), lineItems: [line({ unitPrice: 100 })] }));
    expect(rounded.total).toBe(10_000);
    expect(rounded.tax.total).toBe(1_304);
    expect(rounded.revenueExTax).toBe(8_696);

    const multi = calculateQuote(testQuote({ tax: tax('inclusive', [5, 7]), lineItems: [line({ unitPrice: 112 })] }));
    expect(multi.tax.lines.map((l) => l.amount)).toEqual([500, 700]);
    expect(multi.revenueExTax).toBe(10_000);
  });

  it('13. taxable and non-taxable items, with the discount shared proportionally', () => {
    const items = [line({ unitPrice: 300, taxable: true }), line({ unitPrice: 100, taxable: false })];
    const plain = calculateQuote(testQuote({ tax: tax('exclusive', [10]), lineItems: items }));
    expect(plain.taxableAmount).toBe(30_000);
    expect(plain.tax.total).toBe(3_000);
    expect(plain.total).toBe(43_000);
    const discounted = calculateQuote(
      testQuote({ tax: tax('exclusive', [10]), lineItems: items, discount: { type: 'percent', value: 10, reason: '' } }),
    );
    expect(discounted.taxableAmount).toBe(27_000);
    expect(discounted.tax.total).toBe(2_700);
    expect(discounted.total).toBe(38_700);
  });

  it('collected tax is never counted as revenue or profit', () => {
    const calc = calculateQuote(testQuote({ tax: tax('exclusive', [20]), lineItems: [line({ unitPrice: 100, costs: { unitCost: 50 } })] }));
    expect(calc.total).toBe(12_000);
    expect(calc.revenueExTax).toBe(10_000);
    expect(calc.profit.profit).toBe(5_000);
  });
});

describe('deposit', () => {
  it('14. percentage deposit and remaining balance always add up to the total', () => {
    const calc = calculateQuote(
      testQuote({
        tax: tax('exclusive', [8.875]),
        lineItems: [line({ unitPrice: 450 })],
        deposit: { type: 'percent', value: 25 },
      }),
    );
    expect(calc.total).toBe(48_994);
    expect(calc.deposit.amount).toBe(12_249); // 122.485 → 122.49
    expect(calc.deposit.balance).toBe(36_745);
    expect(calc.deposit.amount + calc.deposit.balance).toBe(calc.total);
    expect(calc.revenueExTax).toBe(45_000); // the deposit is not extra revenue
  });

  it('14b. fixed deposit above the total is limited to the total', () => {
    const calc = calculateQuote(testQuote({ lineItems: [line({ unitPrice: 100 })], deposit: { type: 'fixed', value: 250 } }));
    expect(calc.deposit.amount).toBe(10_000);
    expect(calc.deposit.balance).toBe(0);
    expect(calc.issues.some((i) => i.code === 'depositExceedsTotal')).toBe(true);
  });
});

describe('edge cases', () => {
  it('15. zero-cost job', () => {
    const calc = calculateQuote(testQuote({ lineItems: [line({ unitPrice: 200 })] }));
    expect(calc.profit.profit).toBe(20_000);
    expect(calc.profit.marginPercent).toBe(100);
    expect(calc.profit.markupPercent).toBeNull(); // undefined with no cost — no division by zero
    expect(calc.profit.effectiveHourlyRate).toBeNull();
    expect(calc.issues.some((i) => i.code === 'noCosts')).toBe(true);
  });

  it('16. negative-profit job', () => {
    const calc = calculateQuote(testQuote({ lineItems: [line({ unitPrice: 100, costs: { unitCost: 150 } })] }));
    expect(calc.profit.profit).toBe(-5_000);
    expect(calc.profit.marginPercent).toBe(-50);
    expect(calc.target.status).toBe('loss');
  });

  it('17. empty quote', () => {
    const calc = calculateQuote(testQuote());
    expect(calc.total).toBe(0);
    expect(calc.profit.marginPercent).toBeNull();
    expect(calc.profit.markupPercent).toBeNull();
    expect(calc.target.status).toBe('noRevenue');
    expect(calc.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('17b. costs but no price is a loss, not "no revenue"', () => {
    const calc = calculateQuote(testQuote({ lineItems: [line({ unitPrice: 0, costs: { materials: 40 } })] }));
    expect(calc.target.status).toBe('loss');
  });

  it('18. impossible target margins are rejected', () => {
    expect(priceForTargetMargin(10_000, 100)).toBeNull();
    expect(priceForTargetMargin(10_000, 150)).toBeNull();
    const calc = calculateQuote(
      withPricing(testQuote({ lineItems: [line({ autoPrice: true, unitPrice: 75, costs: { unitCost: 50 } })] }), {
        mode: 'targetMargin',
        targetMarginPercent: 100,
      }),
    );
    expect(calc.issues.some((i) => i.severity === 'error')).toBe(true);
    expect(calc.target.status).toBe('invalid');
  });

  it('18b. invalid numbers from untrusted data do not crash the engine', () => {
    const calc = calculateQuote(testQuote({ lineItems: [line({ unitPrice: Number.NaN, quantity: -3 })] }));
    expect(calc.total).toBe(0);
    expect(calc.target.status).toBe('invalid');
  });

  it('19. decimal rounding uses exact arithmetic (no 0.1 + 0.2 drift)', () => {
    const calc = calculateQuote(
      testQuote({ lineItems: [line({ unitPrice: 0.1 }), line({ unitPrice: 0.2 }), line({ quantity: 3, unitPrice: 19.99 })] }),
    );
    expect(calc.total).toBe(6_027);
    const halfUp = calculateQuote(testQuote({ lineItems: [line({ unitPrice: 1.005 })] }));
    expect(halfUp.total).toBe(101); // 1.005 rounds half-up to 1.01, not float-truncated to 1.00
    const fractional = calculateQuote(testQuote({ lineItems: [line({ quantity: 2.5, unitPrice: 33.333 })] }));
    expect(fractional.total).toBe(8_333);
  });

  it('19b. zero-decimal currencies round to whole units', () => {
    const calc = calculateQuote(testQuote({ currency: 'JPY', lineItems: [line({ unitPrice: 1234.5 })] }));
    expect(calc.decimals).toBe(0);
    expect(calc.total).toBe(1235);
  });

  it('optional items are shown separately and excluded from totals and costs', () => {
    const calc = calculateQuote(
      testQuote({
        lineItems: [
          line({ unitPrice: 300, costs: { unitCost: 100 } }),
          line({ unitPrice: 80, visibility: 'optional', costs: { unitCost: 30 } }),
          line({ unitPrice: 999, visibility: 'internal', costs: { materials: 25 } }),
        ],
      }),
    );
    expect(calc.total).toBe(30_000);
    expect(calc.optionalItemsTotal).toBe(8_000);
    expect(calc.costs.direct).toBe(12_500); // internal line cost counts, optional does not
    expect(calc.lines[2]?.netAmount).toBe(0);
  });

  it('amounts beyond the supported range fail safely', () => {
    const calc = calculateQuote(
      testQuote({ lineItems: Array.from({ length: 150 }, () => line({ quantity: 1_000_000, unitPrice: 10_000_000 })) }),
    );
    expect(calc.target.status).toBe('invalid');
    expect(calc.issues[0]?.code).toBe('outOfRange');
  });
});
