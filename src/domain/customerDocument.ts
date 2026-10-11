/**
 * The customer-facing document model.
 *
 * Both the live HTML preview and the generated PDF render ONLY this structure,
 * which guarantees they show the same content. It is built exclusively from
 * customer-facing fields: the type has no place for internal costs, overhead,
 * margins, profit, internal notes, location notes or internal-only lines.
 * All values are pre-formatted strings.
 */
import { paperForLocale, unitLabel } from '../data/regions';
import { formatDate, formatMoney, formatNumber, formatUnitPrice } from '../format/format';
import type { QuoteCalculation } from './calc';
import { quoteExpiryDate } from './dates';
import type { BusinessProfile, Quote } from './types';

export interface DocLine {
  key: string;
  name: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  note: string;
}

export interface DocTotalRow {
  key: string;
  label: string;
  value: string;
  note: string;
  kind: 'subtotal' | 'discount' | 'adjustment' | 'tax' | 'info';
}

export interface DocSection {
  key: string;
  title: string;
  body: string;
}

export interface CustomerDocument {
  documentTitle: string;
  brandColor: string;
  /** Text colour to use ON the brand colour. */
  brandTextColor: string;
  /** Brand colour for text on white, or near-black when the brand colour is too light to read. */
  brandInk: string;
  paperSize: 'a4' | 'letter';
  isSample: boolean;
  business: {
    name: string;
    logoDataUrl: string | null;
    address: string;
    contactLines: string[];
  };
  meta: { label: string; value: string }[];
  title: string;
  customer: { heading: string; lines: string[] } | null;
  serviceAddress: string;
  scope: string;
  showQuantities: boolean;
  showDescriptions: boolean;
  lines: DocLine[];
  optionalLines: DocLine[];
  optionalNote: string;
  totals: DocTotalRow[];
  total: { label: string; value: string };
  afterTotal: DocTotalRow[];
  deposit: { depositLabel: string; deposit: string; balanceLabel: string; balance: string } | null;
  sections: DocSection[];
  showSignature: boolean;
  footer: string;
}

/** Readable text colour (white or near-black) for a background colour. */
export function contrastText(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m?.[1]) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  return (1.05 / (lum + 0.05)) >= 4.5 ? '#FFFFFF' : '#17231C';
}

const nonEmpty = (...values: string[]) => values.map((v) => v.trim()).filter(Boolean);
const lines = (text: string) => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

export function buildCustomerDocument(quote: Quote, calc: QuoteCalculation, business: BusinessProfile): CustomerDocument {
  const ctx = { locale: business.locale, currency: quote.currency, dateFormat: business.dateFormat };
  const money = (minor: number) => formatMoney(minor, ctx);
  const date = (iso: string | null) => formatDate(iso, ctx);
  const d = quote.display;
  const taxOn = calc.tax.mode !== 'none';
  const mixedTax = taxOn && quote.lineItems.some((l) => l.visibility === 'included' && !l.taxable);

  const resultById = new Map(calc.lines.map((r) => [r.id, r]));
  const toDocLine = (item: Quote['lineItems'][number]): DocLine => {
    const r = resultById.get(item.id);
    const unit = unitLabel(item.unit, item.customUnit);
    const notes: string[] = [];
    if (r && r.discountAmount > 0) {
      notes.push(`Includes ${formatNumber(item.discountPercent, business.locale)}% discount (−${money(r.discountAmount)})`);
    }
    if (mixedTax && !item.taxable) notes.push('Not taxed');
    return {
      key: item.id,
      name: item.name.trim() || 'Item',
      description: d.showLineDescriptions ? item.description.trim() : '',
      quantity: `${formatNumber(item.quantity, business.locale, 4)}${unit ? ` ${unit}` : ''}`,
      unitPrice: formatUnitPrice(r?.unitPrice ?? 0, ctx),
      amount: money(r?.netAmount ?? 0),
      note: notes.join(' · '),
    };
  };

  // ---- Totals -------------------------------------------------------------
  const totals: DocTotalRow[] = [{ key: 'subtotal', label: 'Subtotal', value: money(calc.itemsSubtotal), note: '', kind: 'subtotal' }];
  const discountRow = (): DocTotalRow | null => {
    if (calc.discount.amount <= 0) return null;
    const label =
      calc.discount.type === 'percent' ? `Discount (${formatNumber(calc.discount.value, business.locale, 4)}%)` : 'Discount';
    return { key: 'discount', label, value: `−${money(calc.discount.amount)}`, note: calc.discount.reason.trim(), kind: 'discount' };
  };
  const minimumRow = (): DocTotalRow | null => {
    if (calc.minimumCharge.adjustment <= 0) return null;
    return {
      key: 'minimum',
      label: 'Minimum job charge adjustment',
      value: money(calc.minimumCharge.adjustment),
      note: `Our minimum charge per job is ${money(calc.minimumCharge.minimum)}.`,
      kind: 'adjustment',
    };
  };
  const ordered =
    calc.minimumCharge.basis === 'beforeDiscount' ? [minimumRow(), discountRow()] : [discountRow(), minimumRow()];
  for (const row of ordered) if (row) totals.push(row);

  const afterTotal: DocTotalRow[] = [];
  const taxLabel = (name: string, rate: number) => `${name.trim() || 'Tax'} (${formatNumber(rate, business.locale, 4)}%)`;
  if (calc.tax.mode === 'exclusive') {
    if (totals.length > 1) {
      totals.push({ key: 'pretax', label: 'Subtotal before tax', value: money(calc.subtotal), note: '', kind: 'subtotal' });
    }
    if (d.showTaxBreakdown) {
      for (const t of calc.tax.lines) {
        totals.push({ key: `tax-${t.id}`, label: taxLabel(t.name, t.ratePercent), value: money(t.amount), note: '', kind: 'tax' });
      }
    } else {
      totals.push({ key: 'tax', label: 'Tax', value: money(calc.tax.total), note: '', kind: 'tax' });
    }
  } else if (calc.tax.mode === 'inclusive') {
    if (d.showTaxBreakdown) {
      for (const t of calc.tax.lines) {
        afterTotal.push({ key: `tax-${t.id}`, label: `Includes ${taxLabel(t.name, t.ratePercent)}`, value: money(t.amount), note: '', kind: 'info' });
      }
    } else {
      afterTotal.push({ key: 'tax', label: 'Includes tax', value: money(calc.tax.total), note: '', kind: 'info' });
    }
  }

  // ---- Deposit ------------------------------------------------------------
  let deposit: CustomerDocument['deposit'] = null;
  if (calc.deposit.type !== 'none' && calc.deposit.amount > 0) {
    deposit = {
      depositLabel:
        calc.deposit.type === 'percent'
          ? `Deposit due on acceptance (${formatNumber(calc.deposit.value, business.locale, 4)}% of total)`
          : 'Deposit due on acceptance',
      deposit: money(calc.deposit.amount),
      balanceLabel: 'Balance due on completion',
      balance: money(calc.deposit.balance),
    };
  }

  // ---- Text sections --------------------------------------------------------
  const expiry = quoteExpiryDate(quote);
  const sections: DocSection[] = [];
  const add = (show: boolean, key: string, title: string, body: string) => {
    if (show && body.trim()) sections.push({ key, title, body: body.trim() });
  };
  add(d.showPaymentTerms, 'payment', 'Payment terms', quote.paymentTerms);
  add(d.showExclusions, 'exclusions', 'Exclusions', quote.exclusions);
  add(d.showNotes, 'notes', 'Notes', quote.customerNotes);
  add(
    d.showAcceptance,
    'acceptance',
    'Accepting this quote',
    `${quote.acceptanceInstructions.trim()}${quote.acceptanceInstructions.trim() ? '\n\n' : ''}This quote is valid until ${date(expiry)}.`,
  );

  const meta = [
    { label: `${d.documentTitle.trim() || 'Quote'} no.`, value: quote.number.trim() || '—' },
    { label: 'Date', value: date(quote.createdDate) },
    { label: 'Valid until', value: date(expiry) },
  ];
  if (quote.jobDate) meta.push({ label: 'Planned job date', value: date(quote.jobDate) });
  if (quote.duration.trim()) meta.push({ label: 'Estimated duration', value: quote.duration.trim() });

  const c = quote.customer;
  const customerLines = nonEmpty(c.name, c.company, ...lines(c.billingAddress), c.phone, c.email);
  const included = quote.lineItems.filter((l) => l.visibility === 'included');
  const optional = quote.lineItems.filter((l) => l.visibility === 'optional');

  return {
    documentTitle: d.documentTitle.trim() || 'Quote',
    brandColor: business.brandColor,
    brandTextColor: contrastText(business.brandColor),
    brandInk: contrastText(business.brandColor) === '#FFFFFF' ? business.brandColor : '#17231C',
    paperSize: business.paperSize === 'auto' ? paperForLocale(business.locale) : business.paperSize,
    isSample: quote.isSample,
    business: {
      name: business.name.trim() || 'Your business name',
      logoDataUrl: business.logoDataUrl,
      address: business.address.trim(),
      contactLines: nonEmpty(business.phone, business.email, business.website),
    },
    meta,
    title: quote.title.trim(),
    customer: customerLines.length ? { heading: 'Prepared for', lines: customerLines } : null,
    serviceAddress: c.serviceAddress.trim(),
    scope: d.showScope ? quote.scopeOfWork.trim() : '',
    showQuantities: d.showQuantities,
    showDescriptions: d.showLineDescriptions,
    lines: included.map(toDocLine),
    optionalLines: optional.map(toDocLine),
    optionalNote:
      optional.length > 0
        ? `Optional extras are not included in the total above. Prices shown ${calc.tax.mode === 'exclusive' ? 'exclude' : calc.tax.mode === 'inclusive' ? 'include' : 'are'}${calc.tax.mode === 'none' ? ' final' : ' tax'}.`
        : '',
    totals,
    total: { label: calc.tax.mode === 'exclusive' ? 'Total (incl. tax)' : 'Total', value: money(calc.total) },
    afterTotal,
    deposit,
    sections,
    showSignature: d.showSignature,
    footer: business.quoteFooter.trim(),
  };
}
