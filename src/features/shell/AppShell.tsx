import { Building, DatabaseBackup, Download, FilePlus, Files, LayoutDashboard, LayoutTemplate, Menu as MenuIcon, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { navigate, paths, type Route } from '../../state/router';
import { useStore } from '../../state/store';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/layout';
import { useSessionActions } from '../useSessionActions';
import { BrandMark } from './BrandMark';

type NavKey = 'dashboard' | 'quotes' | 'templates' | 'business' | 'pricing' | 'data';

function activeKey(route: Route): NavKey | null {
  switch (route.name) {
    case 'dashboard':
      return 'dashboard';
    case 'quotes':
    case 'quote':
      return 'quotes';
    case 'templates':
    case 'template':
      return 'templates';
    case 'business':
    case 'pricing':
    case 'data':
      return route.name;
    default:
      return null;
  }
}

export function AppShell({ route, children }: { route: Route; children: ReactNode }) {
  const { state, actions } = useStore();
  const { exportBackup } = useSessionActions();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const active = activeKey(route);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const newQuote = () => {
    setDrawerOpen(false);
    navigate(paths.quote(actions.newQuote()));
  };

  const link = (key: NavKey, href: string, label: string, Icon: typeof Files, extra?: ReactNode) => (
    <a href={href} className={`nav-item ${active === key ? 'is-active' : ''}`} aria-current={active === key ? 'page' : undefined}>
      <Icon size={18} aria-hidden className="nav-item__icon" />
      <span>{label}</span>
      {extra}
    </a>
  );

  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => (e.preventDefault(), document.getElementById('main')?.focus())}>
        Skip to content
      </a>
      <div className="shell">
        <aside className={`sidebar ${drawerOpen ? 'is-open' : ''}`} aria-label="Main navigation" id="sidebar">
          <div className="sidebar__brand">
            <BrandMark />
            <span className="sidebar__name">TradeMaker</span>
            <button type="button" className="sidebar__close" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
              <X size={20} aria-hidden />
            </button>
          </div>
          <nav
            className="sidebar__nav"
            onClick={(e) => {
              if ((e.target as Element).closest('a')) setDrawerOpen(false);
            }}
          >
            {link('dashboard', paths.dashboard, 'Dashboard', LayoutDashboard)}
            <button type="button" className="nav-item nav-item--cta" onClick={newQuote}>
              <FilePlus size={18} aria-hidden className="nav-item__icon" />
              <span>New Quote</span>
            </button>
            {link('quotes', paths.quotes, 'Quotes', Files, state.quotes.length > 0 ? <span className="nav-item__count">{state.quotes.length}</span> : null)}
            {link('templates', paths.templates, 'Templates', LayoutTemplate)}
            <p className="sidebar__section">Settings</p>
            {link('business', paths.business, 'Business Profile', Building)}
            {link('pricing', paths.pricing, 'Pricing Settings', SlidersHorizontal)}
            {link('data', paths.data, 'Data & Backup', DatabaseBackup)}
          </nav>
          <div className="sidebar__footer">
            <p className="sidebar__note">
              <strong>Session only.</strong> Nothing is saved automatically. Export a backup to keep your work.
            </p>
            <button type="button" className="sidebar__export" onClick={() => exportBackup('full')}>
              <Download size={15} aria-hidden /> Export backup
            </button>
          </div>
        </aside>
        {drawerOpen && <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden />}

        <div className="shell__main">
          <header className="topbar">
            <button
              type="button"
              className="topbar__menu"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              aria-controls="sidebar"
            >
              <MenuIcon size={20} aria-hidden />
            </button>
            <div className="topbar__business">
              <span className="topbar__logo">
                {state.business.logoDataUrl ? <img src={state.business.logoDataUrl} alt="" /> : <BrandMark size={22} />}
              </span>
              <span className="topbar__name">{state.business.name.trim() || 'Your business'}</span>
              {state.isSampleSession && <Badge tone="sample">Sample data</Badge>}
            </div>
            <div className="topbar__actions">
              <span className={`save-state ${state.changedSinceExport ? 'is-dirty' : ''}`} role="status">
                <span className="save-state__dot" aria-hidden />
                {state.changedSinceExport ? 'Not backed up' : state.lastExportAt ? 'Backed up' : 'Session only'}
              </span>
              <Button size="sm" variant="ghost" icon={Download} onClick={() => exportBackup('full')} className="hide-sm">
                Export
              </Button>
              <Button size="sm" variant="primary" icon={FilePlus} onClick={newQuote}>
                <span className="hide-xs">New quote</span>
                <span className="show-xs">New</span>
              </Button>
            </div>
          </header>
          <main id="main" tabIndex={-1} className="main">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
