import { describe, expect, it } from 'vitest';
import { defaultBusiness } from '../data/defaults';
import { line, testQuote } from '../test/fixtures';
import { calculateQuote } from './calc';
import { buildCustomerDocument, contrastText } from './customerDocument';

describe('customer document', () => {
  const quote = testQuote({
    title: 'House wash',
    internalNotes: 'SECRET-INTERNAL-NOTE',
    customer: {
      name: 'Pat Lee',
      company: '',
      email: 'pat@example.com',
      phone: '',
      billingAddress: '1 Main St',
      serviceAddress: '1 Main St',
      locationNotes: 'GATE-CODE-4321',
    },
    pricing: { ...testQuote().pricing, overhead: { method: 'perJob', amount: 77.77 } },
    tax: { mode: 'exclusive', compounding: 'independent', components: [{ id: 't', name: 'Sales tax', ratePercent: 8 }] },
    deposit: { type: 'percent', value: 25 },
    lineItems: [
      line({ name: 'Soft wash', unitPrice: 400, costs: { materials: 123.45, laborHours: 3, crewSize: 2 } }),
      line({ name: 'INTERNAL-ONLY-LINE', visibility: 'internal', costs: { equipment: 55.55 } }),
      line({ name: 'Gutter clean', unitPrice: 90, visibility: 'optional' }),
    ],
  });
  const calc = calculateQuote(quote);
  const doc = buildCustomerDocument(quote, calc, { ...defaultBusiness(), name: 'Acme Wash' });
  const serialized = JSON.stringify(doc);

  it('never contains internal costs, notes, margins or internal-only lines', () => {
    for (const secret of ['SECRET-INTERNAL-NOTE', 'GATE-CODE-4321', 'INTERNAL-ONLY-LINE', '123.45', '55.55', '77.77']) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized).not.toMatch(/margin|markup|profit|overhead/i);
  });

  it('shows customer-facing lines, totals, tax and deposit from the shared engine', () => {
    expect(doc.lines.map((l) => l.name)).toEqual(['Soft wash']);
    expect(doc.optionalLines.map((l) => l.name)).toEqual(['Gutter clean']);
    expect(doc.total.value).toBe('$432.00');
    expect(doc.totals.find((t) => t.kind === 'tax')?.value).toBe('$32.00');
    expect(doc.deposit?.deposit).toBe('$108.00');
    expect(doc.deposit?.balance).toBe('$324.00');
  });

  it('explains a minimum-charge adjustment to the customer', () => {
    const small = testQuote({ pricing: { ...testQuote().pricing, minimumCharge: 150 }, lineItems: [line({ unitPrice: 80 })] });
    const d = buildCustomerDocument(small, calculateQuote(small), defaultBusiness());
    const row = d.totals.find((t) => t.key === 'minimum');
    expect(row?.value).toBe('$70.00');
    expect(row?.note).toContain('$150.00');
  });

  it('respects show/hide options', () => {
    const hidden = { ...quote, display: { ...quote.display, showSignature: false, showPaymentTerms: false, showScope: false } };
    const d = buildCustomerDocument(hidden, calc, defaultBusiness());
    expect(d.showSignature).toBe(false);
    expect(d.sections.some((s) => s.key === 'payment')).toBe(false);
    expect(d.scope).toBe('');
  });

  it('picks readable text on brand colours', () => {
    expect(contrastText('#123D2B')).toBe('#FFFFFF');
    expect(contrastText('#DDF5E7')).toBe('#17231C');
  });
});
