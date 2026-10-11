import { ChevronDown, Lock, Sparkles } from 'lucide-react';
import { useId, useState } from 'react';
import { COST_CATEGORY_LABELS } from '../../data/regions';
import type { QuoteCalculation } from '../../domain/calc';
import { COST_CATEGORIES } from '../../domain/types';
import type { Fmt } from '../../format/useFmt';
import { Button } from '../../ui/Button';
import { Callout } from '../../ui/layout';
import { StatusBadge } from '../status';

const OVERHEAD_LABEL = {
  none: 'not allocated',
  perJob: 'fixed per job',
  perLaborHour: 'per labor hour',
  percentOfDirectCost: '% of direct costs',
} as const;

export function ProfitPanel({
  calc,
  fmt,
  discountWarningPercent,
  onUseTargetPricing,
}: {
  calc: QuoteCalculation;
  fmt: Fmt;
  discountWarningPercent: number;
  /** Offered when a manually priced quote misses its target. */
  onUseTargetPricing?: () => void;
}) {
  const [showCosts, setShowCosts] = useState(false);
  const costsId = useId();
  const { profit: p, costs: c, target: t } = calc;
  const status = t.status;
  const hasRevenue = calc.revenueExTax > 0;
  const generalIssues = calc.issues.filter((i) => !i.lineId);
  const discountTooHigh =
    discountWarningPercent > 0 && calc.discount.percentOfBase !== null && calc.discount.percentOfBase > discountWarningPercent;

  return (
    <section className={`profit profit--${status}`} aria-labelledby="profit-title">
      <header className="profit__head">
        <div>
          <p className="profit__eyebrow">
            <Lock size={12} aria-hidden /> Internal — never shown to the customer
          </p>
          <h2 id="profit-title" className="profit__title">
            Job profitability
          </h2>
        </div>
        <StatusBadge status={status} />
      </header>

      <div className="profit__hero">
        <div className="profit__stat">
          <span className="profit__k">Customer total</span>
          <span className="profit__v money">{fmt.money(calc.total)}</span>
        </div>
        <div className="profit__stat">
          <span className="profit__k">Estimated profit</span>
          <span className={`profit__v money ${p.profit < 0 ? 'is-negative' : ''}`}>{fmt.money(p.profit)}</span>
        </div>
        <div className="profit__stat">
          <span className="profit__k">Margin</span>
          <span className={`profit__v num ${p.profit < 0 ? 'is-negative' : ''}`}>{fmt.pct(p.marginPercent)}</span>
        </div>
      </div>

      <MarginMeter calc={calc} fmt={fmt} />

      <dl className="profit__rows">
        <div className="profit__row">
          <dt>Revenue excl. tax</dt>
          <dd className="money">{fmt.money(calc.revenueExTax)}</dd>
        </div>
        {calc.tax.total !== 0 && (
          <div className="profit__row profit__row--muted">
            <dt>Tax collected (not revenue)</dt>
            <dd className="money">{fmt.money(calc.tax.total)}</dd>
          </div>
        )}
        <div className="profit__row">
          <dt>
            <button type="button" className="profit__expand" aria-expanded={showCosts} aria-controls={costsId} onClick={() => setShowCosts(!showCosts)}>
              Direct job costs
              <ChevronDown size={14} aria-hidden />
            </button>
          </dt>
          <dd className="money">−{fmt.money(c.direct)}</dd>
        </div>
        {showCosts && (
          <div id={costsId} className="profit__breakdown">
            {COST_CATEGORIES.map((k) => (
              <div key={k} className={`profit__row profit__row--sub ${c[k] === 0 ? 'is-zero' : ''}`}>
                <dt>{COST_CATEGORY_LABELS[k]}</dt>
                <dd className="money">{fmt.money(c[k])}</dd>
              </div>
            ))}
          </div>
        )}
        <div className="profit__row">
          <dt>
            Allocated overhead <span className="profit__hint">({OVERHEAD_LABEL[calc.overheadMethod]})</span>
          </dt>
          <dd className="money">−{fmt.money(c.overhead)}</dd>
        </div>
        <div className="profit__row profit__row--strong">
          <dt>Estimated profit after overhead</dt>
          <dd className={`money ${p.profit < 0 ? 'is-negative' : ''}`}>{fmt.money(p.profit)}</dd>
        </div>
        <div className="profit__row">
          <dt>
            Margin after overhead <span className="profit__hint">(profit ÷ revenue)</span>
          </dt>
          <dd className="num">{fmt.pct(p.marginPercent)}</dd>
        </div>
        <div className="profit__row">
          <dt>
            Markup on cost <span className="profit__hint">(profit ÷ cost)</span>
          </dt>
          <dd className="num">{c.total > 0 ? fmt.pct(p.markupPercent) : '—'}</dd>
        </div>
        <div className="profit__row profit__row--muted">
          <dt>Direct gross profit before overhead</dt>
          <dd className="money">
            {fmt.money(p.directProfit)} <span className="profit__hint">· {fmt.pct(p.directMarginPercent)}</span>
          </dd>
        </div>
        {calc.laborHours > 0 && (
          <>
            <div className="profit__row profit__row--muted">
              <dt>Labor hours (all crew)</dt>
              <dd className="num">{fmt.num(calc.laborHours)} h</dd>
            </div>
            <div className="profit__row profit__row--muted">
              <dt>Effective billable rate</dt>
              <dd className="money">{p.effectiveHourlyRate !== null ? `${fmt.money(p.effectiveHourlyRate)}/h` : '—'}</dd>
            </div>
            <div className="profit__row profit__row--muted">
              <dt>Profit per labor hour</dt>
              <dd className="money">{p.profitPerLaborHour !== null ? `${fmt.money(p.profitPerLaborHour)}/h` : '—'}</dd>
            </div>
          </>
        )}
        {calc.deposit.type !== 'none' && (
          <>
            <div className="profit__row profit__row--muted">
              <dt>Deposit (part of the total)</dt>
              <dd className="money">{fmt.money(calc.deposit.amount)}</dd>
            </div>
            <div className="profit__row profit__row--muted">
              <dt>Remaining balance</dt>
              <dd className="money">{fmt.money(calc.deposit.balance)}</dd>
            </div>
          </>
        )}
      </dl>

      {hasRevenue && <MoneyBar calc={calc} fmt={fmt} />}

      <StatusAdvice calc={calc} fmt={fmt} onUseTargetPricing={onUseTargetPricing} />

      {discountTooHigh && (
        <Callout tone="warning" compact>
          The discount is {fmt.pct(calc.discount.percentOfBase)} of the subtotal — above your {fmt.pct(discountWarningPercent, 0)} warning level.
        </Callout>
      )}
      {generalIssues.length > 0 && (
        <ul className="profit__issues">
          {generalIssues.map((i) => (
            <li key={i.code + i.message} className={`issue issue--${i.severity}`}>
              {i.message}
            </li>
          ))}
        </ul>
      )}

      <p className="profit__disclaimer">
        Estimates based on the costs and assumptions you entered — not a guarantee of actual profit. Overhead is an allocation, so profit after
        overhead is not the same as accounting gross profit.
      </p>
    </section>
  );
}

function StatusAdvice({ calc, fmt, onUseTargetPricing }: { calc: QuoteCalculation; fmt: Fmt; onUseTargetPricing?: () => void }) {
  const t = calc.target;
  const target = fmt.pct(t.targetMarginPercent, 0);
  const suggestion =
    t.requiredRevenue !== null && t.shortfall > 0 ? (
      <>
        To reach {target}, revenue before tax needs to be at least <strong className="money">{fmt.money(t.requiredRevenue)}</strong> —{' '}
        <strong className="money">{fmt.money(t.shortfall)}</strong> more than now.
      </>
    ) : null;
  const action =
    onUseTargetPricing && calc.pricingMode === 'manual' && t.shortfall > 0 ? (
      <Button size="sm" variant="secondary" icon={Sparkles} onClick={onUseTargetPricing}>
        Price from costs at {target} margin
      </Button>
    ) : null;

  switch (t.status) {
    case 'healthy':
      return (
        <Callout tone="success" compact>
          Margin meets your {target} target.
        </Callout>
      );
    case 'belowTarget':
      return (
        <Callout tone="warning" compact title={`Below your ${target} target margin`} action={action}>
          {suggestion}
          {calc.pricingMode !== 'manual' && ' Manual prices, discounts or a missing cost on an auto-priced line are holding it down.'}
        </Callout>
      );
    case 'lowMargin':
      return (
        <Callout tone="danger" compact title={`Margin is below your ${fmt.pct(t.minimumMarginPercent, 0)} minimum`} action={action}>
          {suggestion}
        </Callout>
      );
    case 'loss':
      return (
        <Callout tone="danger" compact title={`This job loses an estimated ${fmt.money(-calc.profit.profit)}`} action={action}>
          {suggestion ?? 'Costs exceed the price. Review prices and costs before sending this quote.'}
        </Callout>
      );
    case 'invalid':
      return (
        <Callout tone="danger" compact title="Some inputs need attention">
          {calc.issues
            .filter((i) => i.severity === 'error')
            .map((i) => i.message)
            .join(' ')}
        </Callout>
      );
    default:
      return (
        <Callout tone="neutral" compact>
          Add items with prices to see the estimated profit.
        </Callout>
      );
  }
}

function MarginMeter({ calc, fmt }: { calc: QuoteCalculation; fmt: Fmt }) {
  const margin = calc.profit.marginPercent;
  const { targetMarginPercent: target, minimumMarginPercent: floor, status } = calc.target;
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const fill = margin === null ? 0 : clamp(margin);
  const label =
    margin === null
      ? 'No margin yet'
      : `Margin ${fmt.pct(margin)} against a target of ${fmt.pct(target, 0)} and a minimum of ${fmt.pct(floor, 0)}`;
  return (
    <div className="meter" role="img" aria-label={label}>
      <div className="meter__track">
        <div className={`meter__fill meter__fill--${status}`} style={{ width: `${fill}%` }} />
        {floor > 0 && <span className="meter__tick meter__tick--floor" style={{ left: `${clamp(floor)}%` }} />}
        <span className="meter__tick meter__tick--target" style={{ left: `${clamp(target)}%` }} />
      </div>
      <div className="meter__legend">
        <span>0%</span>
        <span className="meter__target" style={{ left: `${clamp(target)}%` }}>
          Target {fmt.pct(target, 0)}
        </span>
        <span>100%</span>
      </div>
    </div>
  );
}

/** How the revenue (excl. tax) splits into direct costs, overhead and profit. */
function MoneyBar({ calc, fmt }: { calc: QuoteCalculation; fmt: Fmt }) {
  const rev = calc.revenueExTax;
  const { direct, overhead } = calc.costs;
  const profit = calc.profit.profit;
  const whole = Math.max(rev, direct + overhead);
  const pct = (v: number) => (whole > 0 ? (Math.max(0, v) / whole) * 100 : 0);
  const segments = [
    { key: 'direct', label: 'Direct costs', value: direct },
    { key: 'overhead', label: 'Overhead', value: overhead },
    { key: profit >= 0 ? 'profit' : 'loss', label: profit >= 0 ? 'Profit' : 'Loss', value: Math.abs(profit) },
  ];
  return (
    <figure className="moneybar">
      <figcaption className="moneybar__caption">Where the price goes</figcaption>
      <div
        className="moneybar__track"
        role="img"
        aria-label={segments.map((s) => `${s.label} ${fmt.money(s.value)}`).join(', ')}
      >
        {segments.map((s) => (
          <span key={s.key} className={`moneybar__seg moneybar__seg--${s.key}`} style={{ width: `${pct(s.value)}%` }} />
        ))}
      </div>
      <ul className="moneybar__legend">
        {segments.map((s) => (
          <li key={s.key}>
            <span className={`moneybar__dot moneybar__seg--${s.key}`} aria-hidden />
            {s.label} <span className="money">{fmt.money(s.value)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
