import type { QuoteCalculation } from './calc';
import { hasDirectCostInputs } from './quoteFactory';
import type { PricingMode, Quote } from './types';

/**
 * Switch a quote's pricing mode explicitly (never silently):
 * - to cost-based: lines with internal costs become automatically priced;
 *   lines without costs keep their manual price. If no line has costs, all
 *   priced lines become automatic (spread in proportion to their prices).
 * - to manual: automatic prices are frozen at their current values, so the
 *   customer-facing quote does not change.
 */
export function applyPricingMode(quote: Quote, calc: QuoteCalculation, mode: PricingMode): Quote {
  if (mode === quote.pricing.mode) return quote;
  const results = new Map(calc.lines.map((r) => [r.id, r]));
  let lineItems = quote.lineItems;
  if (mode === 'manual') {
    lineItems = quote.lineItems.map((l) => {
      const r = results.get(l.id);
      return r?.isAutoPriced ? { ...l, unitPrice: r.unitPrice } : l;
    });
  } else if (quote.pricing.mode === 'manual') {
    const priced = quote.lineItems.filter((l) => l.visibility !== 'internal');
    const anyCosts = priced.some(hasDirectCostInputs);
    lineItems = quote.lineItems.map((l) =>
      l.visibility === 'internal' ? l : { ...l, autoPrice: anyCosts ? hasDirectCostInputs(l) : true },
    );
  }
  return { ...quote, lineItems, pricing: { ...quote.pricing, mode } };
}
