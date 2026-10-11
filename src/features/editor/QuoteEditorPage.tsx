import { ArrowLeft, Copy, Download, Ellipsis, FileBraces, LayoutTemplate, Printer, Trash } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TRADE_LABELS } from '../../data/regions';
import { calculateQuote } from '../../domain/calc';
import { buildCustomerDocument } from '../../domain/customerDocument';
import { applyPricingMode } from '../../domain/pricingMode';
import type { LineItem, PricingMode, Quote, QuoteDisplayOptions } from '../../domain/types';
import { useFmt } from '../../format/useFmt';
import { navigate, paths } from '../../state/router';
import { useStore } from '../../state/store';
import { Button, LinkButton } from '../../ui/Button';
import { useFeedback } from '../../ui/feedback';
import { Badge, Callout, Card, EmptyState } from '../../ui/layout';
import { Menu } from '../../ui/Menu';
import { usePrint } from '../document/print';
import { PreviewPanel } from '../document/PreviewPanel';
import { useQuoteExport } from '../document/useQuoteExport';
import { StatusBadge } from '../status';
import { LineItemsEditor } from './LineItemsEditor';
import { ProfitPanel } from './ProfitPanel';
import {
  CostsSection,
  CustomerSection,
  JobDetailsSection,
  PricingModeControl,
  PricingSection,
  TaxDepositSection,
  TermsSection,
} from './QuoteSections';

type View = 'edit' | 'preview' | 'profit';

export function QuoteEditorPage({ id }: { id: string }) {
  const { state } = useStore();
  const quote = state.quotes.find((q) => q.id === id);
  if (!quote) {
    return (
      <div className="page">
        <EmptyState
          title="Quote not found"
          actions={
            <LinkButton href={paths.quotes} variant="primary">
              View session quotes
            </LinkButton>
          }
        >
          This quote isn't in the current session. Quotes are kept in memory only, so refreshing or closing the page clears them unless you exported a
          backup.
        </EmptyState>
      </div>
    );
  }
  return <QuoteEditor quote={quote} />;
}

function QuoteEditor({ quote }: { quote: Quote }) {
  const { state, actions } = useStore();
  const { toast, confirm } = useFeedback();
  const { registerDocument } = usePrint();
  const { downloadPdf, print, exportQuoteJson } = useQuoteExport();
  const fmt = useFmt(quote.currency);
  const [view, setView] = useState<View>('edit');
  const id = quote.id;

  const calc = useMemo(() => calculateQuote(quote), [quote]);
  const doc = useMemo(() => buildCustomerDocument(quote, calc, state.business), [quote, calc, state.business]);
  const results = useMemo(() => new Map(calc.lines.map((r) => [r.id, r])), [calc]);

  useEffect(() => {
    registerDocument(doc);
    return () => registerDocument(null);
  }, [doc, registerDocument]);

  const update = useCallback((fn: (q: Quote) => Quote) => actions.updateQuote(id, fn), [actions, id]);
  const setItems = useCallback((fn: (items: LineItem[]) => LineItem[]) => update((q) => ({ ...q, lineItems: fn(q.lineItems) })), [update]);
  const setDisplay = useCallback((patch: Partial<QuoteDisplayOptions>) => update((q) => ({ ...q, display: { ...q.display, ...patch } })), [update]);

  const changeMode = (mode: PricingMode) => {
    if (mode === quote.pricing.mode) return;
    update((q) => applyPricingMode(q, calculateQuote(q), mode));
    if (mode === 'manual' && quote.pricing.mode !== 'manual') {
      toast({ message: 'Automatic prices were kept as fixed prices. Edit them freely.', tone: 'info' });
    } else if (mode !== 'manual' && quote.pricing.mode === 'manual') {
      toast({ message: 'Items with internal costs are now priced automatically. Items without costs kept their price.', tone: 'info' });
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete this quote?',
      message: `${quote.number || 'This quote'}${quote.title ? ` — ${quote.title}` : ''} will be removed from this session.`,
      confirmLabel: 'Delete quote',
      tone: 'danger',
    });
    if (!ok) return;
    const snapshot = quote;
    actions.deleteQuote(id);
    navigate(paths.quotes);
    toast({ message: `Deleted ${snapshot.number || 'quote'}.`, tone: 'info', action: { label: 'Undo', onClick: () => actions.restoreQuote(snapshot) } });
  };

  const businessWarning = !state.business.name.trim() ? (
    <Callout tone="warning" compact className="preview__warning">
      Your business name is missing from the quote. <a href={paths.business}>Add it in Business profile</a>.
    </Callout>
  ) : null;

  const title = quote.title.trim() || 'Untitled quote';

  return (
    <div className="editor">
      <header className="editor-head">
        <div className="editor-head__main">
          <a href={paths.quotes} className="back-link">
            <ArrowLeft size={15} aria-hidden /> Quotes
          </a>
          <h1 className="editor-head__title" tabIndex={-1} data-page-heading>
            <span className="editor-head__number num">{quote.number || 'No number'}</span>
            <span className="editor-head__name">{title}</span>
          </h1>
          <div className="editor-head__meta">
            <StatusBadge status={calc.target.status} compact />
            <span className="muted">{TRADE_LABELS[quote.tradeType]}</span>
            {quote.isSample && <Badge tone="sample">Sample data</Badge>}
            <span className="muted">Session only — export to keep</span>
          </div>
        </div>
        <div className="editor-head__actions">
          <Button icon={Printer} onClick={() => print(doc)} className="hide-sm">
            Print
          </Button>
          <Button variant="primary" icon={Download} onClick={() => downloadPdf(doc)}>
            <span className="hide-xs">Download </span>PDF
          </Button>
          <Menu
            label="More quote actions"
            trigger={<Ellipsis size={18} aria-hidden />}
            triggerClassName="btn btn--secondary btn--md btn--icon"
            items={[
              { label: 'Print / Save as PDF', icon: Printer, onSelect: () => print(doc) },
              {
                label: 'Duplicate quote',
                icon: Copy,
                onSelect: () => {
                  const newId = actions.duplicateQuote(id);
                  if (newId) {
                    navigate(paths.quote(newId));
                    toast({ message: 'Duplicated. You are now editing the copy.', tone: 'success' });
                  }
                },
              },
              {
                label: 'Save as template',
                icon: LayoutTemplate,
                onSelect: () => {
                  const tplId = actions.templateFromQuote(id, `${title} template`);
                  if (tplId) {
                    toast({
                      message: 'Saved as a reusable template.',
                      tone: 'success',
                      action: { label: 'Open template', onClick: () => navigate(paths.template(tplId)) },
                    });
                  }
                },
              },
              { label: 'Export quote (JSON)', icon: FileBraces, onSelect: () => exportQuoteJson(quote) },
              { label: 'Delete quote', icon: Trash, danger: true, onSelect: remove },
            ]}
          />
        </div>
      </header>

      <div className="editor-tabs" role="tablist" aria-label="Quote views">
        {(
          [
            ['edit', 'Edit'],
            ['preview', 'Preview'],
            ['profit', 'Profit'],
          ] as const
        ).map(([v, label]) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} className={`editor-tab ${view === v ? 'is-active' : ''}`} onClick={() => setView(v)}>
            {label}
          </button>
        ))}
      </div>

      <div className={`editor-grid view-${view}`}>
        <div className="editor-main">
          {quote.isSample && (
            <Callout tone="info" compact>
              This is a sample quote for a fictional business. Its customers, prices and costs are invented for demonstration.
            </Callout>
          )}
          <JobDetailsSection quote={quote} calc={calc} update={update} fmt={fmt} />
          <CustomerSection quote={quote} calc={calc} update={update} fmt={fmt} />

          <Card
            title="Line items"
            subtitle="What the customer sees and pays for, plus your internal costs per item."
            id="section-items"
            actions={<span className="money items-total">{fmt.money(calc.itemsSubtotal)}</span>}
          >
            <PricingModeControl quote={quote} calc={calc} update={update} fmt={fmt} onModeChange={changeMode} />
            <LineItemsEditor
              items={quote.lineItems}
              onChange={setItems}
              results={results}
              issues={calc.issues}
              pricingMode={quote.pricing.mode}
              taxEnabled={quote.tax.mode !== 'none'}
              fmt={fmt}
              laborRate={quote.pricing.laborCostPerHour}
              defaultCrew={quote.pricing.defaultCrewSize}
              tradeType={quote.tradeType}
              presets={state.presets}
            />
            <TotalsMini calc={calc} fmt={fmt} />
          </Card>

          <CostsSection quote={quote} calc={calc} update={update} fmt={fmt} />
          <PricingSection quote={quote} calc={calc} update={update} fmt={fmt} />
          <TaxDepositSection quote={quote} calc={calc} update={update} fmt={fmt} />
          <TermsSection quote={quote} calc={calc} update={update} fmt={fmt} />
        </div>

        <aside className="editor-side" aria-label="Profit and preview">
          <div className="side-profit">
            <ProfitPanel
              calc={calc}
              fmt={fmt}
              discountWarningPercent={state.pricing.discountWarningPercent}
              onUseTargetPricing={() => changeMode('targetMargin')}
            />
          </div>
          <div className="side-preview">
            <PreviewPanel
              doc={doc}
              display={quote.display}
              onDisplayChange={setDisplay}
              onPrint={() => print(doc)}
              onPdf={() => downloadPdf(doc)}
              extraWarning={businessWarning}
            />
          </div>
        </aside>
      </div>

      <button type="button" className={`mobile-summary mobile-summary--${calc.target.status}`} onClick={() => setView(view === 'profit' ? 'edit' : 'profit')}>
        <span className="mobile-summary__item">
          <span className="mobile-summary__k">Total</span>
          <span className="money">{fmt.money(calc.total)}</span>
        </span>
        <span className="mobile-summary__item">
          <span className="mobile-summary__k">Profit</span>
          <span className="money">{fmt.money(calc.profit.profit)}</span>
        </span>
        <span className="mobile-summary__item">
          <span className="mobile-summary__k">Margin</span>
          <span className="num">{fmt.pct(calc.profit.marginPercent)}</span>
        </span>
        <StatusBadge status={calc.target.status} compact />
      </button>
    </div>
  );
}

function TotalsMini({ calc, fmt }: { calc: ReturnType<typeof calculateQuote>; fmt: ReturnType<typeof useFmt> }) {
  const rows: [string, string, string?][] = [['Items subtotal', fmt.money(calc.itemsSubtotal)]];
  const discount: [string, string, string?] | null = calc.discount.amount > 0 ? ['Discount', `−${fmt.money(calc.discount.amount)}`] : null;
  const minimum: [string, string, string?] | null =
    calc.minimumCharge.adjustment > 0 ? ['Minimum charge adjustment', fmt.money(calc.minimumCharge.adjustment), 'info'] : null;
  for (const r of calc.minimumCharge.basis === 'beforeDiscount' ? [minimum, discount] : [discount, minimum]) if (r) rows.push(r);
  if (calc.tax.mode === 'exclusive') rows.push(['Tax', fmt.money(calc.tax.total)]);
  return (
    <dl className="totals-mini">
      {rows.map(([k, v, tone]) => (
        <div key={k} className={tone ? `totals-mini__row totals-mini__row--${tone}` : 'totals-mini__row'}>
          <dt>{k}</dt>
          <dd className="money">{v}</dd>
        </div>
      ))}
      <div className="totals-mini__row totals-mini__row--total">
        <dt>Total{calc.tax.mode === 'inclusive' ? ` (incl. ${fmt.money(calc.tax.total)} tax)` : ''}</dt>
        <dd className="money">{fmt.money(calc.total)}</dd>
      </div>
      {calc.optionalItemsTotal > 0 && (
        <div className="totals-mini__row totals-mini__row--muted">
          <dt>Optional extras offered (not in total)</dt>
          <dd className="money">{fmt.money(calc.optionalItemsTotal)}</dd>
        </div>
      )}
    </dl>
  );
}
