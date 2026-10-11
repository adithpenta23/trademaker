import { priceForMarkup, priceForTargetMargin } from '../../domain/calc';
import { LIMITS } from '../../domain/limits';
import type { PricingDefaults, TaxSettings } from '../../domain/types';
import { useFmt } from '../../format/useFmt';
import { useStore } from '../../state/store';
import { MoneyField, NumberField, PercentField, Segmented, SelectField, TextArea, TextField } from '../../ui/fields';
import { Callout, Card, HelpText, PageHeader } from '../../ui/layout';
import { TaxEditor } from '../editor/QuoteSections';

export function PricingSettingsPage() {
  const { state, actions } = useStore();
  const fmt = useFmt();
  const p = state.pricing;
  const set = (patch: Partial<PricingDefaults>) => actions.updatePricing(patch);
  const example = 10_000;
  const marginPrice = priceForTargetMargin(example, p.targetMarginPercent);
  const markupPrice = priceForMarkup(example, p.markupPercent);
  const oh = p.overhead;

  return (
    <div className="page page--narrow">
      <PageHeader
        title="Pricing settings"
        subtitle="Defaults for new quotes. Each quote keeps its own copy, so changing these never rewrites existing quotes."
      />
      <Callout tone="neutral" compact>
        Starting values are placeholders, not recommendations. Use your own labor costs, overhead and margins.
      </Callout>

      <Card title="Labor">
        <div className="grid grid--3">
          <MoneyField
            label="Labor cost per hour"
            value={p.laborCostPerHour}
            onChange={(laborCostPerHour) => set({ laborCostPerHour })}
            locale={fmt.locale}
            currency={fmt.currency}
            suffix="/h"
            hint="Your cost for one hour of a worker's time — not your billing rate."
          />
          <SelectField
            label="This rate is"
            value={p.laborRateBasis}
            onChange={(laborRateBasis) => set({ laborRateBasis })}
            options={[
              { value: 'burdened', label: 'Fully burdened' },
              { value: 'wages', label: 'Wages only' },
            ]}
            hint={
              p.laborRateBasis === 'burdened'
                ? 'Includes payroll taxes, insurance and benefits.'
                : 'Wages only — cover payroll taxes and insurance through overhead.'
            }
          />
          <NumberField label="Default crew size" value={p.defaultCrewSize} onChange={(defaultCrewSize) => set({ defaultCrewSize })} locale={fmt.locale} integer min={1} max={LIMITS.crew.max} suffix="people" />
        </div>
      </Card>

      <Card title="Margins & pricing mode">
        <Segmented
          label="Default pricing for new quotes"
          value={p.pricingMode}
          onChange={(pricingMode) => set({ pricingMode })}
          options={[
            { value: 'manual', label: 'I set prices' },
            { value: 'targetMargin', label: 'Target margin' },
            { value: 'markup', label: 'Markup on cost' },
          ]}
        />
        <div className="grid grid--3">
          <PercentField
            label="Target gross margin"
            value={p.targetMarginPercent}
            onChange={(targetMarginPercent) => set({ targetMarginPercent })}
            locale={fmt.locale}
            max={LIMITS.targetMargin.max}
            maxMessage="A margin of 100% or more is impossible — it would need an infinite price."
            hint={marginPrice !== null ? `Cost ${fmt.money(example)} → price ${fmt.money(marginPrice)}` : undefined}
          />
          <NumberField
            label="Default markup on cost"
            value={p.markupPercent}
            onChange={(markupPercent) => set({ markupPercent })}
            locale={fmt.locale}
            max={LIMITS.markup.max}
            suffix="%"
            hint={`Cost ${fmt.money(example)} → price ${fmt.money(markupPrice)}`}
          />
          <PercentField
            label="Minimum acceptable margin"
            value={p.minimumMarginPercent}
            onChange={(minimumMarginPercent) => set({ minimumMarginPercent })}
            locale={fmt.locale}
            max={LIMITS.targetMargin.max}
            hint="Green at or above target, amber in between, red below this."
          />
        </div>
        <p className="calc-note">
          <HelpText label="Margin vs markup — what's the difference?">
            Gross margin = (price − cost) ÷ price. Markup = (price − cost) ÷ cost. They are not interchangeable: to earn a 40% margin on a{' '}
            {fmt.money(example)} cost you need {fmt.money(priceForTargetMargin(example, 40) ?? 0)}, while a 40% markup gives {fmt.money(priceForMarkup(example, 40))}{' '}
            (only a 28.6% margin).
          </HelpText>
        </p>
      </Card>

      <Card title="Overhead" subtitle="Rent, vehicles, insurance, phone, admin time — costs that aren't tied to one job.">
        <div className="grid grid--2">
          <SelectField
            label="Allocate overhead"
            value={oh.method}
            onChange={(method) => set({ overhead: { ...oh, method } })}
            options={[
              { value: 'none', label: "Don't allocate" },
              { value: 'perJob', label: 'Fixed amount per job' },
              { value: 'perLaborHour', label: 'Amount per labor hour' },
              { value: 'percentOfDirectCost', label: 'Percentage of direct costs' },
            ]}
          />
          {oh.method === 'percentOfDirectCost' ? (
            <PercentField label="Overhead rate" value={oh.amount} onChange={(amount) => set({ overhead: { ...oh, amount } })} locale={fmt.locale} max={1000} />
          ) : (
            oh.method !== 'none' && (
              <MoneyField
                label={oh.method === 'perJob' ? 'Overhead per job' : 'Overhead per labor hour'}
                value={oh.amount}
                onChange={(amount) => set({ overhead: { ...oh, amount } })}
                locale={fmt.locale}
                currency={fmt.currency}
              />
            )
          )}
        </div>
        <p className="calc-note">
          Simple way to estimate: add up a month of overhead costs, then divide by jobs per month (per job) or by billable crew hours per month (per labor
          hour). Percentages apply to direct costs, never to price, so there's no circular calculation.
        </p>
      </Card>

      <Card title="Minimum charge, travel & discounts">
        <div className="grid grid--3">
          <MoneyField label="Minimum job charge" value={p.minimumCharge} onChange={(minimumCharge) => set({ minimumCharge })} locale={fmt.locale} currency={fmt.currency} hint="0 = no minimum." />
          <SelectField
            label="Minimum applies to"
            value={p.minimumChargeBasis}
            onChange={(minimumChargeBasis) => set({ minimumChargeBasis })}
            options={[
              { value: 'afterDiscount', label: 'Subtotal after discounts' },
              { value: 'beforeDiscount', label: 'Subtotal before discounts' },
            ]}
          />
          <MoneyField
            label="Default travel charge"
            value={p.defaultTravelCharge}
            onChange={(defaultTravelCharge) => set({ defaultTravelCharge })}
            locale={fmt.locale}
            currency={fmt.currency}
            hint="When above 0, new blank quotes start with a travel surcharge line."
          />
          <SelectField
            label="Default discount type"
            value={p.defaultDiscountType}
            onChange={(defaultDiscountType) => set({ defaultDiscountType })}
            options={[
              { value: 'percent', label: 'Percentage' },
              { value: 'fixed', label: 'Fixed amount' },
            ]}
          />
          <PercentField
            label="Warn when a discount exceeds"
            value={p.discountWarningPercent}
            onChange={(discountWarningPercent) => set({ discountWarningPercent })}
            locale={fmt.locale}
            hint="0 = never warn."
          />
        </div>
      </Card>

      <Card title="Tax" subtitle="Default tax setup for new quotes.">
        <TaxEditor tax={p.tax} onChange={(patch: Partial<TaxSettings>) => set({ tax: { ...p.tax, ...patch } })} fmt={fmt} />
      </Card>

      <Card title="Deposit, validity & terms">
        <div className="grid grid--3">
          <Segmented
            label="Default deposit"
            value={p.deposit.type}
            onChange={(type) => set({ deposit: { type, value: type === p.deposit.type ? p.deposit.value : type === 'percent' ? 25 : 0 } })}
            options={[
              { value: 'none', label: 'None' },
              { value: 'percent', label: '%' },
              { value: 'fixed', label: 'Fixed' },
            ]}
          />
          {p.deposit.type === 'percent' && (
            <PercentField label="Deposit" value={p.deposit.value} onChange={(value) => set({ deposit: { ...p.deposit, value } })} locale={fmt.locale} />
          )}
          {p.deposit.type === 'fixed' && (
            <MoneyField label="Deposit" value={p.deposit.value} onChange={(value) => set({ deposit: { ...p.deposit, value } })} locale={fmt.locale} currency={fmt.currency} />
          )}
          <NumberField
            label="Quotes valid for"
            value={p.validityDays}
            onChange={(validityDays) => set({ validityDays })}
            locale={fmt.locale}
            integer
            min={LIMITS.validityDays.min}
            max={LIMITS.validityDays.max}
            suffix="days"
          />
        </div>
        <TextArea label="Default payment terms" value={p.paymentTerms} onChange={(paymentTerms) => set({ paymentTerms })} rows={2} />
        <TextArea label="Default acceptance instructions" value={p.acceptanceInstructions} onChange={(acceptanceInstructions) => set({ acceptanceInstructions })} rows={2} />
        <div className="grid grid--3">
          <TextField label="Document title" value={p.documentTitle} onChange={(documentTitle) => set({ documentTitle })} maxLength={40} hint="Quote, Estimate, Proposal…" />
          <TextField label="Quote number prefix" value={p.quoteNumberPrefix} onChange={(quoteNumberPrefix) => set({ quoteNumberPrefix })} maxLength={12} />
          <NumberField
            label="Next quote number"
            value={p.nextQuoteNumber}
            onChange={(nextQuoteNumber) => set({ nextQuoteNumber })}
            locale={fmt.locale}
            integer
            min={1}
            max={999_999_999}
            hint={`Next: ${p.quoteNumberPrefix}${p.nextQuoteNumber}. Continue your own sequence after importing.`}
          />
        </div>
      </Card>
    </div>
  );
}
