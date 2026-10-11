/**
 * Creating quotes and templates. Every function returns brand-new objects
 * (deep copies with fresh IDs), so a quote never shares mutable state with
 * the template, preset or quote it came from, and later changes to business
 * defaults never reach back into existing quotes.
 */
import { defaultDisplayOptions } from '../data/defaults';
import { toISODate } from './dates';
import { newId } from './ids';
import type {
  BusinessProfile,
  ISODateTime,
  JobCost,
  LineCosts,
  LineItem,
  PresetItem,
  PricingDefaults,
  Quote,
  QuotePricing,
  QuoteTemplate,
  TaxSettings,
} from './types';

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function emptyLineCosts(crewSize = 1): LineCosts {
  return {
    unitCost: 0,
    laborHours: 0,
    laborPerUnit: false,
    crewSize: Math.max(1, crewSize),
    materials: 0,
    equipment: 0,
    travel: 0,
    other: 0,
  };
}

export function createLineItem(partial: Partial<LineItem> = {}, crewSize = 1): LineItem {
  return {
    id: newId('li'),
    name: '',
    description: '',
    category: 'service',
    quantity: 1,
    unit: 'each',
    customUnit: '',
    unitPrice: 0,
    autoPrice: true,
    discountPercent: 0,
    taxable: true,
    visibility: 'included',
    ...partial,
    costs: { ...emptyLineCosts(crewSize), ...(partial.costs ? clone(partial.costs) : {}) },
  };
}

export function lineFromPreset(item: PresetItem): LineItem {
  return createLineItem({
    name: item.name,
    description: item.description,
    category: item.category,
    unit: item.unit,
    customUnit: item.customUnit,
    quantity: item.defaultQuantity,
    unitPrice: item.unitPrice,
    taxable: item.taxable,
    costs: clone(item.costs),
    autoPrice: false,
  });
}

/** Snapshot of the pricing defaults stored on a quote at creation time. */
export function quotePricingFromDefaults(pricing: PricingDefaults): QuotePricing {
  return {
    mode: pricing.pricingMode,
    targetMarginPercent: pricing.targetMarginPercent,
    markupPercent: pricing.markupPercent,
    minimumMarginPercent: pricing.minimumMarginPercent,
    laborCostPerHour: pricing.laborCostPerHour,
    laborRateBasis: pricing.laborRateBasis,
    defaultCrewSize: pricing.defaultCrewSize,
    overhead: { ...pricing.overhead },
    minimumCharge: pricing.minimumCharge,
    minimumChargeBasis: pricing.minimumChargeBasis,
  };
}

function cloneTax(tax: TaxSettings): TaxSettings {
  return { ...tax, components: tax.components.map((c) => ({ ...c, id: newId('tax') })) };
}

export interface NewQuoteContext {
  business: BusinessProfile;
  pricing: PricingDefaults;
  number: string;
  now: Date;
}

export function createBlankQuote(ctx: NewQuoteContext): Quote {
  const { business, pricing, now } = ctx;
  const timestamp: ISODateTime = now.toISOString();
  const lineItems: LineItem[] = [createLineItem({ autoPrice: pricing.pricingMode !== 'manual' }, pricing.defaultCrewSize)];
  if (pricing.defaultTravelCharge > 0) {
    lineItems.push(
      createLineItem(
        {
          name: 'Travel surcharge',
          category: 'travel',
          unit: 'visit',
          unitPrice: pricing.defaultTravelCharge,
          autoPrice: false,
        },
        pricing.defaultCrewSize,
      ),
    );
  }
  return {
    id: newId('q'),
    number: ctx.number,
    title: '',
    createdDate: toISODate(now),
    validityDays: pricing.validityDays,
    expiryDate: null,
    jobDate: null,
    duration: '',
    tradeType: business.tradeType,
    currency: business.currency,
    customer: {
      name: '',
      company: '',
      email: '',
      phone: '',
      billingAddress: '',
      serviceAddress: '',
      locationNotes: '',
    },
    scopeOfWork: '',
    exclusions: '',
    customerNotes: '',
    internalNotes: '',
    paymentTerms: pricing.paymentTerms,
    acceptanceInstructions: pricing.acceptanceInstructions,
    lineItems,
    jobCosts: [],
    extraLaborHours: 0,
    extraLaborCrew: Math.max(1, pricing.defaultCrewSize),
    pricing: quotePricingFromDefaults(pricing),
    discount: { type: 'none', value: 0, reason: '' },
    deposit: { ...pricing.deposit },
    tax: cloneTax(pricing.tax),
    display: defaultDisplayOptions(pricing.documentTitle),
    sourceTemplateId: null,
    isSample: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function freshLines(items: LineItem[]): LineItem[] {
  return items.map((item) => ({ ...clone(item), id: newId('li') }));
}

function freshJobCosts(costs: JobCost[]): JobCost[] {
  return costs.map((c) => ({ ...c, id: newId('jc') }));
}

export function createQuoteFromTemplate(template: QuoteTemplate, ctx: NewQuoteContext): Quote {
  const quote = createBlankQuote({ ...ctx, pricing: { ...ctx.pricing, defaultTravelCharge: 0 } });
  const autoPrice = ctx.pricing.pricingMode !== 'manual';
  return {
    ...quote,
    title: template.title,
    tradeType: template.tradeType,
    scopeOfWork: template.scopeOfWork,
    exclusions: template.exclusions,
    customerNotes: template.customerNotes,
    paymentTerms: template.paymentTerms.trim() ? template.paymentTerms : quote.paymentTerms,
    // Template lines carry manual prices; in cost-based modes lines with costs switch to automatic pricing.
    lineItems: freshLines(template.lineItems).map((line) => ({
      ...line,
      autoPrice: autoPrice && hasDirectCostInputs(line),
    })),
    jobCosts: freshJobCosts(template.jobCosts),
    deposit: template.deposit ? { ...template.deposit } : quote.deposit,
    sourceTemplateId: template.id,
  };
}

export function duplicateQuote(source: Quote, number: string, now: Date): Quote {
  const timestamp = now.toISOString();
  const copy = clone(source);
  return {
    ...copy,
    id: newId('q'),
    number,
    title: source.title ? `${source.title} (copy)` : '',
    createdDate: toISODate(now),
    expiryDate: null,
    lineItems: freshLines(copy.lineItems),
    jobCosts: freshJobCosts(copy.jobCosts),
    tax: cloneTax(copy.tax),
    isSample: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function templateFromQuote(quote: Quote, name: string, now: Date): QuoteTemplate {
  const timestamp = now.toISOString();
  return {
    id: newId('tpl'),
    name,
    description: quote.scopeOfWork.split('\n')[0]?.slice(0, 160) ?? '',
    kind: 'custom',
    tradeType: quote.tradeType,
    isStarter: false,
    title: quote.title,
    scopeOfWork: quote.scopeOfWork,
    exclusions: quote.exclusions,
    customerNotes: quote.customerNotes,
    paymentTerms: quote.paymentTerms,
    lineItems: freshLines(quote.lineItems).map((l) => ({ ...l, autoPrice: false })),
    jobCosts: freshJobCosts(quote.jobCosts),
    deposit: { ...quote.deposit },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function duplicateTemplate(source: QuoteTemplate, now: Date): QuoteTemplate {
  const timestamp = now.toISOString();
  const copy = clone(source);
  return {
    ...copy,
    id: newId('tpl'),
    name: `${source.name} (copy)`,
    kind: 'custom',
    isStarter: false,
    lineItems: freshLines(copy.lineItems),
    jobCosts: freshJobCosts(copy.jobCosts),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createBlankTemplate(tradeType: QuoteTemplate['tradeType'], now: Date): QuoteTemplate {
  const timestamp = now.toISOString();
  return {
    id: newId('tpl'),
    name: 'New template',
    description: '',
    kind: 'custom',
    tradeType,
    isStarter: false,
    title: '',
    scopeOfWork: '',
    exclusions: '',
    customerNotes: '',
    paymentTerms: '',
    lineItems: [createLineItem({ autoPrice: false })],
    jobCosts: [],
    deposit: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** True when a line has any internal cost input (so automatic pricing can price it). */
export function hasDirectCostInputs(line: LineItem): boolean {
  const c = line.costs;
  return c.unitCost > 0 || c.laborHours > 0 || c.materials > 0 || c.equipment > 0 || c.travel > 0 || c.other > 0;
}

export function formatQuoteNumber(prefix: string, n: number): string {
  return `${prefix}${n}`;
}
