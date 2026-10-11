import { ArrowDownUp, Plus, Trash } from 'lucide-react';
import { TRADE_LABELS } from '../../data/regions';
import type { QuoteCalculation } from '../../domain/calc';
import { priceForMarkup, priceForTargetMargin } from '../../domain/calc';
import { addDays, quoteExpiryDate } from '../../domain/dates';
import { newId } from '../../domain/ids';
import { LIMITS } from '../../domain/limits';
import { TRADE_TYPES, type Quote, type TaxSettings } from '../../domain/types';
import { useStore } from '../../state/store';
import type { Fmt } from '../../format/useFmt';
import { Button } from '../../ui/Button';
import { Checkbox, emailError, MoneyField, NumberField, PercentField, Segmented, SelectField, TextArea, TextField } from '../../ui/fields';
import { Badge, Callout, CollapsibleCard, HelpText } from '../../ui/layout';
import { JobCostsEditor } from './JobCostsEditor';

export type QuoteUpdate = (update: (q: Quote) => Quote) => void;

interface SectionProps {
  quote: Quote;
  calc: QuoteCalculation;
  update: QuoteUpdate;
  fmt: Fmt;
}

export function JobDetailsSection({ quote, update, fmt }: SectionProps) {
  const set = (patch: Partial<Quote>) => update((q) => ({ ...q, ...patch }));
  const expiry = quoteExpiryDate(quote);
  return (
    <CollapsibleCard
      title="Job details"
      summary={`${quote.number || 'No number'} · ${fmt.date(quote.createdDate)}`}
      id="section-details"
    >
      <div className="grid grid--3">
        <TextField
          label="Quote number"
          value={quote.number}
          onChange={(number) => set({ number })}
          maxLength={40}
          hint="Generated for this session; edit freely."
          error={quote.number.trim() ? null : 'Add a quote number so you and your customer can refer to it.'}
        />
        <TextField label="Quote title" value={quote.title} onChange={(title) => set({ title })} placeholder="e.g. Exterior house wash" className="grid__span-2" />
        <TextField label="Quote date" type="date" value={quote.createdDate} onChange={(v) => v && set({ createdDate: v })} />
        <NumberField
          label="Valid for"
          value={quote.validityDays}
          onChange={(validityDays) => set({ validityDays })}
          locale={fmt.locale}
          integer
          min={LIMITS.validityDays.min}
          max={LIMITS.validityDays.max}
          suffix="days"
          disabled={quote.expiryDate !== null}
        />
        <div className="field">
          {quote.expiryDate !== null ? (
            <TextField label="Valid until" type="date" value={quote.expiryDate} onChange={(v) => set({ expiryDate: v || null })} />
          ) : (
            <>
              <span className="field__label">Valid until</span>
              <p className="field__static">{fmt.date(expiry)}</p>
            </>
          )}
          <Checkbox
            label="Set a specific date"
            checked={quote.expiryDate !== null}
            onChange={(on) => set({ expiryDate: on ? addDays(quote.createdDate, quote.validityDays) : null })}
          />
        </div>
        <TextField label="Planned job date" type="date" value={quote.jobDate ?? ''} onChange={(v) => set({ jobDate: v || null })} optional />
        <TextField label="Duration" value={quote.duration} onChange={(duration) => set({ duration })} placeholder="e.g. 1 day" maxLength={80} optional />
        <SelectField
          label="Job category"
          value={quote.tradeType}
          onChange={(tradeType) => set({ tradeType })}
          options={TRADE_TYPES.map((t) => ({ value: t, label: TRADE_LABELS[t] }))}
        />
      </div>
      <TextArea
        label="Scope of work"
        value={quote.scopeOfWork}
        onChange={(scopeOfWork) => set({ scopeOfWork })}
        rows={4}
        placeholder="Describe what's included, step by step if helpful."
        hint="Shown to the customer."
      />
      <TextArea label="Exclusions" value={quote.exclusions} onChange={(exclusions) => set({ exclusions })} rows={2} placeholder="What is not included." optional />
    </CollapsibleCard>
  );
}

export function CustomerSection({ quote, update }: SectionProps) {
  const c = quote.customer;
  const set = (patch: Partial<Quote['customer']>) => update((q) => ({ ...q, customer: { ...q.customer, ...patch } }));
  return (
    <CollapsibleCard title="Customer" summary={c.name || c.company || 'No customer yet'} id="section-customer">
      <div className="grid grid--2">
        <TextField label="Customer name" value={c.name} onChange={(name) => set({ name })} autoComplete="off" />
        <TextField label="Company" value={c.company} onChange={(company) => set({ company })} optional />
        <TextField label="Email" type="email" value={c.email} onChange={(email) => set({ email })} error={emailError(c.email)} optional maxLength={254} />
        <TextField label="Phone" type="tel" value={c.phone} onChange={(phone) => set({ phone })} optional maxLength={60} />
      </div>
      <div className="grid grid--2 address-pair">
        <TextArea label="Billing address" value={c.billingAddress} onChange={(billingAddress) => set({ billingAddress })} rows={3} maxLength={1000} optional />
        <TextArea label="Service address" value={c.serviceAddress} onChange={(serviceAddress) => set({ serviceAddress })} rows={3} maxLength={1000} optional />
      </div>
      <div className="address-copy">
        <Button size="sm" variant="ghost" icon={ArrowDownUp} disabled={!c.billingAddress.trim()} onClick={() => set({ serviceAddress: c.billingAddress })}>
          Copy billing → service
        </Button>
        <Button size="sm" variant="ghost" icon={ArrowDownUp} disabled={!c.serviceAddress.trim()} onClick={() => set({ billingAddress: c.serviceAddress })}>
          Copy service → billing
        </Button>
      </div>
      <TextArea
        label={
          <>
            Job location notes <Badge tone="neutral">Internal</Badge>
          </>
        }
        value={c.locationNotes}
        onChange={(locationNotes) => set({ locationNotes })}
        rows={2}
        maxLength={2000}
        placeholder="Access, parking, gate codes, pets…"
        hint="For you and your crew only — never printed on the quote."
      />
    </CollapsibleCard>
  );
}

export function PricingModeControl({ quote, calc, fmt, onModeChange, update }: SectionProps & { onModeChange: (mode: Quote['pricing']['mode']) => void }) {
  const p = quote.pricing;
  const setPricing = (patch: Partial<Quote['pricing']>) => update((q) => ({ ...q, pricing: { ...q.pricing, ...patch } }));
  const exampleCost = 10_000 * 10 ** (calc.decimals - 2);
  const marginExample = priceForTargetMargin(exampleCost, p.targetMarginPercent);
  const markupExample = priceForMarkup(exampleCost, p.markupPercent);
  return (
    <div className="pricing-mode">
      <Segmented
        label="How should prices be set?"
        value={p.mode}
        onChange={onModeChange}
        options={[
          { value: 'manual', label: 'I set prices', description: 'Enter customer prices yourself and see the resulting profit.' },
          { value: 'targetMargin', label: 'Target margin', description: 'Calculate prices from costs to hit a gross margin.' },
          { value: 'markup', label: 'Markup on cost', description: 'Calculate prices by adding a markup to costs.' },
        ]}
      />
      <div className="pricing-mode__inputs">
        <PercentField
          label="Target margin"
          value={p.targetMarginPercent}
          onChange={(targetMarginPercent) => setPricing({ targetMarginPercent })}
          locale={fmt.locale}
          max={LIMITS.targetMargin.max}
          maxMessage="A margin of 100% or more is impossible — it would need an infinite price."
          hint={marginExample !== null ? `Cost ${fmt.money(exampleCost)} → price ${fmt.money(marginExample)}` : undefined}
        />
        {p.mode === 'markup' && (
          <NumberField
            label="Markup on cost"
            value={p.markupPercent}
            onChange={(markupPercent) => setPricing({ markupPercent })}
            locale={fmt.locale}
            max={LIMITS.markup.max}
            suffix="%"
            hint={`Cost ${fmt.money(exampleCost)} → price ${fmt.money(markupExample)}`}
          />
        )}
        <p className="pricing-mode__explain">
          {p.mode === 'manual' && 'You enter each price. The profit panel compares the result with your target margin.'}
          {p.mode === 'targetMargin' &&
            'Items marked Auto are priced from their costs (plus job costs and overhead) so the quote reaches the target margin before discounts.'}
          {p.mode === 'markup' && 'Items marked Auto are priced at cost plus this markup. Job costs and overhead are spread across them.'}{' '}
          <HelpText label="Margin vs markup?">
            Margin is profit ÷ price. Markup is profit ÷ cost. A {fmt.pct(p.targetMarginPercent, 0)} margin on a {fmt.money(exampleCost)} cost needs a{' '}
            {marginExample !== null ? fmt.money(marginExample) : '—'} price, while a {fmt.pct(p.targetMarginPercent, 0)} markup gives only{' '}
            {fmt.money(priceForMarkup(exampleCost, p.targetMarginPercent))}.
          </HelpText>
        </p>
      </div>
    </div>
  );
}

export function CostsSection({ quote, calc, update, fmt }: SectionProps) {
  const p = quote.pricing;
  const setPricing = (patch: Partial<Quote['pricing']>) => update((q) => ({ ...q, pricing: { ...q.pricing, ...patch } }));
  const oh = p.overhead;
  return (
    <CollapsibleCard
      title="Job costs & overhead"
      subtitle="Internal — used for profit, never shown to the customer."
      summary={`Direct ${fmt.money(calc.costs.direct)} · Overhead ${fmt.money(calc.costs.overhead)}`}
      id="section-costs"
    >
      <div className="grid grid--3">
        <MoneyField
          label="Labor cost per hour"
          value={p.laborCostPerHour}
          onChange={(laborCostPerHour) => setPricing({ laborCostPerHour })}
          locale={fmt.locale}
          currency={fmt.currency}
          suffix="/h"
          hint="What an hour of labor costs you — not what you bill."
        />
        <SelectField
          label="This rate is"
          value={p.laborRateBasis}
          onChange={(laborRateBasis) => setPricing({ laborRateBasis })}
          options={[
            { value: 'burdened', label: 'Fully burdened (wages + taxes, insurance, benefits)' },
            { value: 'wages', label: 'Wages only' },
          ]}
          hint={p.laborRateBasis === 'wages' ? 'Payroll taxes and insurance are not included — consider covering them in overhead.' : undefined}
        />
        <NumberField
          label="Default crew for new items"
          value={p.defaultCrewSize}
          onChange={(defaultCrewSize) => setPricing({ defaultCrewSize })}
          locale={fmt.locale}
          integer
          min={1}
          max={LIMITS.crew.max}
          suffix="people"
        />
      </div>

      <h3 className="subhead">Non-billable job labor</h3>
      <p className="muted small">Setup, travel time, cleanup and other time not tied to one item.</p>
      <div className="grid grid--3">
        <NumberField label="Hours" value={quote.extraLaborHours} onChange={(extraLaborHours) => update((q) => ({ ...q, extraLaborHours }))} locale={fmt.locale} max={LIMITS.hours.max} suffix="h" />
        <NumberField
          label="Crew"
          value={quote.extraLaborCrew}
          onChange={(extraLaborCrew) => update((q) => ({ ...q, extraLaborCrew }))}
          locale={fmt.locale}
          integer
          min={1}
          max={LIMITS.crew.max}
          suffix="people"
        />
        <div className="field">
          <span className="field__label">Cost</span>
          <p className="field__static money">{fmt.money(calc.extraLaborCost)}</p>
        </div>
      </div>

      <h3 className="subhead">Other job-level costs</h3>
      <p className="muted small">Disposal fees, permits, equipment hire, subcontractors — costs for the whole job. Each is counted once.</p>
      <JobCostsEditor costs={quote.jobCosts} onChange={(fn) => update((q) => ({ ...q, jobCosts: fn(q.jobCosts) }))} fmt={fmt} />

      <h3 className="subhead">Overhead allocation</h3>
      <div className="grid grid--2">
        <SelectField
          label="Allocate overhead"
          value={oh.method}
          onChange={(method) => setPricing({ overhead: { ...oh, method } })}
          options={[
            { value: 'none', label: "Don't allocate overhead" },
            { value: 'perJob', label: 'Fixed amount per job' },
            { value: 'perLaborHour', label: 'Amount per labor hour' },
            { value: 'percentOfDirectCost', label: 'Percentage of direct costs' },
          ]}
        />
        {oh.method === 'percentOfDirectCost' ? (
          <PercentField label="Overhead rate" value={oh.amount} onChange={(amount) => setPricing({ overhead: { ...oh, amount } })} locale={fmt.locale} max={1000} />
        ) : oh.method !== 'none' ? (
          <MoneyField
            label={oh.method === 'perJob' ? 'Overhead per job' : 'Overhead per labor hour'}
            value={oh.amount}
            onChange={(amount) => setPricing({ overhead: { ...oh, amount } })}
            locale={fmt.locale}
            currency={fmt.currency}
          />
        ) : null}
      </div>
      <p className="calc-note">
        {oh.method === 'none' && 'Overhead (rent, vehicles, insurance, admin) is not included. Profit shown is before overhead.'}
        {oh.method === 'perJob' && `Every job carries ${fmt.money(calc.costs.overhead)} of overhead.`}
        {oh.method === 'perLaborHour' && `${fmt.num(calc.laborHours)} labor hours × ${fmt.unitPrice(oh.amount)} = ${fmt.money(calc.costs.overhead)} overhead.`}
        {oh.method === 'percentOfDirectCost' &&
          `${fmt.pct(oh.amount)} of ${fmt.money(calc.costs.direct)} direct costs = ${fmt.money(calc.costs.overhead)} overhead. Based on cost, not price, so it never feeds back into itself.`}
      </p>
    </CollapsibleCard>
  );
}

export function PricingSection({ quote, calc, update, fmt }: SectionProps) {
  const { defaultDiscountType } = useStore().state.pricing;
  const p = quote.pricing;
  const d = quote.discount;
  const setPricing = (patch: Partial<Quote['pricing']>) => update((q) => ({ ...q, pricing: { ...q.pricing, ...patch } }));
  const setDiscount = (patch: Partial<Quote['discount']>) => update((q) => ({ ...q, discount: { ...q.discount, ...patch } }));
  const m = calc.minimumCharge;
  const subtotalBasis = calc.tax.mode === 'inclusive' ? 'tax-inclusive' : 'before tax';
  return (
    <CollapsibleCard
      title="Discount & minimum charge"
      summary={[calc.discount.amount > 0 ? `Discount ${fmt.money(calc.discount.amount)}` : 'No discount', m.adjustment > 0 ? 'Minimum applied' : null].filter(Boolean).join(' · ')}
      id="section-pricing"
    >
      <h3 className="subhead subhead--first">Discount</h3>
      {d.type === 'none' ? (
        <Button size="sm" icon={Plus} onClick={() => setDiscount({ type: defaultDiscountType, value: 0 })}>
          Add a discount
        </Button>
      ) : (
        <div className="grid grid--3">
          <Segmented
            label="Discount type"
            value={d.type}
            onChange={(type) => setDiscount({ type, value: 0 })}
            options={[
              { value: 'percent', label: '% of subtotal' },
              { value: 'fixed', label: 'Fixed amount' },
            ]}
          />
          {d.type === 'percent' ? (
            <PercentField label="Discount" value={d.value} onChange={(value) => setDiscount({ value })} locale={fmt.locale} />
          ) : (
            <MoneyField label="Discount" value={d.value} onChange={(value) => setDiscount({ value })} locale={fmt.locale} currency={fmt.currency} />
          )}
          <TextField label="Reason (shown to customer)" value={d.reason} onChange={(reason) => setDiscount({ reason })} placeholder="e.g. Repeat customer" optional />
          <Button size="sm" variant="ghost" icon={Trash} className="btn--danger-ghost grid__end" onClick={() => setDiscount({ type: 'none', value: 0, reason: '' })}>
            Remove discount
          </Button>
        </div>
      )}
      {calc.discount.amount > 0 && (
        <p className="calc-note">
          {fmt.money(calc.discount.amount)} off a {fmt.money(calc.minimumCharge.basis === 'beforeDiscount' ? calc.itemsSubtotal + m.adjustment : calc.itemsSubtotal)} subtotal
          {calc.discount.percentOfBase !== null && ` (${fmt.pct(calc.discount.percentOfBase)})`}. Applied once, after any item discounts.
        </p>
      )}

      <h3 className="subhead">Minimum job charge</h3>
      <div className="grid grid--2">
        <MoneyField
          label="Minimum charge"
          value={p.minimumCharge}
          onChange={(minimumCharge) => setPricing({ minimumCharge })}
          locale={fmt.locale}
          currency={fmt.currency}
          hint="0 = no minimum."
        />
        <SelectField
          label="Compare the minimum with"
          value={p.minimumChargeBasis}
          onChange={(minimumChargeBasis) => setPricing({ minimumChargeBasis })}
          options={[
            { value: 'afterDiscount', label: `Subtotal after discounts (${subtotalBasis})` },
            { value: 'beforeDiscount', label: `Subtotal before discounts (${subtotalBasis})` },
          ]}
        />
      </div>
      {m.adjustment > 0 ? (
        <Callout tone="info" compact title="Minimum charge applied">
          Calculated subtotal {fmt.money(m.comparedSubtotal)} is below your {fmt.money(m.minimum)} minimum, so a{' '}
          <strong className="money">{fmt.money(m.adjustment)}</strong> adjustment is added as its own line. Your item prices are unchanged; the margin
          shown includes the adjustment.
        </Callout>
      ) : (
        p.minimumCharge > 0 && <p className="calc-note">This quote is above the minimum, so no adjustment is needed.</p>
      )}

      <h3 className="subhead">Margin warning levels</h3>
      <div className="grid grid--2">
        <PercentField
          label="Target margin (green at or above)"
          value={p.targetMarginPercent}
          onChange={(targetMarginPercent) => setPricing({ targetMarginPercent })}
          locale={fmt.locale}
          max={LIMITS.targetMargin.max}
          maxMessage="A margin of 100% or more is impossible."
        />
        <PercentField
          label="Minimum acceptable margin (red below)"
          value={p.minimumMarginPercent}
          onChange={(minimumMarginPercent) => setPricing({ minimumMarginPercent })}
          locale={fmt.locale}
          max={LIMITS.targetMargin.max}
          hint="Amber between this and the target. Losses are always red."
        />
      </div>
    </CollapsibleCard>
  );
}

export function TaxDepositSection({ quote, calc, update, fmt }: SectionProps) {
  const tax = quote.tax;
  const setTax = (patch: Partial<TaxSettings>) => update((q) => ({ ...q, tax: { ...q.tax, ...patch } }));
  const dep = quote.deposit;
  const setDeposit = (patch: Partial<Quote['deposit']>) => update((q) => ({ ...q, deposit: { ...q.deposit, ...patch } }));
  return (
    <CollapsibleCard
      title="Tax & deposit"
      summary={`${tax.mode === 'none' ? 'No tax' : `Tax ${fmt.money(calc.tax.total)}`} · ${dep.type === 'none' ? 'No deposit' : `Deposit ${fmt.money(calc.deposit.amount)}`}`}
      id="section-tax"
    >
      <TaxEditor tax={tax} onChange={setTax} fmt={fmt} />
      {tax.mode !== 'none' && (
        <p className="calc-note">
          Taxable amount {fmt.money(calc.taxableAmount)} → tax {fmt.money(calc.tax.total)}
          {tax.mode === 'inclusive' ? ' (already inside your prices)' : ' (added to the total)'}.
        </p>
      )}

      <h3 className="subhead">Deposit</h3>
      <div className="grid grid--3">
        <Segmented
          label="Deposit"
          value={dep.type}
          onChange={(type) => setDeposit({ type, value: type === dep.type ? dep.value : type === 'percent' ? 25 : 0 })}
          options={[
            { value: 'none', label: 'None' },
            { value: 'percent', label: '% of total' },
            { value: 'fixed', label: 'Fixed' },
          ]}
        />
        {dep.type === 'percent' && <PercentField label="Deposit" value={dep.value} onChange={(value) => setDeposit({ value })} locale={fmt.locale} />}
        {dep.type === 'fixed' && <MoneyField label="Deposit" value={dep.value} onChange={(value) => setDeposit({ value })} locale={fmt.locale} currency={fmt.currency} />}
      </div>
      {dep.type !== 'none' && (
        <p className="calc-note">
          Deposit {fmt.money(calc.deposit.amount)} + balance {fmt.money(calc.deposit.balance)} = total {fmt.money(calc.total)}. The deposit is part of the
          total, not an extra charge. Percentages are of the tax-inclusive total, rounded to the nearest {calc.decimals > 0 ? 'cent' : 'unit'}; the
          balance takes the remainder.
        </p>
      )}
    </CollapsibleCard>
  );
}

/** Tax configuration, shared by the quote editor and pricing settings. */
export function TaxEditor({ tax, onChange, fmt }: { tax: TaxSettings; onChange: (patch: Partial<TaxSettings>) => void; fmt: Fmt }) {
  const setComponent = (id: string, patch: Partial<TaxSettings['components'][number]>) =>
    onChange({ components: tax.components.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  return (
    <div className="tax-editor">
      <Segmented
        label="Tax"
        value={tax.mode}
        onChange={(mode) => onChange({ mode })}
        options={[
          { value: 'none', label: 'No tax' },
          { value: 'exclusive', label: 'Add tax to prices' },
          { value: 'inclusive', label: 'Prices include tax' },
        ]}
      />
      <p className="calc-note">
        {tax.mode === 'none' && 'No tax is shown or charged.'}
        {tax.mode === 'exclusive' && 'Prices are before tax. Tax is calculated on taxable items after discounts and added to the total.'}
        {tax.mode === 'inclusive' && 'Prices already include tax. The tax inside them is calculated and shown, but never added again.'}
      </p>
      {tax.mode !== 'none' && (
        <>
          <ul className="tax-editor__list">
            {tax.components.map((c, i) => (
              <li key={c.id} className="tax-editor__row">
                <TextField label={`Tax ${i + 1} name`} value={c.name} onChange={(name) => setComponent(c.id, { name })} maxLength={60} placeholder="e.g. Sales tax, GST, VAT" />
                <PercentField label="Rate" value={c.ratePercent} onChange={(ratePercent) => setComponent(c.id, { ratePercent })} locale={fmt.locale} />
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={Trash}
                  className="btn--danger-ghost"
                  disabled={tax.components.length <= 1}
                  onClick={() => onChange({ components: tax.components.filter((x) => x.id !== c.id) })}
                >
                  Remove {c.name || `tax ${i + 1}`}
                </Button>
              </li>
            ))}
          </ul>
          <div className="tax-editor__foot">
            <Button
              size="sm"
              icon={Plus}
              disabled={tax.components.length >= LIMITS.taxComponents}
              onClick={() => onChange({ components: [...tax.components, { id: newId('tax'), name: '', ratePercent: 0 }] })}
            >
              Add tax component
            </Button>
            {tax.components.length > 1 && (
              <SelectField
                label="Multiple taxes are"
                value={tax.compounding}
                onChange={(compounding) => onChange({ compounding })}
                options={[
                  { value: 'independent', label: 'Each applied to the same amount' },
                  { value: 'compound', label: 'Compounded (each on amount + earlier taxes)' },
                ]}
              />
            )}
          </div>
          <Callout tone="neutral" compact>
            Tax rules vary by country, state and trade. TradeMaker doesn't include any official rates — confirm the correct rates and taxable items for
            your location.
          </Callout>
        </>
      )}
    </div>
  );
}

export function TermsSection({ quote, update }: SectionProps) {
  const set = (patch: Partial<Quote>) => update((q) => ({ ...q, ...patch }));
  return (
    <CollapsibleCard title="Terms & notes" summary={quote.paymentTerms ? 'Payment terms set' : 'No payment terms'} id="section-terms" defaultOpen={false}>
      <TextArea label="Payment terms" value={quote.paymentTerms} onChange={(paymentTerms) => set({ paymentTerms })} rows={2} />
      <TextArea
        label="Acceptance instructions"
        value={quote.acceptanceInstructions}
        onChange={(acceptanceInstructions) => set({ acceptanceInstructions })}
        rows={2}
        hint="How the customer should accept. The validity date is added automatically."
      />
      <TextArea label="Notes for the customer" value={quote.customerNotes} onChange={(customerNotes) => set({ customerNotes })} rows={3} optional hint="Project notes, milestones, preparation requests." />
      <TextArea
        label={
          <>
            Internal notes <Badge tone="neutral">Internal</Badge>
          </>
        }
        value={quote.internalNotes}
        onChange={(internalNotes) => set({ internalNotes })}
        rows={2}
        hint="Never printed or shown to the customer."
      />
    </CollapsibleCard>
  );
}
