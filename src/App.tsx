import { useEffect, useRef } from 'react';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { DataBackupPage } from './features/data/DataBackupPage';
import { PrintProvider } from './features/document/print';
import { preloadPdfEngine } from './features/document/useQuoteExport';
import { QuoteEditorPage } from './features/editor/QuoteEditorPage';
import { WelcomeSetup } from './features/onboarding/WelcomeSetup';
import { QuotesPage } from './features/quotes/QuotesPage';
import { BusinessProfilePage } from './features/settings/BusinessProfilePage';
import { PricingSettingsPage } from './features/settings/PricingSettingsPage';
import { AppShell } from './features/shell/AppShell';
import { TemplateEditorPage } from './features/templates/TemplateEditorPage';
import { TemplatesPage } from './features/templates/TemplatesPage';
import type { AppState } from './state/reducer';
import { paths, useRoute, type Route } from './state/router';
import { StoreProvider, useStore } from './state/store';
import { LinkButton } from './ui/Button';
import { FeedbackProvider } from './ui/feedback';
import { EmptyState } from './ui/layout';

export function App({ initialState }: { initialState?: AppState }) {
  return (
    <StoreProvider initial={initialState}>
      <FeedbackProvider>
        <PrintProvider>
          <Root />
        </PrintProvider>
      </FeedbackProvider>
    </StoreProvider>
  );
}

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'dashboard':
      return <DashboardPage />;
    case 'quotes':
      return <QuotesPage />;
    case 'quote':
      return <QuoteEditorPage id={route.id} />;
    case 'templates':
      return <TemplatesPage tab={route.tab} />;
    case 'template':
      return <TemplateEditorPage id={route.id} />;
    case 'business':
      return <BusinessProfilePage />;
    case 'pricing':
      return <PricingSettingsPage />;
    case 'data':
      return <DataBackupPage />;
    default:
      return (
        <div className="page">
          <EmptyState
            title="Page not found"
            actions={
              <LinkButton href={paths.dashboard} variant="primary">
                Go to dashboard
              </LinkButton>
            }
          />
        </div>
      );
  }
}

function Root() {
  const { state } = useStore();
  const route = useRoute();
  const routeKey = route.name === 'quote' || route.name === 'template' ? `${route.name}:${route.id}` : JSON.stringify(route);
  const first = useRef(true);

  // Move focus to the new page heading for keyboard and screen-reader users.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    document.querySelector<HTMLElement>('[data-page-heading]')?.focus({ preventScroll: true });
  }, [routeKey]);

  // Warn before leaving when there is work that hasn't been exported. Nothing is stored by the browser.
  const unsaved = state.changedSinceExport && (state.quotes.length > 0 || state.setupDone);
  useEffect(() => {
    if (!unsaved) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [unsaved]);

  // Warm up the PDF engine once the app is idle so PDF export also works if the connection drops later.
  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    const t = window.setTimeout(() => void preloadPdfEngine().catch(() => undefined), 2500);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <>
      <div className="app-root" inert={!state.setupDone}>
        <AppShell route={route}>
          <Page route={route} />
        </AppShell>
      </div>
      {!state.setupDone && <WelcomeSetup />}
    </>
  );
}
