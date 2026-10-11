import { Building, ChevronRight, DatabaseBackup, Download, FilePlus, LayoutTemplate, Sparkles, SlidersHorizontal } from 'lucide-react';
import { useMemo } from 'react';
import { TRADE_LABELS } from '../../data/regions';
import { calculateQuote } from '../../domain/calc';
import { ratioPercent } from '../../domain/money';
import { makeFmt, useFmt } from '../../format/useFmt';
import { navigate, paths } from '../../state/router';
import { useStore } from '../../state/store';
import { Button, LinkButton } from '../../ui/Button';
import { Badge, Callout, Card, PageHeader } from '../../ui/layout';
import { StatusBadge } from '../status';
import { useSessionActions } from '../useSessionActions';

export function DashboardPage() {
  const { state, actions } = useStore();
  const fmt = useFmt();
  const { exportBackup, loadDemo, clearSession } = useSessionActions();
  const b = state.business;

  const rows = useMemo(() => state.quotes.map((q) => ({ q, c: calculateQuote(q) })), [state.quotes]);
  const inCurrency = rows.filter((r) => r.q.currency === b.currency);
  const otherCurrency = rows.length - inCurrency.length;
  const quoted = inCurrency.reduce((a, r) => a + r.c.total, 0);
  const revenue = inCurrency.reduce((a, r) => a + r.c.revenueExTax, 0);
  const profit = inCurrency.reduce((a, r) => a + r.c.profit.profit, 0);
  const combinedMargin = ratioPercent(profit, revenue);
  const below = rows.filter((r) => ['belowTarget', 'lowMargin', 'loss'].includes(r.c.target.status)).length;
  const recent = [...rows].sort((a, z) => z.q.updatedAt.localeCompare(a.q.updatedAt)).slice(0, 6);

  const newQuote = () => navigate(paths.quote(actions.newQuote()));
  const greeting = b.name.trim() ? b.name : 'Welcome to TradeMaker';

  return (
    <div className="page">
      <PageHeader
        eyebrow={state.isSampleSession ? <Badge tone="sample">Sample data — fictional business</Badge> : 'Dashboard'}
        title={greeting}
        subtitle="Quote confidently. Know your costs. Protect your profit."
        actions={
          <>
            <LinkButton href={paths.templates} icon={LayoutTemplate}>
              From template
            </LinkButton>
            <Button variant="primary" icon={FilePlus} onClick={newQuote}>
              Create new quote
            </Button>
          </>
        }
      />

      <Callout
        tone={state.changedSinceExport ? 'warning' : 'info'}
        title={state.changedSinceExport ? 'Unsaved session — export to keep your work' : 'Session-only data'}
        action={
          <Button size="sm" icon={Download} onClick={() => exportBackup('full')}>
            Export backup
          </Button>
        }
      >
        Everything here lives only in this browser tab — nothing is uploaded or saved automatically. Refreshing or closing the page clears it. Export a
        JSON backup and import it next time to continue.
      </Callout>

      {rows.length === 0 ? (
        <section className="onboard" aria-labelledby="onboard-title">
          <div className="onboard__intro">
            <h2 id="onboard-title">Start your first quote</h2>
            <p>Build a customer-ready quote in a few minutes and see exactly what the job will cost you and earn you before you send it.</p>
            <div className="onboard__actions">
              <Button variant="primary" size="lg" icon={FilePlus} onClick={newQuote}>
                Create new quote
              </Button>
              <LinkButton href={paths.templates} size="lg" icon={LayoutTemplate}>
                Use a template
              </LinkButton>
              <Button size="lg" variant="ghost" icon={Sparkles} onClick={loadDemo}>
                Load demo
              </Button>
            </div>
          </div>
          <ol className="onboard__steps">
            <li>
              <a href={paths.business}>
                <span className="onboard__num">1</span>
                <span>
                  <strong>Add your business details</strong>
                  <span className="muted">Name, logo, contact details and brand colour for your quotes.</span>
                </span>
                <ChevronRight size={16} aria-hidden />
              </a>
            </li>
            <li>
              <a href={paths.pricing}>
                <span className="onboard__num">2</span>
                <span>
                  <strong>Check your pricing settings</strong>
                  <span className="muted">Labor cost, overhead, target margin, minimum charge and tax.</span>
                </span>
                <ChevronRight size={16} aria-hidden />
              </a>
            </li>
            <li>
              <button type="button" onClick={newQuote}>
                <span className="onboard__num">3</span>
                <span>
                  <strong>Create a quote</strong>
                  <span className="muted">Add items and costs, check the profit, then download the PDF.</span>
                </span>
                <ChevronRight size={16} aria-hidden />
              </button>
            </li>
          </ol>
        </section>
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <span className="stat__k">Quotes this session</span>
              <span className="stat__v num">{rows.length}</span>
              <span className="stat__note">Session only</span>
            </div>
            <div className="stat">
              <span className="stat__k">Combined quote value</span>
              <span className="stat__v money">{fmt.money(quoted)}</span>
              <span className="stat__note">Total of quotes, not revenue{otherCurrency > 0 ? ` · ${otherCurrency} in other currencies excluded` : ''}</span>
            </div>
            <div className="stat">
              <span className="stat__k">Combined estimated margin</span>
              <span className="stat__v num">{fmt.pct(combinedMargin)}</span>
              <span className="stat__note">Estimated profit ÷ revenue across quotes</span>
            </div>
            <div className={`stat ${below > 0 ? 'stat--warn' : ''}`}>
              <span className="stat__k">Below target margin</span>
              <span className="stat__v num">{below}</span>
              <span className="stat__note">{below === 0 ? 'All quotes on target' : 'Review before sending'}</span>
            </div>
          </div>

          <div className="dash-grid">
            <Card
              title="Recent quotes"
              subtitle="From this session"
              actions={
                <LinkButton href={paths.quotes} variant="ghost" size="sm">
                  View all
                </LinkButton>
              }
              className="card--flush"
            >
              <ul className="recent">
                {recent.map(({ q, c }) => {
                  const qf = makeFmt(b.locale, q.currency, b.dateFormat);
                  return (
                    <li key={q.id}>
                      <a href={paths.quote(q.id)} className="recent__row">
                        <span className="recent__main">
                          <span className="recent__title">
                            <span className="num recent__number">{q.number || 'No number'}</span> {q.title || 'Untitled quote'}
                          </span>
                          <span className="muted small">
                            {q.customer.name || q.customer.company || 'No customer'} · {TRADE_LABELS[q.tradeType]}
                            {q.isSample && ' · Sample'}
                          </span>
                        </span>
                        <span className="recent__side">
                          <span className="money recent__total">{qf.money(c.total)}</span>
                          <StatusBadge status={c.target.status} compact />
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <div className="dash-side">
              <Card title="Shortcuts">
                <nav className="shortcuts" aria-label="Shortcuts">
                  <a href={paths.templates}>
                    <LayoutTemplate size={18} aria-hidden /> Templates & trade presets
                  </a>
                  <a href={paths.pricing}>
                    <SlidersHorizontal size={18} aria-hidden /> Pricing settings
                  </a>
                  <a href={paths.business}>
                    <Building size={18} aria-hidden /> Business profile
                  </a>
                  <a href={paths.data}>
                    <DatabaseBackup size={18} aria-hidden /> Data & backup
                  </a>
                </nav>
              </Card>
              <Card title="Session">
                <p className="muted small">Try the app with a fictional business, or start again from a clean slate.</p>
                <div className="button-row">
                  <Button size="sm" icon={Sparkles} onClick={loadDemo}>
                    {state.isSampleSession ? 'Reset demo' : 'Load demo'}
                  </Button>
                  <Button size="sm" variant="ghost" className="btn--danger-ghost" onClick={clearSession}>
                    Clear session
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
