/**
 * Versioned JSON backup format and safe import.
 *
 * Imports are treated as untrusted: size-limited, parsed with JSON.parse
 * (never evaluated), migrated by schema version, then rebuilt field-by-field
 * through validators with range checks. Nothing in a file is executed and no
 * file is ever uploaded anywhere.
 */
import { isValidCurrencyCode } from '../domain/currency';
import { isISODate } from '../domain/dates';
import { newId } from '../domain/ids';
import { LIMITS } from '../domain/limits';
import {
  COST_CATEGORIES,
  LINE_CATEGORIES,
  LINE_VISIBILITIES,
  OVERHEAD_METHODS,
  PRICING_MODES,
  TRADE_TYPES,
  UNIT_CODES,
  type BusinessProfile,
  type Customer,
  type DepositSettings,
  type Discount,
  type JobCost,
  type LineCosts,
  type LineItem,
  type OverheadSettings,
  type PresetItem,
  type PresetPricingExample,
  type PricingDefaults,
  type Quote,
  type QuoteDisplayOptions,
  type QuotePricing,
  type QuoteTemplate,
  type SessionData,
  type TaxComponent,
  type TaxSettings,
  type TradePreset,
} from '../domain/types';
import {
  ValidationError,
  arrayOf,
  bool,
  nullable,
  num,
  object,
  oneOf,
  optional,
  str,
  uniqueIds,
  withDefault,
  type Validator,
} from './validate';

export const BACKUP_FORMAT = 'trademaker-backup';
export const SCHEMA_VERSION = 1;
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_LOGO_CHARS = 1_500_000;

export type BackupKind = 'full' | 'quotes' | 'quote';

export interface BackupData {
  business?: BusinessProfile;
  pricing?: PricingDefaults;
  presets?: TradePreset[];
  templates?: QuoteTemplate[];
  quotes: Quote[];
  isSampleSession?: boolean;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  kind: BackupKind;
  exportedAt: string;
  data: BackupData;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function buildBackup(kind: BackupKind, session: SessionData, now: Date, quoteIds?: readonly string[]): BackupFile {
  const quotes = quoteIds ? session.quotes.filter((q) => quoteIds.includes(q.id)) : session.quotes;
  const data: BackupData =
    kind === 'full'
      ? {
          business: session.business,
          pricing: session.pricing,
          presets: session.presets,
          templates: session.templates,
          quotes,
          isSampleSession: session.isSampleSession,
        }
      : kind === 'quotes'
        ? { templates: session.templates, quotes }
        : { quotes };
  return { format: BACKUP_FORMAT, schemaVersion: SCHEMA_VERSION, kind, exportedAt: now.toISOString(), data };
}

export function serializeBackup(file: BackupFile): string {
  return JSON.stringify(file, null, 2);
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .slice(0, 40) || 'trademaker'
  );
}

export function backupFileName(kind: BackupKind, label: string, now: Date): string {
  const stamp = now.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const what = kind === 'full' ? 'full-backup' : kind === 'quotes' ? 'quotes-and-templates' : 'quote';
  return `${slug(label)}-${what}-${stamp}.json`;
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const ID = str({ max: 64, pattern: /^[A-Za-z0-9_-]+$/, patternMessage: 'is not a valid ID', nonEmpty: true });
const shortText = str({ max: LIMITS.shortText });
const longText = str({ max: LIMITS.longText });
const money = num(LIMITS.money.min, LIMITS.money.max);
const percent = num(LIMITS.percent.min, LIMITS.percent.max);
const isoDate: Validator<string> = (value, path) => {
  if (!isISODate(value)) throw new ValidationError(path, 'must be a date in YYYY-MM-DD format');
  return value;
};
const timestamp: Validator<string> = (value, path) => {
  if (typeof value !== 'string' || value.length > 40 || Number.isNaN(Date.parse(value))) {
    throw new ValidationError(path, 'must be a date-time');
  }
  return value;
};
const currency: Validator<string> = (value, path) => {
  if (typeof value !== 'string' || !isValidCurrencyCode(value)) throw new ValidationError(path, 'must be a 3-letter currency code such as USD');
  return value;
};
const locale: Validator<string> = (value, path) => {
  if (typeof value !== 'string' || value.length > 35) throw new ValidationError(path, 'must be a locale such as en-US');
  try {
    const [canonical] = Intl.getCanonicalLocales(value);
    if (!canonical) throw new Error('empty');
    return canonical;
  } catch {
    throw new ValidationError(path, 'must be a locale such as en-US');
  }
};
const hexColor = str({ max: 7, pattern: /^#[0-9a-fA-F]{6}$/, patternMessage: 'must be a colour like #16845B' });
const logo: Validator<string> = (value, path) => {
  if (typeof value !== 'string' || value.length > MAX_LOGO_CHARS) throw new ValidationError(path, 'logo image is missing or too large');
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)) {
    throw new ValidationError(path, 'logo must be an embedded PNG, JPEG or WebP image');
  }
  return value;
};

const lineCosts = object<LineCosts>({
  unitCost: money,
  laborHours: num(LIMITS.hours.min, LIMITS.hours.max),
  laborPerUnit: withDefault(bool, () => false),
  crewSize: num(LIMITS.crew.min, LIMITS.crew.max, { integer: true }),
  materials: money,
  equipment: money,
  travel: money,
  other: money,
});

const lineItem = object<LineItem>({
  id: ID,
  name: shortText,
  description: longText,
  category: oneOf(LINE_CATEGORIES),
  quantity: num(LIMITS.quantity.min, LIMITS.quantity.max),
  unit: oneOf(UNIT_CODES),
  customUnit: str({ max: 24 }),
  unitPrice: money,
  autoPrice: bool,
  discountPercent: percent,
  taxable: bool,
  visibility: oneOf(LINE_VISIBILITIES),
  costs: lineCosts,
});
const lineItems = uniqueIds(arrayOf(lineItem, LIMITS.lineItems), 'line item');

const jobCost = object<JobCost>({ id: ID, label: shortText, category: oneOf(COST_CATEGORIES), amount: money });
const jobCosts = uniqueIds(arrayOf(jobCost, LIMITS.jobCosts), 'job cost');

const overhead = object<OverheadSettings>({ method: oneOf(OVERHEAD_METHODS), amount: num(0, LIMITS.money.max) });
const deposit = object<DepositSettings>({ type: oneOf(['none', 'percent', 'fixed'] as const), value: money });
const taxComponent = object<TaxComponent>({ id: ID, name: str({ max: 60 }), ratePercent: percent });
const tax = object<TaxSettings>({
  mode: oneOf(['none', 'exclusive', 'inclusive'] as const),
  components: uniqueIds(arrayOf(taxComponent, LIMITS.taxComponents), 'tax'),
  compounding: oneOf(['independent', 'compound'] as const),
});

const quotePricing = object<QuotePricing>({
  mode: oneOf(PRICING_MODES),
  targetMarginPercent: num(LIMITS.targetMargin.min, LIMITS.targetMargin.max),
  markupPercent: num(LIMITS.markup.min, LIMITS.markup.max),
  minimumMarginPercent: num(-100, LIMITS.targetMargin.max),
  laborCostPerHour: money,
  laborRateBasis: oneOf(['burdened', 'wages'] as const),
  defaultCrewSize: num(LIMITS.crew.min, LIMITS.crew.max, { integer: true }),
  overhead,
  minimumCharge: money,
  minimumChargeBasis: oneOf(['afterDiscount', 'beforeDiscount'] as const),
});

const display = object<QuoteDisplayOptions>({
  documentTitle: str({ max: 40 }),
  showScope: bool,
  showLineDescriptions: bool,
  showQuantities: bool,
  showExclusions: bool,
  showNotes: bool,
  showPaymentTerms: bool,
  showAcceptance: bool,
  showSignature: bool,
  showTaxBreakdown: bool,
});

const customer = object<Customer>({
  name: shortText,
  company: shortText,
  email: str({ max: 254 }),
  phone: str({ max: 60 }),
  billingAddress: str({ max: 1_000 }),
  serviceAddress: str({ max: 1_000 }),
  locationNotes: str({ max: 2_000 }),
});

const discount = object<Discount>({ type: oneOf(['none', 'percent', 'fixed'] as const), value: money, reason: shortText });

const quote: Validator<Quote> = (value, path) => {
  const q = object<Quote>({
    id: ID,
    number: str({ max: 40 }),
    title: shortText,
    createdDate: isoDate,
    validityDays: num(LIMITS.validityDays.min, LIMITS.validityDays.max, { integer: true }),
    expiryDate: nullable(isoDate),
    jobDate: nullable(isoDate),
    duration: str({ max: 80 }),
    tradeType: oneOf(TRADE_TYPES),
    currency,
    customer,
    scopeOfWork: longText,
    exclusions: longText,
    customerNotes: longText,
    internalNotes: longText,
    paymentTerms: longText,
    acceptanceInstructions: longText,
    lineItems,
    jobCosts,
    extraLaborHours: num(LIMITS.hours.min, LIMITS.hours.max),
    extraLaborCrew: num(LIMITS.crew.min, LIMITS.crew.max, { integer: true }),
    pricing: quotePricing,
    discount,
    deposit,
    tax,
    display,
    sourceTemplateId: nullable(ID),
    isSample: bool,
    createdAt: timestamp,
    updatedAt: timestamp,
  })(value, path);
  if (q.deposit.type === 'percent' && q.deposit.value > 100) throw new ValidationError(`${path}.deposit.value`, 'must be 100% or less');
  if (q.discount.type === 'percent' && q.discount.value > 100) throw new ValidationError(`${path}.discount.value`, 'must be 100% or less');
  return q;
};

const template = object<QuoteTemplate>({
  id: ID,
  name: shortText,
  description: str({ max: 1_000 }),
  kind: oneOf(['standard', 'detailed', 'premium', 'custom'] as const),
  tradeType: oneOf(TRADE_TYPES),
  isStarter: bool,
  title: shortText,
  scopeOfWork: longText,
  exclusions: longText,
  customerNotes: longText,
  paymentTerms: longText,
  lineItems,
  jobCosts,
  deposit: nullable(deposit),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const presetItem = object<PresetItem>({
  id: ID,
  name: shortText,
  description: longText,
  category: oneOf(LINE_CATEGORIES),
  unit: oneOf(UNIT_CODES),
  customUnit: str({ max: 24 }),
  defaultQuantity: num(LIMITS.quantity.min, LIMITS.quantity.max),
  unitPrice: money,
  taxable: bool,
  costs: lineCosts,
});

const pricingExample = object<PresetPricingExample>({
  laborCostPerHour: money,
  defaultCrewSize: num(LIMITS.crew.min, LIMITS.crew.max, { integer: true }),
  targetMarginPercent: num(LIMITS.targetMargin.min, LIMITS.targetMargin.max),
  minimumCharge: money,
  overhead,
});

const preset = object<TradePreset>({
  tradeType: oneOf(TRADE_TYPES),
  label: shortText,
  description: str({ max: 1_000 }),
  items: uniqueIds(arrayOf(presetItem, LIMITS.presetItems), 'preset item'),
  pricingExample,
});

const business = object<BusinessProfile>({
  name: shortText,
  tradeType: oneOf(TRADE_TYPES),
  region: str({ max: 80 }),
  currency,
  locale,
  dateFormat: oneOf(['locale', 'dmy', 'mdy', 'ymd'] as const),
  email: str({ max: 254 }),
  phone: str({ max: 60 }),
  website: str({ max: 200 }),
  address: str({ max: 1_000 }),
  logoDataUrl: nullable(logo),
  brandColor: hexColor,
  quoteFooter: str({ max: 1_000 }),
  paperSize: withDefault(oneOf(['auto', 'a4', 'letter'] as const), () => 'auto' as const),
});

const pricingDefaults = object<PricingDefaults>({
  laborCostPerHour: money,
  laborRateBasis: oneOf(['burdened', 'wages'] as const),
  defaultCrewSize: num(LIMITS.crew.min, LIMITS.crew.max, { integer: true }),
  pricingMode: oneOf(PRICING_MODES),
  targetMarginPercent: num(LIMITS.targetMargin.min, LIMITS.targetMargin.max),
  markupPercent: num(LIMITS.markup.min, LIMITS.markup.max),
  minimumMarginPercent: num(-100, LIMITS.targetMargin.max),
  minimumCharge: money,
  minimumChargeBasis: oneOf(['afterDiscount', 'beforeDiscount'] as const),
  overhead,
  defaultTravelCharge: money,
  tax,
  defaultDiscountType: oneOf(['percent', 'fixed'] as const),
  discountWarningPercent: percent,
  deposit,
  validityDays: num(LIMITS.validityDays.min, LIMITS.validityDays.max, { integer: true }),
  paymentTerms: longText,
  acceptanceInstructions: longText,
  documentTitle: str({ max: 40 }),
  quoteNumberPrefix: str({ max: 12 }),
  nextQuoteNumber: num(1, 999_999_999, { integer: true }),
});

const backupData = object<BackupData>({
  business: optional(business),
  pricing: optional(pricingDefaults),
  presets: optional(arrayOf(preset, TRADE_TYPES.length)),
  templates: optional(uniqueIds(arrayOf(template, LIMITS.templates), 'template')),
  quotes: uniqueIds(arrayOf(quote, LIMITS.quotes), 'quote'),
  isSampleSession: withDefault(bool, () => false),
});

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

/**
 * Upgrades raw data from schema version N to N+1. Version 1 is the first
 * released schema, so there are no migrations yet; when the schema changes,
 * add `1: (data) => upgradedData` here and bump SCHEMA_VERSION.
 */
const MIGRATIONS: Record<number, (data: unknown) => unknown> = {};

function migrate(data: unknown, fromVersion: number): unknown {
  let current = data;
  for (let v = fromVersion; v < SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new ValidationError('', `Backups from schema version ${v} can't be upgraded.`);
    current = step(current);
  }
  return current;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export interface ImportSummary {
  kind: BackupKind;
  exportedAt: string;
  businessName: string | null;
  quoteCount: number;
  templateCount: number;
  hasSettings: boolean;
  isSampleSession: boolean;
}

export type ImportResult = { ok: true; file: BackupFile; summary: ImportSummary } | { ok: false; error: string };

export function parseBackupText(text: string): ImportResult {
  if (text.length > MAX_IMPORT_BYTES) {
    return { ok: false, error: `This file is too large to import (limit ${MAX_IMPORT_BYTES / 1024 / 1024} MB).` };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file isn't valid JSON. Choose a backup file exported from TradeMaker." };
  }
  try {
    if (typeof raw !== 'object' || raw === null || (raw as { format?: unknown }).format !== BACKUP_FORMAT) {
      return { ok: false, error: "This JSON file isn't a TradeMaker backup." };
    }
    const header = raw as { schemaVersion?: unknown; kind?: unknown; exportedAt?: unknown; data?: unknown };
    const version = header.schemaVersion;
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
      return { ok: false, error: 'The backup has no valid schema version.' };
    }
    if (version > SCHEMA_VERSION) {
      return {
        ok: false,
        error: `This backup was created by a newer version of TradeMaker (schema ${version}). This version supports schema ${SCHEMA_VERSION}.`,
      };
    }
    const kind = oneOf(['full', 'quotes', 'quote'] as const)(header.kind, 'kind');
    const exportedAt = timestamp(header.exportedAt, 'exportedAt');
    const data = backupData(migrate(header.data, version), 'data');
    if (kind === 'full' && (!data.business || !data.pricing)) {
      throw new ValidationError('data', 'a full backup must include the business profile and pricing settings');
    }
    const file: BackupFile = { format: BACKUP_FORMAT, schemaVersion: SCHEMA_VERSION, kind, exportedAt, data };
    return {
      ok: true,
      file,
      summary: {
        kind,
        exportedAt,
        businessName: data.business ? data.business.name || '(unnamed business)' : null,
        quoteCount: data.quotes.length,
        templateCount: data.templates?.length ?? 0,
        hasSettings: Boolean(data.business && data.pricing),
        isSampleSession: data.isSampleSession ?? false,
      },
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { ok: false, error: `The backup could not be imported because ${error.message}.` };
    }
    return { ok: false, error: 'The backup could not be read.' };
  }
}

/** Replace the session with an imported backup (settings only replaced when the file has them). */
export function replaceSessionWith(current: SessionData, file: BackupFile): SessionData {
  const d = file.data;
  return {
    business: d.business ?? current.business,
    pricing: d.pricing ?? current.pricing,
    presets: d.presets && d.presets.length > 0 ? d.presets : current.presets,
    templates: d.templates ?? current.templates,
    quotes: d.quotes,
    isSampleSession: d.isSampleSession ?? false,
  };
}

export interface MergeResult {
  quotes: Quote[];
  templates: QuoteTemplate[];
  renumberedIds: number;
  skippedDuplicates: number;
  duplicateQuoteNumbers: number;
}

/** JSON with object keys sorted, so equal content compares equal regardless of key order. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const contentKey = <T extends { id: string; createdAt: string; updatedAt: string }>(item: T) =>
  stableStringify({ ...item, id: '', createdAt: '', updatedAt: '' });

/**
 * Merge imported quotes and templates into the session. The business profile,
 * pricing settings and presets are kept. Items whose ID already exists are
 * skipped if identical, otherwise added with a fresh ID.
 */
export function mergeIntoSession(current: SessionData, file: BackupFile): MergeResult {
  const quoteIds = new Set(current.quotes.map((q) => q.id));
  const quoteKeys = new Set(current.quotes.map(contentKey));
  const numbers = new Set(current.quotes.map((q) => q.number.trim().toLowerCase()).filter(Boolean));
  const result: MergeResult = { quotes: [], templates: [], renumberedIds: 0, skippedDuplicates: 0, duplicateQuoteNumbers: 0 };

  for (const imported of file.data.quotes) {
    const q = { ...imported };
    if (quoteIds.has(q.id)) {
      if (quoteKeys.has(contentKey(q))) {
        result.skippedDuplicates++;
        continue;
      }
      result.renumberedIds++;
      q.id = newId('q');
    }
    if (q.number.trim() && numbers.has(q.number.trim().toLowerCase())) result.duplicateQuoteNumbers++;
    quoteIds.add(q.id);
    result.quotes.push(q);
  }

  const templateIds = new Set(current.templates.map((t) => t.id));
  const templateKeys = new Set(current.templates.map(contentKey));
  for (const imported of file.data.templates ?? []) {
    const t = { ...imported };
    if (templateIds.has(t.id)) {
      if (templateKeys.has(contentKey(t))) {
        result.skippedDuplicates++;
        continue;
      }
      result.renumberedIds++;
      t.id = newId('tpl');
      t.isStarter = false;
      t.kind = 'custom';
      t.name = `${t.name} (imported)`;
    } else if (t.isStarter) {
      t.isStarter = false;
    }
    templateIds.add(t.id);
    result.templates.push(t);
  }
  return result;
}
