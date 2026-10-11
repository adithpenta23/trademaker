import { createContext, useContext, useLayoutEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { demoSession } from '../data/demo';
import {
  createBlankQuote,
  createBlankTemplate,
  createQuoteFromTemplate,
  duplicateQuote,
  duplicateTemplate,
  templateFromQuote,
} from '../domain/quoteFactory';
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
import { initialState, reducer, type AppState } from './reducer';

function isPristineBlank(q: Quote): boolean {
  return q.createdAt === q.updatedAt && q.sourceTemplateId === null && !q.isSample;
}

function createActions(dispatch: React.Dispatch<Parameters<typeof reducer>[1]>, get: () => AppState) {
  const now = () => new Date();
  const ctx = () => ({ business: get().business, pricing: get().pricing, number: '', now: now() });
  return {
    finishSetup: (business: BusinessProfile, pricing: PricingDefaults) => dispatch({ type: 'setup/finish', business, pricing }),
    dismissSetup: () => dispatch({ type: 'setup/dismiss' }),
    updateBusiness: (patch: Partial<BusinessProfile>) => dispatch({ type: 'business/update', patch }),
    updatePricing: (patch: Partial<PricingDefaults>) => dispatch({ type: 'pricing/update', patch }),

    /** Opens the most recent untouched blank quote if there is one, otherwise creates a new one. */
    newQuote: (): ID => {
      const pristine = get().quotes.find(isPristineBlank);
      if (pristine) return pristine.id;
      const quote = createBlankQuote(ctx());
      dispatch({ type: 'quote/add', quote, assignNumber: true });
      return quote.id;
    },
    newQuoteFromTemplate: (templateId: ID): ID | null => {
      const template = get().templates.find((t) => t.id === templateId);
      if (!template) return null;
      const quote = createQuoteFromTemplate(template, ctx());
      dispatch({ type: 'quote/add', quote, assignNumber: true });
      return quote.id;
    },
    duplicateQuote: (id: ID): ID | null => {
      const source = get().quotes.find((q) => q.id === id);
      if (!source) return null;
      const quote = duplicateQuote(source, '', now());
      dispatch({ type: 'quote/add', quote, assignNumber: true });
      return quote.id;
    },
    updateQuote: (id: ID, update: (q: Quote) => Quote) => dispatch({ type: 'quote/update', id, update, now: now().toISOString() }),
    deleteQuote: (id: ID) => dispatch({ type: 'quote/delete', id }),
    restoreQuote: (quote: Quote) => dispatch({ type: 'quote/add', quote, assignNumber: false }),

    newTemplate: (tradeType: TradeType): ID => {
      const template = createBlankTemplate(tradeType, now());
      dispatch({ type: 'template/add', template });
      return template.id;
    },
    templateFromQuote: (quoteId: ID, name: string): ID | null => {
      const quote = get().quotes.find((q) => q.id === quoteId);
      if (!quote) return null;
      const template = templateFromQuote(quote, name, now());
      dispatch({ type: 'template/add', template });
      return template.id;
    },
    duplicateTemplate: (id: ID): ID | null => {
      const source = get().templates.find((t) => t.id === id);
      if (!source) return null;
      const template = duplicateTemplate(source, now());
      dispatch({ type: 'template/add', template });
      return template.id;
    },
    updateTemplate: (id: ID, update: (t: QuoteTemplate) => QuoteTemplate) =>
      dispatch({ type: 'template/update', id, update, now: now().toISOString() }),
    deleteTemplate: (id: ID) => dispatch({ type: 'template/delete', id }),
    resetStarterTemplates: () => dispatch({ type: 'templates/resetStarters' }),
    updatePreset: (tradeType: TradeType, update: (p: TradePreset) => TradePreset) => dispatch({ type: 'preset/update', tradeType, update }),
    resetPresets: () => dispatch({ type: 'presets/reset' }),

    loadDemo: () => dispatch({ type: 'session/replace', data: demoSession(now()) }),
    replaceSession: (data: SessionData) => dispatch({ type: 'session/replace', data }),
    mergeSession: (quotes: Quote[], templates: QuoteTemplate[]) => dispatch({ type: 'session/merge', quotes, templates }),
    clearSession: () => dispatch({ type: 'session/clear' }),
    markExported: () => dispatch({ type: 'session/exported', at: now().toISOString() }),
  };
}

export type Actions = ReturnType<typeof createActions>;

const StoreContext = createContext<{ state: AppState; actions: Actions } | null>(null);

export function StoreProvider({ children, initial }: { children: ReactNode; initial?: AppState }) {
  const [state, dispatch] = useReducer(reducer, initial, (init) => init ?? initialState());
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);
  // The getter is only ever called from event handlers (never during render), so reading the ref is safe.
  // eslint-disable-next-line react-hooks/refs
  const actions = useMemo(() => createActions(dispatch, () => stateRef.current), []);
  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
