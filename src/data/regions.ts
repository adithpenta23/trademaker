import type { DateFormat, LineCategory, TradeType, UnitCode } from '../domain/types';

export interface RegionOption {
  code: string;
  label: string;
  currency: string;
  locale: string;
  dateFormat: DateFormat;
}

/** Suggested currency/locale per region. Tax rates are deliberately NOT suggested. */
export const REGIONS: RegionOption[] = [
  { code: 'US', label: 'United States', currency: 'USD', locale: 'en-US', dateFormat: 'mdy' },
  { code: 'CA', label: 'Canada', currency: 'CAD', locale: 'en-CA', dateFormat: 'ymd' },
  { code: 'GB', label: 'United Kingdom', currency: 'GBP', locale: 'en-GB', dateFormat: 'dmy' },
  { code: 'IE', label: 'Ireland', currency: 'EUR', locale: 'en-IE', dateFormat: 'dmy' },
  { code: 'AU', label: 'Australia', currency: 'AUD', locale: 'en-AU', dateFormat: 'dmy' },
  { code: 'NZ', label: 'New Zealand', currency: 'NZD', locale: 'en-NZ', dateFormat: 'dmy' },
  { code: 'IN', label: 'India', currency: 'INR', locale: 'en-IN', dateFormat: 'dmy' },
  { code: 'ZA', label: 'South Africa', currency: 'ZAR', locale: 'en-ZA', dateFormat: 'ymd' },
  { code: 'SG', label: 'Singapore', currency: 'SGD', locale: 'en-SG', dateFormat: 'dmy' },
  { code: 'AE', label: 'United Arab Emirates', currency: 'AED', locale: 'en-AE', dateFormat: 'dmy' },
  { code: 'DE', label: 'Germany', currency: 'EUR', locale: 'de-DE', dateFormat: 'dmy' },
  { code: 'FR', label: 'France', currency: 'EUR', locale: 'fr-FR', dateFormat: 'dmy' },
  { code: 'NL', label: 'Netherlands', currency: 'EUR', locale: 'nl-NL', dateFormat: 'dmy' },
  { code: 'ES', label: 'Spain', currency: 'EUR', locale: 'es-ES', dateFormat: 'dmy' },
  { code: 'OTHER', label: 'Other', currency: 'USD', locale: 'en-US', dateFormat: 'locale' },
];

export const CURRENCIES: { code: string; label: string }[] = [
  { code: 'USD', label: 'US dollar' },
  { code: 'CAD', label: 'Canadian dollar' },
  { code: 'GBP', label: 'British pound' },
  { code: 'EUR', label: 'Euro' },
  { code: 'AUD', label: 'Australian dollar' },
  { code: 'NZD', label: 'New Zealand dollar' },
  { code: 'INR', label: 'Indian rupee' },
  { code: 'ZAR', label: 'South African rand' },
  { code: 'SGD', label: 'Singapore dollar' },
  { code: 'AED', label: 'UAE dirham' },
  { code: 'CHF', label: 'Swiss franc' },
  { code: 'SEK', label: 'Swedish krona' },
  { code: 'NOK', label: 'Norwegian krone' },
  { code: 'DKK', label: 'Danish krone' },
  { code: 'PLN', label: 'Polish złoty' },
  { code: 'MXN', label: 'Mexican peso' },
  { code: 'BRL', label: 'Brazilian real' },
  { code: 'JPY', label: 'Japanese yen' },
  { code: 'PHP', label: 'Philippine peso' },
  { code: 'NGN', label: 'Nigerian naira' },
];

export const LOCALES: { code: string; label: string }[] = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-CA', label: 'English (Canada)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'en-IE', label: 'English (Ireland)' },
  { code: 'en-AU', label: 'English (Australia)' },
  { code: 'en-NZ', label: 'English (New Zealand)' },
  { code: 'en-IN', label: 'English (India)' },
  { code: 'en-ZA', label: 'English (South Africa)' },
  { code: 'en-SG', label: 'English (Singapore)' },
  { code: 'en-AE', label: 'English (UAE)' },
  { code: 'fr-CA', label: 'Français (Canada)' },
  { code: 'fr-FR', label: 'Français (France)' },
  { code: 'de-DE', label: 'Deutsch (Deutschland)' },
  { code: 'nl-NL', label: 'Nederlands' },
  { code: 'es-ES', label: 'Español (España)' },
  { code: 'es-MX', label: 'Español (México)' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
];

export const TRADE_LABELS: Record<TradeType, string> = {
  pressureWashing: 'Pressure washing',
  painting: 'Painting',
  windowCleaning: 'Window cleaning',
  landscaping: 'Landscaping',
  other: 'Other / mixed services',
};

export const UNIT_LABELS: Record<UnitCode, { short: string; long: string }> = {
  each: { short: 'ea', long: 'Each' },
  hour: { short: 'hr', long: 'Hour' },
  day: { short: 'day', long: 'Day' },
  sqft: { short: 'sq ft', long: 'Sq ft' },
  sqm: { short: 'm²', long: 'Sq m' },
  lft: { short: 'lin ft', long: 'Lin ft' },
  lm: { short: 'lin m', long: 'Lin m' },
  room: { short: 'room', long: 'Room' },
  visit: { short: 'visit', long: 'Visit' },
  load: { short: 'load', long: 'Load' },
  lot: { short: 'lot', long: 'Lot' },
  custom: { short: '', long: 'Custom…' },
};

export function unitLabel(unit: UnitCode, customUnit: string): string {
  return unit === 'custom' ? customUnit.trim() : UNIT_LABELS[unit].short;
}

export const LINE_CATEGORY_LABELS: Record<LineCategory, string> = {
  service: 'Service',
  labor: 'Labor',
  materials: 'Materials',
  equipment: 'Equipment',
  travel: 'Travel',
  disposal: 'Disposal',
  subcontractor: 'Subcontractor',
  other: 'Other',
};

export const COST_CATEGORY_LABELS = {
  labor: 'Direct labor',
  materials: 'Materials & consumables',
  equipment: 'Equipment',
  travel: 'Travel & fuel',
  disposal: 'Waste disposal',
  subcontractor: 'Subcontractors',
  other: 'Other direct costs',
} as const;

/** Paper size used by print/PDF when the profile says "auto". */
export function paperForLocale(locale: string): 'letter' | 'a4' {
  return /-(US|CA|MX|PH)$/i.test(locale) ? 'letter' : 'a4';
}
