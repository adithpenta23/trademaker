import { ArrowDown, ArrowUp, ChevronRight, Copy, Library, Plus, Search, Trash, X } from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { COST_CATEGORY_LABELS, LINE_CATEGORY_LABELS, TRADE_LABELS, UNIT_LABELS, unitLabel } from '../../data/regions';
import type { CalcIssue, LineResult } from '../../domain/calc';
import { unitCostBucket } from '../../domain/calc';
import { newId } from '../../domain/ids';
import { LIMITS } from '../../domain/limits';
import { clone, createLineItem, lineFromPreset } from '../../domain/quoteFactory';
import {
  LINE_CATEGORIES,
  LINE_VISIBILITIES,
  UNIT_CODES,
  type LineItem,
  type PricingMode,
  type TradePreset,
  type TradeType,
} from '../../domain/types';
import type { Fmt } from '../../format/useFmt';
import { Button } from '../../ui/Button';
import { useFeedback } from '../../ui/feedback';
import { Checkbox, MoneyField, NumberField, PercentField, SelectField, TextArea, TextField } from '../../ui/fields';
import { Badge } from '../../ui/layout';

export interface LineItemsEditorProps {
  items: LineItem[];
  onChange: (update: (items: LineItem[]) => LineItem[]) => void;
  results: ReadonlyMap<string, LineResult>;
  issues: readonly CalcIssue[];
  pricingMode: PricingMode;
  taxEnabled: boolean;
  fmt: Fmt;
  laborRate: number;
  defaultCrew: number;
  tradeType: TradeType;
  presets: readonly TradePreset[];
  /** Templates and item libraries hide quote-only options. */
  variant?: 'quote' | 'template';
  addLabel?: string;
}

const VISIBILITY_LABELS: Record<LineItem['visibility'], string> = {
  included: 'Included',
  optional: 'Optional extra',
  internal: 'Internal only',
};

const VISIBILITY_HINTS: Record<LineItem['visibility'], string> = {
  included: 'Shown and charged.',
  optional: 'Shown as an extra the customer can add; not in the total.',
  internal: 'Never shown or charged; its costs count toward the job.',
};

export function LineItemsEditor(props: LineItemsEditorProps) {
  const { items, onChange, pricingMode, defaultCrew, presets, tradeType, variant = 'quote' } = props;
  const { toast } = useFeedback();
  const [focusId, setFocusId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const atLimit = items.length >= LIMITS.lineItems;

  const update = useCallback(
    (id: string, fn: (item: LineItem) => LineItem) => onChange((list) => list.map((it) => (it.id === id ? fn(it) : it))),
    [onChange],
  );

  const move = useCallback(
    (id: string, delta: number) => {
      onChange((list) => {
        const i = list.findIndex((it) => it.id === id);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= list.length) return list;
        const next = list.slice();
        const [moved] = next.splice(i, 1);
        if (moved) next.splice(j, 0, moved);
        return next;
      });
      requestAnimationFrame(() => {
        const sel = `[data-line="${id}"] [data-move="${delta < 0 ? 'up' : 'down'}"]`;
        const btn = document.querySelector<HTMLButtonElement>(sel);
        (btn && !btn.disabled ? btn : document.querySelector<HTMLElement>(`[data-line="${id}"] [data-move]`))?.focus();
      });
    },
    [onChange],
  );

  const duplicate = useCallback(
    (id: string) => {
      const copyId = newId('li');
      onChange((list) => {
        const i = list.findIndex((it) => it.id === id);
        const source = list[i];
        if (!source) return list;
        const next = list.slice();
        next.splice(i + 1, 0, { ...clone(source), id: copyId });
        return next;
      });
      setFocusId(copyId);
    },
    [onChange],
  );

  const itemsRef = useRef(items);
  useLayoutEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const remove = useCallback(
    (id: string) => {
      const index = itemsRef.current.findIndex((it) => it.id === id);
      const item = itemsRef.current[index];
      if (!item) return;
      onChange((list) => list.filter((it) => it.id !== id));
      toast({
        message: `Removed “${item.name.trim() || 'Untitled item'}”.`,
        tone: 'info',
        action: {
          label: 'Undo',
          onClick: () =>
            onChange((list) => {
              if (list.some((it) => it.id === item.id)) return list;
              const next = list.slice();
              next.splice(Math.min(index, next.length), 0, item);
              return next;
            }),
        },
      });
    },
    [onChange, toast],
  );

  const addBlank = () => {
    const line = createLineItem({ autoPrice: pricingMode !== 'manual' && variant === 'quote' }, defaultCrew);
    onChange((list) => [...list, line]);
    setFocusId(line.id);
  };

  const addFromLibrary = (presetLine: LineItem) => {
    onChange((list) => [...list, presetLine]);
    toast({ message: `Added “${presetLine.name}”.`, tone: 'success', duration: 2500 });
  };

  const issuesByLine = useMemo(() => {
    const map = new Map<string, CalcIssue[]>();
    for (const issue of props.issues) {
      if (!issue.lineId) continue;
      map.set(issue.lineId, [...(map.get(issue.lineId) ?? []), issue]);
    }
    return map;
  }, [props.issues]);

  return (
    <div className="line-editor">
      {items.length === 0 ? (
        <div className="line-empty">
          <p className="line-empty__title">No items yet</p>
          <p className="line-empty__body">Add the services, materials and charges for this job. Prices and costs update the totals instantly.</p>
        </div>
      ) : (
        <ol className="line-list" aria-label="Line items">
          {items.map((item, index) => (
            <LineItemRow
              key={item.id}
              item={item}
              result={props.results.get(item.id)}
              index={index}
              count={items.length}
              pricingMode={variant === 'quote' ? pricingMode : 'manual'}
              taxEnabled={props.taxEnabled}
              fmt={props.fmt}
              laborRate={props.laborRate}
              lineIssues={issuesByLine.get(item.id)}
              autoFocusName={focusId === item.id}
              onFocused={() => setFocusId(null)}
              onUpdate={update}
              onMove={move}
              onDuplicate={duplicate}
              onRemove={remove}
              variant={variant}
            />
          ))}
        </ol>
      )}

      <div className="line-editor__add">
        <Button icon={Plus} variant="secondary" onClick={addBlank} disabled={atLimit}>
          {props.addLabel ?? 'Add item'}
        </Button>
        {presets.length > 0 && (
          <Button icon={Library} variant="ghost" onClick={() => setLibraryOpen(!libraryOpen)} aria-expanded={libraryOpen} disabled={atLimit}>
            Add from item library
          </Button>
        )}
        {atLimit && <span className="muted small">A quote can hold up to {LIMITS.lineItems} items.</span>}
      </div>

      {libraryOpen && (
        <ItemLibrary
          presets={presets}
          initialTrade={tradeType}
          fmt={props.fmt}
          onAdd={(line) => addFromLibrary({ ...line, autoPrice: pricingMode !== 'manual' && variant === 'quote' && line.autoPrice })}
          onClose={() => setLibraryOpen(false)}
        />
      )}
    </div>
  );
}

interface RowProps {
  item: LineItem;
  result: LineResult | undefined;
  index: number;
  count: number;
  pricingMode: PricingMode;
  taxEnabled: boolean;
  fmt: Fmt;
  laborRate: number;
  lineIssues: CalcIssue[] | undefined;
  autoFocusName: boolean;
  onFocused: () => void;
  onUpdate: (id: string, fn: (item: LineItem) => LineItem) => void;
  onMove: (id: string, delta: number) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  variant: 'quote' | 'template';
}

const LineItemRow = memo(function LineItemRow({
  item,
  result,
  index,
  count,
  pricingMode,
  taxEnabled,
  fmt,
  laborRate,
  lineIssues,
  autoFocusName,
  onFocused,
  onUpdate,
  onMove,
  onDuplicate,
  onRemove,
  variant,
}: RowProps) {
  const [open, setOpen] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<LineItem>) => onUpdate(item.id, (l) => ({ ...l, ...patch }));
  const setCost = (patch: Partial<LineItem['costs']>) => onUpdate(item.id, (l) => ({ ...l, costs: { ...l.costs, ...patch } }));
  const locale = fmt.locale;
  const costBased = pricingMode !== 'manual';
  const isAuto = costBased && item.autoPrice && item.visibility !== 'internal';
  const displayName = item.name.trim() || 'Untitled item';

  useEffect(() => {
    if (autoFocusName) {
      nameRef.current?.focus();
      onFocused();
    }
  }, [autoFocusName, onFocused]);

  const directCost = result?.directCost ?? 0;
  const unit = unitLabel(item.unit, item.customUnit);
  const bucket = COST_CATEGORY_LABELS[unitCostBucket(item.category)];
  const warnings = lineIssues?.filter((i) => i.severity !== 'info') ?? [];

  return (
    <li className={`line-row line-row--${item.visibility} ${open ? 'is-open' : ''}`} data-line={item.id}>
      <div className="line-row__index" aria-hidden>
        {index + 1}
      </div>
      <div className="line-row__body">
        <div className="line-row__top">
          <TextField
            label={`Item ${index + 1} name`}
            hideLabel
            value={item.name}
            onChange={(name) => set({ name })}
            placeholder="Item or service, e.g. Driveway cleaning"
            className="line-row__name"
            inputRef={nameRef}
          />
          <div className="line-row__tools" role="group" aria-label={`Actions for ${displayName}`}>
            <Button variant="ghost" size="sm" iconOnly icon={ArrowUp} data-move="up" disabled={index === 0} onClick={() => onMove(item.id, -1)} title="Move up">
              Move {displayName} up
            </Button>
            <Button variant="ghost" size="sm" iconOnly icon={ArrowDown} data-move="down" disabled={index === count - 1} onClick={() => onMove(item.id, 1)} title="Move down">
              Move {displayName} down
            </Button>
            <Button variant="ghost" size="sm" iconOnly icon={Copy} onClick={() => onDuplicate(item.id)} title="Duplicate">
              Duplicate {displayName}
            </Button>
            <Button variant="ghost" size="sm" iconOnly icon={Trash} onClick={() => onRemove(item.id)} title="Remove" className="btn--danger-ghost">
              Remove {displayName}
            </Button>
          </div>
        </div>

        <TextArea
          label={`Description for ${displayName}`}
          hideLabel
          value={item.description}
          onChange={(description) => set({ description })}
          placeholder="Description shown to the customer (optional)"
          rows={1}
          className="line-row__desc"
        />

        {item.visibility === 'internal' ? (
          <div className="line-row__internal-note">
            <Badge tone="neutral">Internal only</Badge>
            <span>Not shown to the customer and not charged. Its costs count toward the job.</span>
          </div>
        ) : (
          <div className="line-row__nums">
            <NumberField
              label="Qty"
              value={item.quantity}
              onChange={(quantity) => set({ quantity })}
              locale={locale}
              max={LIMITS.quantity.max}
              className="line-row__qty"
            />
            <div className="field line-row__unit">
              <SelectField
                label="Unit"
                value={item.unit}
                onChange={(u) => set({ unit: u })}
                options={UNIT_CODES.map((u) => ({ value: u, label: UNIT_LABELS[u].long }))}
              />
            </div>
            {item.unit === 'custom' && (
              <TextField label="Custom unit" value={item.customUnit} onChange={(customUnit) => set({ customUnit })} maxLength={24} placeholder="e.g. gal" className="line-row__custom-unit" />
            )}
            <div className="line-row__price">
              {costBased && (
                <button
                  type="button"
                  className={`price-mode ${isAuto ? 'is-auto' : 'is-manual'}`}
                  aria-pressed={isAuto}
                  title={isAuto ? 'Price is calculated from costs. Click to fix it at this value.' : 'Price was entered manually. Click to calculate it from costs.'}
                  onClick={() => {
                    if (isAuto) set({ autoPrice: false, unitPrice: result?.unitPrice ?? item.unitPrice });
                    else set({ autoPrice: true });
                  }}
                >
                  {isAuto ? 'Auto' : 'Manual'}
                  <span className="sr-only">{isAuto ? ' price for ' + displayName + ' — switch to a fixed price' : ' price for ' + displayName + ' — switch to automatic price'}</span>
                </button>
              )}
              <MoneyField
                label="Unit price"
                value={isAuto ? (result?.unitPrice ?? 0) : item.unitPrice}
                onChange={(unitPrice) => set({ unitPrice, autoPrice: false })}
                locale={locale}
                currency={fmt.currency}
                readOnlyLook={isAuto}
                hint={isAuto ? 'From costs' : undefined}
              />
            </div>
            <div className="line-row__amount">
              <span className="line-row__amount-label">{item.visibility === 'optional' ? 'Optional' : 'Amount'}</span>
              <span className="line-row__amount-value money">{fmt.money(result?.netAmount ?? 0)}</span>
              {(result?.discountAmount ?? 0) > 0 && <span className="line-row__amount-sub">−{fmt.money(result?.discountAmount ?? 0)} discount</span>}
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <ul className="line-row__warnings">
            {warnings.map((w) => (
              <li key={w.code}>{w.message}</li>
            ))}
          </ul>
        )}

        <button type="button" className="line-row__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <ChevronRight size={15} aria-hidden className="line-row__chev" />
          <span>Options &amp; internal costs</span>
          <span className="line-row__summary">
            {directCost > 0 ? (
              <>
                Cost <span className="money">{fmt.money(directCost)}</span>
                {item.visibility !== 'internal' && result?.directMarginPercent !== null && result?.directMarginPercent !== undefined && (
                  <> · Margin {fmt.pct(result.directMarginPercent)} before overhead</>
                )}
              </>
            ) : (
              <span className="muted">No internal costs entered</span>
            )}
            {item.visibility === 'optional' && <Badge tone="info">Optional extra</Badge>}
            {item.discountPercent > 0 && <Badge tone="neutral">{fmt.num(item.discountPercent)}% off</Badge>}
            {taxEnabled && !item.taxable && item.visibility !== 'internal' && <Badge tone="neutral">No tax</Badge>}
          </span>
        </button>

        {open && (
          <div className="line-row__details">
            <div className="detail-group">
              <h4 className="detail-group__title">On the customer quote</h4>
              <div className="grid grid--3">
                <SelectField
                  label="Category"
                  value={item.category}
                  onChange={(category) => set({ category })}
                  options={LINE_CATEGORIES.map((c) => ({ value: c, label: LINE_CATEGORY_LABELS[c] }))}
                />
                {variant === 'quote' && (
                  <SelectField
                    label="Show on quote as"
                    value={item.visibility}
                    onChange={(visibility) => set({ visibility })}
                    options={LINE_VISIBILITIES.map((v) => ({ value: v, label: VISIBILITY_LABELS[v] }))}
                    hint={VISIBILITY_HINTS[item.visibility]}
                  />
                )}
                {item.visibility !== 'internal' && (
                  <PercentField label="Item discount" value={item.discountPercent} onChange={(discountPercent) => set({ discountPercent })} locale={locale} />
                )}
              </div>
              {item.visibility !== 'internal' && (
                <Checkbox
                  label="Taxable"
                  checked={item.taxable}
                  onChange={(taxable) => set({ taxable })}
                  hint={taxEnabled ? 'Untick for items your local rules treat as non-taxable.' : 'Tax is currently off for this quote.'}
                />
              )}
            </div>

            <div className="detail-group detail-group--internal">
              <h4 className="detail-group__title">
                Internal costs <span className="muted">— never shown to the customer</span>
              </h4>
              <div className="grid grid--labor">
                <NumberField
                  label="Labor hours"
                  value={item.costs.laborHours}
                  onChange={(laborHours) => setCost({ laborHours })}
                  locale={locale}
                  max={LIMITS.hours.max}
                  suffix="h"
                />
                <NumberField
                  label="Crew size"
                  value={item.costs.crewSize}
                  onChange={(crewSize) => setCost({ crewSize })}
                  locale={locale}
                  min={1}
                  max={LIMITS.crew.max}
                  integer
                  suffix="people"
                />
                <Checkbox
                  label={`Hours are per ${unit || 'unit'}`}
                  checked={item.costs.laborPerUnit}
                  onChange={(laborPerUnit) => setCost({ laborPerUnit })}
                  className="grid__check"
                />
              </div>
              {(result?.laborHours ?? 0) > 0 && (
                <p className="calc-note">
                  {fmt.num(result?.laborHours ?? 0)} labor hours × {fmt.unitPrice(laborRate)}/h = <strong className="money">{fmt.money(result?.laborCost ?? 0)}</strong>
                </p>
              )}
              <div className="grid grid--4">
                <MoneyField label={`Cost per ${unit || 'unit'}`} value={item.costs.unitCost} onChange={(unitCost) => setCost({ unitCost })} locale={locale} currency={fmt.currency} />
                <MoneyField label="Materials" value={item.costs.materials} onChange={(materials) => setCost({ materials })} locale={locale} currency={fmt.currency} />
                <MoneyField label="Equipment" value={item.costs.equipment} onChange={(equipment) => setCost({ equipment })} locale={locale} currency={fmt.currency} />
                <MoneyField label="Travel" value={item.costs.travel} onChange={(travel) => setCost({ travel })} locale={locale} currency={fmt.currency} />
                <MoneyField label="Other" value={item.costs.other} onChange={(other) => setCost({ other })} locale={locale} currency={fmt.currency} />
              </div>
              {item.costs.unitCost > 0 && (
                <p className="calc-note">
                  Cost per unit × {fmt.num(item.quantity, 4)} = <strong className="money">{fmt.money(result?.unitCostTotal ?? 0)}</strong>, counted as {bucket.toLowerCase()}.
                </p>
              )}
              <p className="calc-note calc-note--total">
                Direct cost for this item: <strong className="money">{fmt.money(directCost)}</strong>
                {item.visibility !== 'internal' && result?.directMarginPercent !== null && result?.directMarginPercent !== undefined && (
                  <>
                    {' '}
                    · margin before overhead <strong>{fmt.pct(result.directMarginPercent)}</strong>
                  </>
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </li>
  );
});

function ItemLibrary({
  presets,
  initialTrade,
  fmt,
  onAdd,
  onClose,
}: {
  presets: readonly TradePreset[];
  initialTrade: TradeType;
  fmt: Fmt;
  onAdd: (line: LineItem) => void;
  onClose: () => void;
}) {
  const first = presets.find((p) => p.tradeType === initialTrade) ?? presets[0];
  const [trade, setTrade] = useState<TradeType>(first?.tradeType ?? 'pressureWashing');
  const [query, setQuery] = useState('');
  const preset = presets.find((p) => p.tradeType === trade);
  const q = query.trim().toLowerCase();
  const items = (preset?.items ?? []).filter((i) => !q || `${i.name} ${i.description}`.toLowerCase().includes(q));

  return (
    <section className="library" aria-label="Item library">
      <div className="library__head">
        <div className="library__filters">
          <SelectField
            label="Trade"
            value={trade}
            onChange={setTrade}
            options={presets.map((p) => ({ value: p.tradeType, label: TRADE_LABELS[p.tradeType] }))}
          />
          <div className="field library__search">
            <label className="field__label" htmlFor="library-search">
              Search items
            </label>
            <div className="input-group">
              <span className="input-affix input-affix--pre">
                <Search size={15} aria-hidden />
              </span>
              <input id="library-search" className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. driveway" />
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" iconOnly icon={X} onClick={onClose}>
          Close item library
        </Button>
      </div>
      <p className="muted small">Example items with demonstration prices — edit them in Templates → Trade presets.</p>
      {items.length === 0 ? (
        <p className="muted">No items match “{query}”.</p>
      ) : (
        <ul className="library__list">
          {items.map((i) => (
            <li key={i.id} className="library__item">
              <div>
                <p className="library__name">{i.name}</p>
                <p className="muted small">
                  {fmt.unitPrice(i.unitPrice)} / {unitLabel(i.unit, i.customUnit) || 'unit'} · default qty {fmt.num(i.defaultQuantity, 4)}
                </p>
              </div>
              <Button size="sm" icon={Plus} onClick={() => onAdd(lineFromPreset(i))} aria-label={`Add ${i.name}`}>
                Add
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
