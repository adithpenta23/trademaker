import { calculateQuote, type QuoteCalculation } from '../../domain/calc';
import { createBlankQuote } from '../../domain/quoteFactory';
import type { BusinessProfile, JobCost, LineItem, PricingDefaults } from '../../domain/types';

/** Run the engine over template/preset lines (manual prices, current defaults) to show amounts and costs. */
export function previewCalc(lineItems: LineItem[], jobCosts: JobCost[], business: BusinessProfile, pricing: PricingDefaults): QuoteCalculation {
  const quote = createBlankQuote({ business, pricing: { ...pricing, pricingMode: 'manual', defaultTravelCharge: 0 }, number: '', now: new Date(0) });
  return calculateQuote({ ...quote, lineItems, jobCosts, pricing: { ...quote.pricing, minimumCharge: 0 } });
}
