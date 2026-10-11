import { defaultBusiness, defaultPricing } from '../data/defaults';
import { createBlankQuote, createLineItem } from '../domain/quoteFactory';
import type { LineCosts, LineItem, Quote } from '../domain/types';

export const FIXED_NOW = new Date(2026, 9, 11, 9, 30, 0);

/** A blank USD quote: manual pricing, labor $40/h, no tax, overhead, minimum or deposit. */
export function testQuote(overrides: Partial<Quote> = {}): Quote {
  const pricing = { ...defaultPricing(), laborCostPerHour: 40, targetMarginPercent: 40, minimumMarginPercent: 15 };
  const quote = createBlankQuote({ business: defaultBusiness(), pricing, number: 'Q-1', now: FIXED_NOW });
  return { ...quote, lineItems: [], ...overrides };
}

export function line(partial: Partial<Omit<LineItem, 'costs'>> & { costs?: Partial<LineCosts> } = {}): LineItem {
  const { costs, ...rest } = partial;
  const base = createLineItem({ name: 'Item', autoPrice: false, ...rest });
  return { ...base, costs: { ...base.costs, ...costs } };
}
