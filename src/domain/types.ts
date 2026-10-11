/**
 * Domain types for TradeMaker.
 *
 * Conventions
 * - Money *inputs* are stored as decimal numbers in major currency units
 *   (e.g. 12.5 = $12.50), limited to 4 decimal places. The calculation engine
 *   converts them to integer minor units (cents) before doing any arithmetic.
 * - Percentages are stored as percent values (12.5 = 12.5%), max 4 decimals.
 * - Derived totals are never stored; they are always computed by `calculateQuote`.
 * - Dates are ISO calendar dates (`YYYY-MM-DD`); timestamps are ISO strings.
 */

export type ID = string;
export type ISODate = string;
export type ISODateTime = string;
export type CurrencyCode = string;

export const TRADE_TYPES = ['pressureWashing', 'painting', 'windowCleaning', 'landscaping', 'other'] as const;
export type TradeType = (typeof TRADE_TYPES)[number];

/** Category of a line item, as the owner organises the quote. */
export const LINE_CATEGORIES = [
  'service',
  'labor',
  'materials',
  'equipment',
  'travel',
  'disposal',
  'subcontractor',
  'other',
] as const;
export type LineCategory = (typeof LINE_CATEGORIES)[number];

/** Buckets used to report estimated direct job costs. */
export const COST_CATEGORIES = [
  'labor',
  'materials',
  'equipment',
  'travel',
  'disposal',
  'subcontractor',
  'other',
] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

export const UNIT_CODES = [
  'each',
  'hour',
  'day',
  'sqft',
  'sqm',
  'lft',
  'lm',
  'room',
  'visit',
  'load',
  'lot',
  'custom',
] as const;
export type UnitCode = (typeof UNIT_CODES)[number];

/**
 * - `included`: shown to the customer and counted in the quote total.
 * - `optional`: shown to the customer as an optional extra; NOT counted in the
 *   total and its costs are not counted in job cost.
 * - `internal`: never shown to the customer and has no price; its costs ARE
 *   counted in the job cost (e.g. setup time, consumables you don't itemise).
 */
export const LINE_VISIBILITIES = ['included', 'optional', 'internal'] as const;
export type LineVisibility = (typeof LINE_VISIBILITIES)[number];

/** Internal (never customer-facing) cost estimate for a single line item. */
export interface LineCosts {
  /** Direct cost per unit, multiplied by quantity. Bucketed by the line's category. */
  unitCost: number;
  /** Hours on site. Labor cost = hours × crew × labor cost rate (× quantity when `laborPerUnit`). */
  laborHours: number;
  /** When true, `laborHours` is per unit and is multiplied by the quantity. */
  laborPerUnit: boolean;
  /** Number of people working those hours. */
  crewSize: number;
  /** Total materials & consumables for this line. */
  materials: number;
  /** Total equipment rental/usage for this line. */
  equipment: number;
  /** Total travel & fuel attributable to this line. */
  travel: number;
  /** Any other direct cost for this line. */
  other: number;
}

export interface LineItem {
  id: ID;
  name: string;
  description: string;
  category: LineCategory;
  quantity: number;
  unit: UnitCode;
  /** Label used when `unit` is `custom`. */
  customUnit: string;
  /**
   * Customer-facing price per unit. In cost-based pricing modes this is the
   * owner's manual price and is used only when `autoPrice` is false.
   */
  unitPrice: number;
  /** In cost-based pricing modes, derive the price from costs instead of `unitPrice`. */
  autoPrice: boolean;
  /** Optional item-specific discount, percent of this line's amount. */
  discountPercent: number;
  taxable: boolean;
  visibility: LineVisibility;
  costs: LineCosts;
}

/** A quote-level internal cost not tied to a specific line item. */
export interface JobCost {
  id: ID;
  label: string;
  category: CostCategory;
  amount: number;
}

export const PRICING_MODES = ['manual', 'targetMargin', 'markup'] as const;
export type PricingMode = (typeof PRICING_MODES)[number];

/**
 * Overhead allocation. Percentage-of-revenue is deliberately not offered:
 * it would make price depend on overhead and overhead depend on price.
 * - `perJob`: fixed amount added to every job.
 * - `perLaborHour`: amount × total labor person-hours on the job.
 * - `percentOfDirectCost`: percent × total direct job cost.
 */
export const OVERHEAD_METHODS = ['none', 'perJob', 'perLaborHour', 'percentOfDirectCost'] as const;
export type OverheadMethod = (typeof OVERHEAD_METHODS)[number];

export interface OverheadSettings {
  method: OverheadMethod;
  /** Currency amount (perJob, perLaborHour) or percent (percentOfDirectCost). */
  amount: number;
}

/** `burdened` = wages plus payroll taxes, insurance, benefits. `wages` = wages only. */
export type LaborRateBasis = 'burdened' | 'wages';

/** Which subtotal the minimum job charge is compared against. */
export type MinimumChargeBasis = 'afterDiscount' | 'beforeDiscount';

export interface QuotePricing {
  mode: PricingMode;
  targetMarginPercent: number;
  markupPercent: number;
  /** Margins below this are flagged red (amber between this and the target). */
  minimumMarginPercent: number;
  laborCostPerHour: number;
  laborRateBasis: LaborRateBasis;
  defaultCrewSize: number;
  overhead: OverheadSettings;
  minimumCharge: number;
  minimumChargeBasis: MinimumChargeBasis;
}

export type DiscountType = 'none' | 'percent' | 'fixed';
export interface Discount {
  type: DiscountType;
  /** Percent (for `percent`) or currency amount (for `fixed`). */
  value: number;
  reason: string;
}

export type DepositType = 'none' | 'percent' | 'fixed';
export interface DepositSettings {
  type: DepositType;
  value: number;
}

export type TaxMode = 'none' | 'exclusive' | 'inclusive';
/**
 * - `independent`: every component is a percentage of the same taxable base.
 * - `compound`: each component is applied to the base plus all earlier components.
 */
export type TaxCompounding = 'independent' | 'compound';

export interface TaxComponent {
  id: ID;
  name: string;
  ratePercent: number;
}

export interface TaxSettings {
  mode: TaxMode;
  components: TaxComponent[];
  compounding: TaxCompounding;
}

/** Customer-facing sections the owner can switch on or off per quote. */
export interface QuoteDisplayOptions {
  documentTitle: string;
  showScope: boolean;
  showLineDescriptions: boolean;
  showQuantities: boolean;
  showExclusions: boolean;
  showNotes: boolean;
  showPaymentTerms: boolean;
  showAcceptance: boolean;
  showSignature: boolean;
  showTaxBreakdown: boolean;
}

export interface Customer {
  name: string;
  company: string;
  email: string;
  phone: string;
  billingAddress: string;
  serviceAddress: string;
  /** Internal notes about the site (access, parking, gate codes). Not printed. */
  locationNotes: string;
}

export interface Quote {
  id: ID;
  number: string;
  title: string;
  createdDate: ISODate;
  validityDays: number;
  /** Explicit expiry date. When null the expiry is createdDate + validityDays. */
  expiryDate: ISODate | null;
  jobDate: ISODate | null;
  duration: string;
  tradeType: TradeType;
  currency: CurrencyCode;
  customer: Customer;
  scopeOfWork: string;
  exclusions: string;
  customerNotes: string;
  internalNotes: string;
  paymentTerms: string;
  acceptanceInstructions: string;
  lineItems: LineItem[];
  jobCosts: JobCost[];
  /** Non-billable labor not tied to a line: setup, travel time, cleanup. */
  extraLaborHours: number;
  extraLaborCrew: number;
  pricing: QuotePricing;
  discount: Discount;
  deposit: DepositSettings;
  tax: TaxSettings;
  display: QuoteDisplayOptions;
  sourceTemplateId: ID | null;
  isSample: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type TemplateKind = 'standard' | 'detailed' | 'premium' | 'custom';

export interface QuoteTemplate {
  id: ID;
  name: string;
  description: string;
  kind: TemplateKind;
  tradeType: TradeType;
  /** Starter templates can be reset to their original definition but not deleted. */
  isStarter: boolean;
  title: string;
  scopeOfWork: string;
  exclusions: string;
  customerNotes: string;
  /** Empty string = use the business default payment terms. */
  paymentTerms: string;
  lineItems: LineItem[];
  jobCosts: JobCost[];
  /** Null = use the business default deposit. */
  deposit: DepositSettings | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** A reusable item in a trade's item library. */
export interface PresetItem {
  id: ID;
  name: string;
  description: string;
  category: LineCategory;
  unit: UnitCode;
  customUnit: string;
  defaultQuantity: number;
  unitPrice: number;
  taxable: boolean;
  costs: LineCosts;
}

/** Example pricing values a trade preset can apply to pricing settings. */
export interface PresetPricingExample {
  laborCostPerHour: number;
  defaultCrewSize: number;
  targetMarginPercent: number;
  minimumCharge: number;
  overhead: OverheadSettings;
}

export interface TradePreset {
  tradeType: TradeType;
  label: string;
  description: string;
  items: PresetItem[];
  pricingExample: PresetPricingExample;
}

export type DateFormat = 'locale' | 'dmy' | 'mdy' | 'ymd';
export type PaperSize = 'auto' | 'a4' | 'letter';

export interface BusinessProfile {
  name: string;
  tradeType: TradeType;
  region: string;
  currency: CurrencyCode;
  locale: string;
  dateFormat: DateFormat;
  email: string;
  phone: string;
  website: string;
  address: string;
  /** PNG/JPEG/WEBP data URL, normalised client-side. Never uploaded anywhere. */
  logoDataUrl: string | null;
  brandColor: string;
  quoteFooter: string;
  paperSize: PaperSize;
}

export interface PricingDefaults {
  laborCostPerHour: number;
  laborRateBasis: LaborRateBasis;
  defaultCrewSize: number;
  pricingMode: PricingMode;
  targetMarginPercent: number;
  markupPercent: number;
  minimumMarginPercent: number;
  minimumCharge: number;
  minimumChargeBasis: MinimumChargeBasis;
  overhead: OverheadSettings;
  /** When above zero, new blank quotes start with a travel surcharge line at this price. */
  defaultTravelCharge: number;
  tax: TaxSettings;
  defaultDiscountType: 'percent' | 'fixed';
  /** Warn when a quote discount exceeds this percent of the subtotal. 0 = never warn. */
  discountWarningPercent: number;
  deposit: DepositSettings;
  validityDays: number;
  paymentTerms: string;
  acceptanceInstructions: string;
  documentTitle: string;
  quoteNumberPrefix: string;
  nextQuoteNumber: number;
}

/** Everything that lives in memory for the current browser session. */
export interface SessionData {
  business: BusinessProfile;
  pricing: PricingDefaults;
  quotes: Quote[];
  templates: QuoteTemplate[];
  presets: TradePreset[];
  /** True when the session currently holds the fictional demo business. */
  isSampleSession: boolean;
}
