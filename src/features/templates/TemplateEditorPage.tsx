import { ArrowLeft, FilePlus } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { TRADE_LABELS } from '../../data/regions';
import { TRADE_TYPES, type JobCost, type LineItem, type QuoteTemplate } from '../../domain/types';
import { useFmt } from '../../format/useFmt';
import { navigate, paths } from '../../state/router';
import { useStore } from '../../state/store';
import { Button, LinkButton } from '../../ui/Button';
import { useFeedback } from '../../ui/feedback';
import { MoneyField, PercentField, Segmented, SelectField, TextArea, TextField } from '../../ui/fields';
import { Badge, Callout, Card, EmptyState, PageHeader } from '../../ui/layout';
import { JobCostsEditor } from '../editor/JobCostsEditor';
import { LineItemsEditor } from '../editor/LineItemsEditor';
import { previewCalc } from './previewCalc';

export function TemplateEditorPage({ id }: { id: string }) {
  const { state } = useStore();
  const template = state.templates.find((t) => t.id === id);
  if (!template) {
    return (
      <div className="page">
        <EmptyState
          title="Template not found"
          actions={
            <LinkButton href={paths.templates} variant="primary">
              Back to templates
            </LinkButton>
          }
        >
          It may have been deleted, or the session was refreshed.
        </EmptyState>
      </div>
    );
  }
  return <TemplateEditor template={template} />;
}

function TemplateEditor({ template }: { template: QuoteTemplate }) {
  const { state, actions } = useStore();
  const { toast } = useFeedback();
  const fmt = useFmt();
  const id = template.id;
  const update = useCallback((fn: (t: QuoteTemplate) => QuoteTemplate) => actions.updateTemplate(id, fn), [actions, id]);
  const set = (patch: Partial<QuoteTemplate>) => update((t) => ({ ...t, ...patch }));
  const setItems = useCallback((fn: (items: LineItem[]) => LineItem[]) => update((t) => ({ ...t, lineItems: fn(t.lineItems) })), [update]);
  const setJobCosts = useCallback((fn: (c: JobCost[]) => JobCost[]) => update((t) => ({ ...t, jobCosts: fn(t.jobCosts) })), [update]);

  const calc = useMemo(
    () => previewCalc(template.lineItems, template.jobCosts, state.business, state.pricing),
    [template.lineItems, template.jobCosts, state.business, state.pricing],
  );
  const results = useMemo(() => new Map(calc.lines.map((r) => [r.id, r])), [calc]);
  const dep = template.deposit;

  return (
    <div className="page page--narrow">
      <a href={paths.templates} className="back-link">
        <ArrowLeft size={15} aria-hidden /> Templates
      </a>
      <PageHeader
        title={template.name || 'Untitled template'}
        eyebrow={template.isStarter ? <Badge tone="green">Starter template</Badge> : <Badge tone="neutral">Your template</Badge>}
        subtitle="Changes save automatically for this session. Quotes already created from this template are not affected."
        actions={
          <Button
            variant="primary"
            icon={FilePlus}
            onClick={() => {
              const quoteId = actions.newQuoteFromTemplate(id);
              if (quoteId) {
                navigate(paths.quote(quoteId));
                toast({ message: 'New quote created from this template.', tone: 'success' });
              }
            }}
          >
            Use template
          </Button>
        }
      />

      <Card title="About this template">
        <div className="grid grid--2">
          <TextField label="Template name" value={template.name} onChange={(name) => set({ name })} />
          <SelectField
            label="Trade"
            value={template.tradeType}
            onChange={(tradeType) => set({ tradeType })}
            options={TRADE_TYPES.map((t) => ({ value: t, label: TRADE_LABELS[t] }))}
          />
        </div>
        <TextArea label="Description (for you)" value={template.description} onChange={(description) => set({ description })} rows={2} maxLength={1000} />
      </Card>

      <Card title="Quote content" subtitle="Copied into each new quote. Everything stays editable in the quote.">
        <TextField label="Quote title" value={template.title} onChange={(title) => set({ title })} />
        <TextArea label="Scope of work" value={template.scopeOfWork} onChange={(scopeOfWork) => set({ scopeOfWork })} rows={5} />
        <TextArea label="Exclusions" value={template.exclusions} onChange={(exclusions) => set({ exclusions })} rows={2} optional />
        <TextArea label="Notes / milestones for the customer" value={template.customerNotes} onChange={(customerNotes) => set({ customerNotes })} rows={4} optional />
        <TextArea
          label="Payment terms"
          value={template.paymentTerms}
          onChange={(paymentTerms) => set({ paymentTerms })}
          rows={2}
          hint="Leave blank to use your default payment terms from Pricing settings."
        />
      </Card>

      <Card title="Line items" subtitle="Prices here are the starting manual prices. Quotes in cost-based pricing modes recalculate them from costs.">
        <LineItemsEditor
          items={template.lineItems}
          onChange={setItems}
          results={results}
          issues={calc.issues}
          pricingMode="manual"
          taxEnabled={false}
          fmt={fmt}
          laborRate={state.pricing.laborCostPerHour}
          defaultCrew={state.pricing.defaultCrewSize}
          tradeType={template.tradeType}
          presets={state.presets}
          variant="quote"
        />
        <p className="calc-note">
          Items subtotal at these prices: <strong className="money">{fmt.money(calc.itemsSubtotal)}</strong> · direct costs{' '}
          <span className="money">{fmt.money(calc.costs.direct)}</span> (labor at your current {fmt.unitPrice(state.pricing.laborCostPerHour)}/h)
        </p>
      </Card>

      <Card title="Job-level costs" subtitle="Internal costs for the whole job, copied into each quote.">
        <JobCostsEditor costs={template.jobCosts} onChange={setJobCosts} fmt={fmt} />
      </Card>

      <Card title="Deposit">
        <Segmented
          label="Deposit for quotes from this template"
          value={dep === null ? 'default' : dep.type}
          onChange={(v) => set({ deposit: v === 'default' ? null : { type: v, value: v === 'percent' ? (dep?.type === 'percent' ? dep.value : 25) : 0 } })}
          options={[
            { value: 'default', label: 'Use my default' },
            { value: 'none', label: 'None' },
            { value: 'percent', label: '%' },
            { value: 'fixed', label: 'Fixed' },
          ]}
        />
        {dep?.type === 'percent' && <PercentField label="Deposit" value={dep.value} onChange={(value) => set({ deposit: { type: 'percent', value } })} locale={fmt.locale} />}
        {dep?.type === 'fixed' && (
          <MoneyField label="Deposit" value={dep.value} onChange={(value) => set({ deposit: { type: 'fixed', value } })} locale={fmt.locale} currency={fmt.currency} />
        )}
      </Card>

      <Callout tone="neutral" compact>
        Templates don't store pricing rules, tax or overhead — new quotes use your current Pricing settings.
      </Callout>
    </div>
  );
}
