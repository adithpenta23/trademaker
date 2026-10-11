import { Plus, Trash } from 'lucide-react';
import { COST_CATEGORY_LABELS } from '../../data/regions';
import { newId } from '../../domain/ids';
import { LIMITS } from '../../domain/limits';
import { COST_CATEGORIES, type JobCost } from '../../domain/types';
import type { Fmt } from '../../format/useFmt';
import { Button } from '../../ui/Button';
import { MoneyField, SelectField, TextField } from '../../ui/fields';

/** Quote-level internal costs that don't belong to one line item. */
export function JobCostsEditor({
  costs,
  onChange,
  fmt,
}: {
  costs: JobCost[];
  onChange: (update: (costs: JobCost[]) => JobCost[]) => void;
  fmt: Fmt;
}) {
  const set = (id: string, patch: Partial<JobCost>) => onChange((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  return (
    <div className="job-costs">
      {costs.length > 0 && (
        <ul className="job-costs__list">
          {costs.map((c, i) => (
            <li key={c.id} className="job-costs__row">
              <TextField label={`Job cost ${i + 1} description`} value={c.label} onChange={(label) => set(c.id, { label })} placeholder="e.g. Dump fee, scaffold hire" />
              <SelectField
                label="Counts as"
                value={c.category}
                onChange={(category) => set(c.id, { category })}
                options={COST_CATEGORIES.map((k) => ({ value: k, label: COST_CATEGORY_LABELS[k] }))}
              />
              <MoneyField label="Amount" value={c.amount} onChange={(amount) => set(c.id, { amount })} locale={fmt.locale} currency={fmt.currency} />
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={Trash}
                className="job-costs__remove btn--danger-ghost"
                onClick={() => onChange((list) => list.filter((x) => x.id !== c.id))}
              >
                Remove {c.label || `job cost ${i + 1}`}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button
        size="sm"
        icon={Plus}
        disabled={costs.length >= LIMITS.jobCosts}
        onClick={() => onChange((list) => [...list, { id: newId('jc'), label: '', category: 'other', amount: 0 }])}
      >
        Add job cost
      </Button>
    </div>
  );
}
