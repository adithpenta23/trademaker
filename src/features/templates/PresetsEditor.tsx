import { RotateCcw, Wand } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { hasExampleAmounts, PRESET_TRADES } from '../../data/presets';
import { TRADE_LABELS } from '../../data/regions';
import type { LineItem, PresetItem, TradePreset, TradeType } from '../../domain/types';
import { useFmt } from '../../format/useFmt';
import { useStore } from '../../state/store';
import { Button } from '../../ui/Button';
import { useFeedback } from '../../ui/feedback';
import { MoneyField, NumberField, PercentField, SelectField } from '../../ui/fields';
import { Callout, Card } from '../../ui/layout';
import { LineItemsEditor } from '../editor/LineItemsEditor';
import { previewCalc } from './previewCalc';

const toLine = (p: PresetItem): LineItem => ({
  id: p.id,
  name: p.name,
  description: p.description,
  category: p.category,
  quantity: p.defaultQuantity,
  unit: p.unit,
  customUnit: p.customUnit,
  unitPrice: p.unitPrice,
  autoPrice: false,
  discountPercent: 0,
  taxable: p.taxable,
  visibility: 'included',
  costs: p.costs,
});

const toPreset = (l: LineItem): PresetItem => ({
  id: l.id,
  name: l.name,
  description: l.description,
  category: l.category,
  unit: l.unit,
  customUnit: l.customUnit,
  defaultQuantity: l.quantity,
  unitPrice: l.unitPrice,
  taxable: l.taxable,
  costs: l.costs,
});

const OVERHEAD_TEXT = {
  none: 'none',
  perJob: 'per job',
  perLaborHour: 'per labor hour',
  percentOfDirectCost: 'of direct costs',
} as const;

export function PresetsEditor() {
  const { state, actions } = useStore();
  const { toast, confirm } = useFeedback();
  const fmt = useFmt();
  const firstTrade = PRESET_TRADES.includes(state.business.tradeType as (typeof PRESET_TRADES)[number])
    ? state.business.tradeType
    : (state.presets[0]?.tradeType ?? 'pressureWashing');
  const [trade, setTrade] = useState<TradeType>(firstTrade);
  const preset = state.presets.find((p) => p.tradeType === trade);

  const lines = useMemo(() => preset?.items.map(toLine) ?? [], [preset]);
  const calc = useMemo(() => previewCalc(lines, [], state.business, state.pricing), [lines, state.business, state.pricing]);
  const results = useMemo(() => new Map(calc.lines.map((r) => [r.id, r])), [calc]);

  const setItems = useCallback(
    (fn: (items: LineItem[]) => LineItem[]) => actions.updatePreset(trade, (p) => ({ ...p, items: fn(p.items.map(toLine)).map(toPreset) })),
    [actions, trade],
  );
  const setExample = (patch: Partial<TradePreset['pricingExample']>) =>
    actions.updatePreset(trade, (p) => ({ ...p, pricingExample: { ...p.pricingExample, ...patch } }));

  if (!preset) return <Callout tone="neutral">No presets available.</Callout>;
  const ex = preset.pricingExample;

  const applyPricing = async () => {
    const ok = await confirm({
      title: `Apply ${preset.label} example pricing?`,
      message:
        'This updates your default labor cost, crew size, target margin, minimum charge and overhead for NEW quotes. These are demonstration values — replace them with your own. Existing quotes are not changed.',
      confirmLabel: 'Apply to my defaults',
    });
    if (!ok) return;
    actions.updatePricing({
      laborCostPerHour: ex.laborCostPerHour,
      defaultCrewSize: ex.defaultCrewSize,
      targetMarginPercent: ex.targetMarginPercent,
      minimumCharge: ex.minimumCharge,
      overhead: { ...ex.overhead },
    });
    toast({ message: 'Pricing defaults updated for new quotes.', tone: 'success' });
  };

  const reset = async () => {
    const ok = await confirm({
      title: 'Reset all trade presets?',
      message: 'Every trade item library and example pricing returns to the original demonstration values. Quotes are not affected.',
      confirmLabel: 'Reset presets',
    });
    if (!ok) return;
    actions.resetPresets();
    toast({ message: 'Trade presets restored.', tone: 'success' });
  };

  return (
    <div className="presets">
      <div className="toolbar">
        <SelectField
          label="Trade"
          value={trade}
          onChange={setTrade}
          options={state.presets.map((p) => ({ value: p.tradeType, label: TRADE_LABELS[p.tradeType] }))}
          fieldClassName="presets__trade"
        />
        <Button variant="ghost" icon={RotateCcw} onClick={reset}>
          Reset presets
        </Button>
      </div>

      <Callout tone="warning" compact title="Demonstration values only">
        Example prices and costs are starting points, not verified market rates. Edit them to match your business.
        {!hasExampleAmounts(fmt.currency) &&
          ` The example amounts were written for currencies like USD, GBP or EUR and are not converted — replace them with amounts that make sense in ${fmt.currency}.`}
      </Callout>

      <Card
        title={`${preset.label}: example pricing settings`}
        subtitle={preset.description}
        actions={
          <Button size="sm" icon={Wand} onClick={applyPricing}>
            Apply to my defaults
          </Button>
        }
      >
        <div className="grid grid--4">
          <MoneyField label="Labor cost per hour" value={ex.laborCostPerHour} onChange={(laborCostPerHour) => setExample({ laborCostPerHour })} locale={fmt.locale} currency={fmt.currency} />
          <NumberField label="Crew size" value={ex.defaultCrewSize} onChange={(defaultCrewSize) => setExample({ defaultCrewSize })} locale={fmt.locale} integer min={1} max={100} />
          <PercentField label="Target margin" value={ex.targetMarginPercent} onChange={(targetMarginPercent) => setExample({ targetMarginPercent })} locale={fmt.locale} max={99.9} />
          <MoneyField label="Minimum charge" value={ex.minimumCharge} onChange={(minimumCharge) => setExample({ minimumCharge })} locale={fmt.locale} currency={fmt.currency} />
        </div>
        <p className="calc-note">
          Overhead:{' '}
          {ex.overhead.method === 'none'
            ? 'none'
            : ex.overhead.method === 'percentOfDirectCost'
              ? `${fmt.pct(ex.overhead.amount)} ${OVERHEAD_TEXT[ex.overhead.method]}`
              : `${fmt.unitPrice(ex.overhead.amount)} ${OVERHEAD_TEXT[ex.overhead.method]}`}
.
        </p>
      </Card>

      <Card title="Item library" subtitle="Add these to any quote with “Add from item library”. Quantity here is the default when added.">
        <LineItemsEditor
          items={lines}
          onChange={setItems}
          results={results}
          issues={calc.issues}
          pricingMode="manual"
          taxEnabled={false}
          fmt={fmt}
          laborRate={state.pricing.laborCostPerHour}
          defaultCrew={state.pricing.defaultCrewSize}
          tradeType={trade}
          presets={[]}
          variant="template"
          addLabel="Add library item"
        />
      </Card>
    </div>
  );
}
