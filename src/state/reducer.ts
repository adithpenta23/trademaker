/**
 * Session state. Everything lives in memory only — there is deliberately no
 * localStorage, sessionStorage, IndexedDB or cookie persistence.
 */
import { defaultBusiness, defaultPricing } from '../data/defaults';
import { starterPresets } from '../data/presets';
import { STARTER_TEMPLATE_IDS, starterTemplates } from '../data/templates';
import { formatQuoteNumber } from '../domain/quoteFactory';
import type {
  BusinessProfile,
  ID,
  PricingDefaults,
  Quote,
  QuoteTemplate,
  SessionData,
  TradePreset,
  TradeType,
} from '../domain/types';

export interface AppState extends SessionData {
  /** First-run welcome has been completed or skipped. */
  setupDone: boolean;
  /** Data changed since the last full JSON backup (drives the unload warning). */
  changedSinceExport: boolean;
  lastExportAt: string | null;
}

export type Action =
  | { type: 'setup/finish'; business: BusinessProfile; pricing: PricingDefaults }
  | { type: 'setup/dismiss' }
  | { type: 'business/update'; patch: Partial<BusinessProfile> }
  | { type: 'pricing/update'; patch: Partial<PricingDefaults> }
  | { type: 'quote/add'; quote: Quote; assignNumber: boolean }
  | { type: 'quote/update'; id: ID; update: (quote: Quote) => Quote; now: string }
  | { type: 'quote/delete'; id: ID }
  | { type: 'template/add'; template: QuoteTemplate }
  | { type: 'template/update'; id: ID; update: (template: QuoteTemplate) => QuoteTemplate; now: string }
  | { type: 'template/delete'; id: ID }
  | { type: 'templates/resetStarters' }
  | { type: 'preset/update'; tradeType: TradeType; update: (preset: TradePreset) => TradePreset }
  | { type: 'presets/reset' }
  | { type: 'session/replace'; data: SessionData }
  | { type: 'session/merge'; quotes: Quote[]; templates: QuoteTemplate[] }
  | { type: 'session/clear' }
  | { type: 'session/exported'; at: string };

export function initialState(): AppState {
  return {
    business: defaultBusiness(),
    pricing: defaultPricing(),
    quotes: [],
    templates: starterTemplates(),
    presets: starterPresets(),
    isSampleSession: false,
    setupDone: false,
    changedSinceExport: false,
    lastExportAt: null,
  };
}

function changed(state: AppState, patch: Partial<AppState>): AppState {
  return { ...state, ...patch, changedSinceExport: true };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setup/finish':
      return changed(state, { business: action.business, pricing: action.pricing, setupDone: true, isSampleSession: false });
    case 'setup/dismiss':
      return { ...state, setupDone: true };
    case 'business/update':
      return changed(state, { business: { ...state.business, ...action.patch } });
    case 'pricing/update':
      return changed(state, { pricing: { ...state.pricing, ...action.patch } });

    case 'quote/add': {
      let quote = action.quote;
      let pricing = state.pricing;
      if (action.assignNumber) {
        quote = { ...quote, number: formatQuoteNumber(pricing.quoteNumberPrefix, pricing.nextQuoteNumber) };
        pricing = { ...pricing, nextQuoteNumber: pricing.nextQuoteNumber + 1 };
      }
      return changed(state, { quotes: [quote, ...state.quotes], pricing });
    }
    case 'quote/update':
      return changed(state, {
        quotes: state.quotes.map((q) => (q.id === action.id ? { ...action.update(q), id: q.id, updatedAt: action.now } : q)),
      });
    case 'quote/delete':
      return changed(state, { quotes: state.quotes.filter((q) => q.id !== action.id) });

    case 'template/add':
      return changed(state, { templates: [...state.templates, action.template] });
    case 'template/update':
      return changed(state, {
        templates: state.templates.map((t) =>
          t.id === action.id ? { ...action.update(t), id: t.id, isStarter: t.isStarter, updatedAt: action.now } : t,
        ),
      });
    case 'template/delete':
      // Starter templates can be reset but not deleted.
      return changed(state, { templates: state.templates.filter((t) => t.id !== action.id || t.isStarter) });
    case 'templates/resetStarters': {
      const starters = starterTemplates();
      const starterIds = new Set<string>(Object.values(STARTER_TEMPLATE_IDS));
      return changed(state, { templates: [...starters, ...state.templates.filter((t) => !starterIds.has(t.id))] });
    }

    case 'preset/update':
      return changed(state, {
        presets: state.presets.map((p) => (p.tradeType === action.tradeType ? action.update(p) : p)),
      });
    case 'presets/reset':
      return changed(state, { presets: starterPresets() });

    case 'session/replace':
      return {
        ...action.data,
        setupDone: true,
        changedSinceExport: !action.data.isSampleSession,
        lastExportAt: null,
      };
    case 'session/merge':
      return changed(state, {
        quotes: [...action.quotes, ...state.quotes],
        templates: [...state.templates, ...action.templates],
      });
    case 'session/clear':
      return initialState();
    case 'session/exported':
      return { ...state, changedSinceExport: false, lastExportAt: action.at };
  }
}
