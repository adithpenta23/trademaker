import { useSyncExternalStore } from 'react';

/**
 * Minimal hash router. Hashes only ever contain page names and internal IDs —
 * never customer or business data.
 */
export type Route =
  | { name: 'dashboard' }
  | { name: 'quotes' }
  | { name: 'quote'; id: string }
  | { name: 'templates'; tab: 'templates' | 'presets' }
  | { name: 'template'; id: string }
  | { name: 'business' }
  | { name: 'pricing' }
  | { name: 'data' }
  | { name: 'notFound' };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('?')[0] ?? '';
  const [a, b] = path.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
  switch (a) {
    case undefined:
    case 'dashboard':
      return { name: 'dashboard' };
    case 'quotes':
      return b ? { name: 'quote', id: b } : { name: 'quotes' };
    case 'templates':
      if (b === 'presets') return { name: 'templates', tab: 'presets' };
      return b ? { name: 'template', id: b } : { name: 'templates', tab: 'templates' };
    case 'business':
      return { name: 'business' };
    case 'pricing':
      return { name: 'pricing' };
    case 'data':
      return { name: 'data' };
    default:
      return { name: 'notFound' };
  }
}

export const paths = {
  dashboard: '#/',
  quotes: '#/quotes',
  quote: (id: string) => `#/quotes/${encodeURIComponent(id)}`,
  templates: '#/templates',
  presets: '#/templates/presets',
  template: (id: string) => `#/templates/${encodeURIComponent(id)}`,
  business: '#/business',
  pricing: '#/pricing',
  data: '#/data',
};

function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '');
  return parseRoute(hash);
}

export function navigate(path: string) {
  if (window.location.hash !== path) window.location.hash = path;
}
