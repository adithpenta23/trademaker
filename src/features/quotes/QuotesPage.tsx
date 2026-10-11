import { Copy, Download, Ellipsis, FileBraces, FilePlus, Files, Printer, Search, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { TRADE_LABELS } from '../../data/regions';
import { calculateQuote, type ProfitStatus } from '../../domain/calc';
import { TRADE_TYPES, type Quote, type TradeType } from '../../domain/types';
import { makeFmt } from '../../format/useFmt';
import { navigate, paths } from '../../state/router';
import { useStore } from '../../state/store';
import { Button, LinkButton } from '../../ui/Button';
import { useFeedback } from '../../ui/feedback';
import { SelectField } from '../../ui/fields';
import { Badge, Callout, EmptyState, PageHeader } from '../../ui/layout';
import { Menu } from '../../ui/Menu';
import { useQuoteExport } from '../document/useQuoteExport';
import { StatusBadge } from '../status';

type ProfitFilter = 'all' | 'healthy' | 'below' | 'loss' | 'noRevenue';
type Sort = 'dateDesc' | 'dateAsc' | 'customer' | 'totalDesc' | 'totalAsc';

const PROFIT_GROUPS: Record<Exclude<ProfitFilter, 'all'>, ProfitStatus[]> = {
  healthy: ['healthy'],
  below: ['belowTarget', 'lowMargin'],
  loss: ['loss', 'invalid'],
  noRevenue: ['noRevenue'],
};

export function QuotesPage() {
  const { state, actions } = useStore();
  const { toast, confirm } = useFeedback();
  const { documentFor, downloadPdf, print, exportQuoteJson } = useQuoteExport();
  const [query, setQuery] = useState('');
  const [trade, setTrade] = useState<'all' | TradeType>('all');
  const [profit, setProfit] = useState<ProfitFilter>('all');
  const [sort, setSort] = useState<Sort>('dateDesc');
  const b = state.business;

  const rows = useMemo(() => state.quotes.map((q) => ({ q, c: calculateQuote(q) })), [state.quotes]);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = rows.filter(({ q, c }) => {
      if (trade !== 'all' && q.tradeType !== trade) return false;
      if (profit !== 'all' && !PROFIT_GROUPS[profit].includes(c.target.status)) return false;
      if (!term) return true;
      return [q.number, q.title, q.customer.name, q.customer.company].some((v) => v.toLowerCase().includes(term));
    });
    const byCustomer = (q: Quote) => (q.customer.name || q.customer.company).trim().toLowerCase();
    return filtered.sort((a, z) => {
      switch (sort) {
        case 'dateAsc':
          return a.q.createdDate.localeCompare(z.q.createdDate) || a.q.createdAt.localeCompare(z.q.createdAt);
        case 'customer': {
          // Quotes without a customer sort last.
          const x = byCustomer(a.q);
          const y = byCustomer(z.q);
          return x && y ? x.localeCompare(y) : x ? -1 : y ? 1 : 0;
        }
        case 'totalDesc':
          return z.c.total - a.c.total;
        case 'totalAsc':
          return a.c.total - z.c.total;
        default:
          return z.q.createdDate.localeCompare(a.q.createdDate) || z.q.createdAt.localeCompare(a.q.createdAt);
      }
    });
  }, [rows, query, trade, profit, sort]);

  const remove = async (q: Quote) => {
    const ok = await confirm({
      title: 'Delete this quote?',
      message: `${q.number || 'This quote'}${q.title ? ` — ${q.title}` : ''} will be removed from this session.`,
      confirmLabel: 'Delete quote',
      tone: 'danger',
    });
    if (!ok) return;
    actions.deleteQuote(q.id);
    toast({ message: `Deleted ${q.number || 'quote'}.`, tone: 'info', action: { label: 'Undo', onClick: () => actions.restoreQuote(q) } });
  };

  const filtersActive = query || trade !== 'all' || profit !== 'all';

  return (
    <div className="page">
      <PageHeader
        title="Quotes"
        subtitle="Quotes created in this browser session. They disappear when the page is closed unless you export them."
        actions={
          <Button variant="primary" icon={FilePlus} onClick={() => navigate(paths.quote(actions.newQuote()))}>
            New quote
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Files size={28} aria-hidden />}
          title="No quotes in this session yet"
          actions={
            <>
              <Button variant="primary" icon={FilePlus} onClick={() => navigate(paths.quote(actions.newQuote()))}>
                Create a quote
              </Button>
              <LinkButton href={paths.data}>Import a backup</LinkButton>
            </>
          }
        >
          Create a new quote, start from a template, or import a backup you exported earlier.
        </EmptyState>
      ) : (
        <>
          <div className="filters" role="search">
            <div className="field filters__search">
              <label className="field__label" htmlFor="quote-search">
                Search
              </label>
              <div className="input-group">
                <span className="input-affix input-affix--pre">
                  <Search size={15} aria-hidden />
                </span>
                <input
                  id="quote-search"
                  className="input"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Quote number, customer or job title"
                />
              </div>
            </div>
            <SelectField
              label="Trade"
              value={trade}
              onChange={setTrade}
              options={[{ value: 'all', label: 'All trades' }, ...TRADE_TYPES.map((t) => ({ value: t, label: TRADE_LABELS[t] }))]}
            />
            <SelectField
              label="Profitability"
              value={profit}
              onChange={setProfit}
              options={[
                { value: 'all', label: 'All' },
                { value: 'healthy', label: 'On target' },
                { value: 'below', label: 'Below target' },
                { value: 'loss', label: 'Loss or needs attention' },
                { value: 'noRevenue', label: 'No price yet' },
              ]}
            />
            <SelectField
              label="Sort by"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'dateDesc', label: 'Newest first' },
                { value: 'dateAsc', label: 'Oldest first' },
                { value: 'customer', label: 'Customer A–Z' },
                { value: 'totalDesc', label: 'Total: high to low' },
                { value: 'totalAsc', label: 'Total: low to high' },
              ]}
            />
          </div>
          <p className="muted small" aria-live="polite">
            Showing {visible.length} of {rows.length} quote{rows.length === 1 ? '' : 's'}
            {filtersActive && (
              <>
                {' · '}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setQuery('');
                    setTrade('all');
                    setProfit('all');
                  }}
                >
                  Clear filters
                </button>
              </>
            )}
          </p>

          {visible.length === 0 ? (
            <Callout tone="neutral">No quotes match these filters.</Callout>
          ) : (
            <div className="table-wrap">
              <table className="table quotes-table">
                <thead>
                  <tr>
                    <th scope="col">Quote</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Date</th>
                    <th scope="col" className="num-col">
                      Total
                    </th>
                    <th scope="col" className="num-col">
                      Est. margin
                    </th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(({ q, c }) => {
                    const f = makeFmt(b.locale, q.currency, b.dateFormat);
                    return (
                      <tr key={q.id}>
                        <td data-label="Quote">
                          <a href={paths.quote(q.id)} className="quotes-table__link">
                            <span className="num quotes-table__number">{q.number || 'No number'}</span>
                            <span className="quotes-table__title">{q.title || 'Untitled quote'}</span>
                          </a>
                          <span className="muted small">
                            {TRADE_LABELS[q.tradeType]}
                            {q.isSample && (
                              <>
                                {' '}
                                <Badge tone="sample">Sample</Badge>
                              </>
                            )}
                          </span>
                        </td>
                        <td data-label="Customer">{q.customer.name || q.customer.company || <span className="muted">—</span>}</td>
                        <td data-label="Date" className="num">
                          {f.date(q.createdDate)}
                        </td>
                        <td data-label="Total" className="num-col money">
                          {f.money(c.total)}
                        </td>
                        <td data-label="Est. margin" className="num-col">
                          <span className="quotes-table__margin">
                            <span className="num">{f.pct(c.profit.marginPercent)}</span>
                            <StatusBadge status={c.target.status} compact />
                          </span>
                        </td>
                        <td className="quotes-table__actions">
                          <LinkButton href={paths.quote(q.id)} size="sm">
                            Open
                          </LinkButton>
                          <Menu
                            label={`More actions for ${q.number || 'quote'}`}
                            trigger={<Ellipsis size={16} aria-hidden />}
                            triggerClassName="btn btn--ghost btn--sm btn--icon"
                            items={[
                              {
                                label: 'Duplicate',
                                icon: Copy,
                                onSelect: () => {
                                  actions.duplicateQuote(q.id);
                                  toast({ message: `Duplicated ${q.number || 'quote'}.`, tone: 'success' });
                                },
                              },
                              { label: 'Download PDF', icon: Download, onSelect: () => downloadPdf(documentFor(q)) },
                              { label: 'Print / Save as PDF', icon: Printer, onSelect: () => print(documentFor(q)) },
                              { label: 'Export JSON', icon: FileBraces, onSelect: () => exportQuoteJson(q) },
                              { label: 'Delete', icon: Trash, danger: true, onSelect: () => remove(q) },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
