import { describe, expect, it } from 'vitest';
import { line, testQuote } from '../test/fixtures';
import { calculateQuote } from './calc';
import { applyPricingMode } from './pricingMode';

describe('applyPricingMode', () => {
  it('switching to target margin auto-prices costed lines and keeps manual prices for the rest', () => {
    const q = testQuote({
      lineItems: [line({ id: 'a', unitPrice: 150, costs: { unitCost: 100 } }), line({ id: 'b', unitPrice: 40 })],
    });
    const next = applyPricingMode(q, calculateQuote(q), 'targetMargin');
    expect(next.pricing.mode).toBe('targetMargin');
    expect(next.lineItems.map((l) => l.autoPrice)).toEqual([true, false]);
    expect(next.lineItems[1]?.unitPrice).toBe(40);
  });

  it('switching back to manual freezes automatic prices so the total does not change', () => {
    const q = { ...testQuote({ lineItems: [line({ autoPrice: true, costs: { unitCost: 100 } })] }) };
    const auto = { ...q, pricing: { ...q.pricing, mode: 'targetMargin' as const } };
    const autoCalc = calculateQuote(auto);
    const manual = applyPricingMode(auto, autoCalc, 'manual');
    expect(manual.lineItems[0]?.unitPrice).toBe(166.67);
    expect(calculateQuote(manual).total).toBe(autoCalc.total);
  });

  it('never changes the original quote object', () => {
    const q = testQuote({ lineItems: [line({ unitPrice: 10, costs: { unitCost: 5 } })] });
    const before = structuredClone(q);
    applyPricingMode(q, calculateQuote(q), 'markup');
    expect(q).toEqual(before);
  });
});
