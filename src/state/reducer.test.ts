import { describe, expect, it } from 'vitest';
import { defaultBusiness, defaultPricing } from '../data/defaults';
import { calculateQuote } from '../domain/calc';
import { createBlankQuote, createQuoteFromTemplate, duplicateQuote } from '../domain/quoteFactory';
import { FIXED_NOW, line, testQuote } from '../test/fixtures';
import { initialState, reducer, type AppState } from './reducer';

const now = FIXED_NOW.toISOString();

function withQuote(state: AppState = initialState()) {
  const quote = testQuote({ lineItems: [line({ name: 'Wash', unitPrice: 300, costs: { laborHours: 2, crewSize: 1, materials: 20 } })] });
  return { state: reducer(state, { type: 'quote/add', quote, assignNumber: true }), id: quote.id };
}

describe('quote duplication', () => {
  it('22. duplicates share no mutable state with the original', () => {
    const original = testQuote({
      lineItems: [line({ name: 'A', unitPrice: 100, costs: { materials: 5 } })],
      jobCosts: [{ id: 'jc1', label: 'Fuel', category: 'travel', amount: 10 }],
    });
    const copy = duplicateQuote(original, 'Q-2', FIXED_NOW);
    expect(copy.id).not.toBe(original.id);
    expect(copy.lineItems[0]!.id).not.toBe(original.lineItems[0]!.id);
    expect(copy.jobCosts[0]!.id).not.toBe(original.jobCosts[0]!.id);

    copy.lineItems[0]!.costs.materials = 999;
    copy.lineItems[0]!.name = 'Changed';
    copy.customer.name = 'Someone else';
    copy.tax.components[0]!.ratePercent = 50;
    expect(original.lineItems[0]!.costs.materials).toBe(5);
    expect(original.lineItems[0]!.name).toBe('A');
    expect(original.customer.name).toBe('');
    expect(original.tax.components[0]!.ratePercent).toBe(0);
  });

  it('assigns sequential human-readable numbers', () => {
    let state = initialState();
    const a = createBlankQuote({ business: state.business, pricing: state.pricing, number: '', now: FIXED_NOW });
    state = reducer(state, { type: 'quote/add', quote: a, assignNumber: true });
    const b = duplicateQuote(state.quotes[0]!, '', FIXED_NOW);
    state = reducer(state, { type: 'quote/add', quote: b, assignNumber: true });
    expect(state.quotes.map((q) => q.number)).toEqual(['Q-1002', 'Q-1001']);
    expect(state.pricing.nextQuoteNumber).toBe(1003);
  });
});

describe('isolation of existing quotes', () => {
  it('23. editing a template does not modify quotes created from it', () => {
    let state = initialState();
    const template = state.templates[0]!;
    const quote = createQuoteFromTemplate(template, { business: state.business, pricing: state.pricing, number: '', now: FIXED_NOW });
    state = reducer(state, { type: 'quote/add', quote, assignNumber: true });
    const before = structuredClone(state.quotes[0]!);

    state = reducer(state, {
      type: 'template/update',
      id: template.id,
      now,
      update: (t) => ({
        ...t,
        title: 'Changed title',
        lineItems: t.lineItems.map((l) => ({ ...l, unitPrice: l.unitPrice * 10, costs: { ...l.costs, materials: 500 } })),
      }),
    });
    expect(state.templates[0]!.title).toBe('Changed title');
    expect(state.quotes[0]).toEqual(before);
    // The template object itself was never shared with the quote.
    expect(state.quotes[0]!.lineItems[0]!.id).not.toBe(template.lineItems[0]!.id);
  });

  it('24. changing business settings and pricing defaults does not rewrite existing quotes', () => {
    const { state: s1, id } = withQuote();
    const quoteBefore = structuredClone(s1.quotes.find((q) => q.id === id)!);
    const calcBefore = calculateQuote(quoteBefore);

    let state = reducer(s1, {
      type: 'pricing/update',
      patch: {
        laborCostPerHour: 99,
        targetMarginPercent: 70,
        minimumCharge: 5_000,
        overhead: { method: 'perJob', amount: 400 },
        tax: { mode: 'exclusive', compounding: 'independent', components: [{ id: 't', name: 'VAT', ratePercent: 20 }] },
        paymentTerms: 'New terms',
      },
    });
    state = reducer(state, { type: 'business/update', patch: { currency: 'EUR', name: 'Renamed Ltd' } });

    const quoteAfter = state.quotes.find((q) => q.id === id)!;
    expect(quoteAfter).toEqual(quoteBefore);
    expect(calculateQuote(quoteAfter)).toEqual(calcBefore);

    // ...while new quotes pick up the new defaults.
    const fresh = createBlankQuote({ business: state.business, pricing: state.pricing, number: '', now: FIXED_NOW });
    expect(fresh.pricing.laborCostPerHour).toBe(99);
    expect(fresh.currency).toBe('EUR');
    expect(fresh.paymentTerms).toBe('New terms');
  });

  it('pricing defaults are snapshotted, not referenced', () => {
    const pricing = defaultPricing();
    const quote = createBlankQuote({ business: defaultBusiness(), pricing, number: '', now: FIXED_NOW });
    pricing.overhead.amount = 123;
    pricing.tax.components[0]!.ratePercent = 42;
    pricing.deposit.value = 50;
    expect(quote.pricing.overhead.amount).toBe(0);
    expect(quote.tax.components[0]!.ratePercent).toBe(0);
    expect(quote.deposit.value).toBe(0);
  });
});

describe('templates and session', () => {
  it('starter templates cannot be deleted but can be reset', () => {
    let state = initialState();
    const starter = state.templates[0]!;
    state = reducer(state, { type: 'template/delete', id: starter.id });
    expect(state.templates.some((t) => t.id === starter.id)).toBe(true);
    state = reducer(state, { type: 'template/update', id: starter.id, now, update: (t) => ({ ...t, name: 'Edited' }) });
    expect(state.templates[0]!.name).toBe('Edited');
    state = reducer(state, { type: 'templates/resetStarters' });
    expect(state.templates.find((t) => t.id === starter.id)!.name).toBe(starter.name);
  });

  it('tracks unsaved changes until a full export', () => {
    const { state } = withQuote();
    expect(state.changedSinceExport).toBe(true);
    const exported = reducer(state, { type: 'session/exported', at: now });
    expect(exported.changedSinceExport).toBe(false);
    expect(reducer(exported, { type: 'quote/delete', id: exported.quotes[0]!.id }).changedSinceExport).toBe(true);
  });

  it('clearing the session returns to a fresh start', () => {
    const { state } = withQuote();
    const cleared = reducer(state, { type: 'session/clear' });
    expect(cleared.quotes).toHaveLength(0);
    expect(cleared.setupDone).toBe(false);
  });
});
