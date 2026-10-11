import { CircleAlert, CircleCheckBig, OctagonAlert, TrendingDown, TriangleAlert } from 'lucide-react';
import type { ProfitStatus } from '../domain/calc';

export const STATUS_META: Record<
  ProfitStatus,
  { label: string; tone: 'green' | 'amber' | 'red' | 'neutral'; icon: typeof CircleCheckBig }
> = {
  healthy: { label: 'On target', tone: 'green', icon: CircleCheckBig },
  belowTarget: { label: 'Below target', tone: 'amber', icon: TriangleAlert },
  lowMargin: { label: 'Low margin', tone: 'red', icon: TrendingDown },
  loss: { label: 'Loss', tone: 'red', icon: OctagonAlert },
  noRevenue: { label: 'No price yet', tone: 'neutral', icon: CircleAlert },
  invalid: { label: 'Check inputs', tone: 'red', icon: OctagonAlert },
};

/** Status pill: colour plus icon plus text, so it never relies on colour alone. */
export function StatusBadge({ status, compact }: { status: ProfitStatus; compact?: boolean }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`status status--${meta.tone} ${compact ? 'status--compact' : ''}`}>
      <Icon size={compact ? 13 : 14} aria-hidden strokeWidth={2.2} />
      {meta.label}
    </span>
  );
}
