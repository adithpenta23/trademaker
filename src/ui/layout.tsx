import { ChevronDown, CircleAlert, CircleCheckBig, Info, OctagonAlert, TriangleAlert } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
  id,
  icon,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  icon?: ReactNode;
}) {
  const headingId = useId();
  return (
    <section className={`card ${className ?? ''}`} id={id} aria-labelledby={title ? headingId : undefined}>
      {(title || actions) && (
        <header className="card__header">
          <div className="card__heading">
            {icon && <span className="card__icon">{icon}</span>}
            <div>
              {title && (
                <h2 className="card__title" id={headingId}>
                  {title}
                </h2>
              )}
              {subtitle && <p className="card__subtitle">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="card__actions">{actions}</div>}
        </header>
      )}
      <div className="card__body">{children}</div>
    </section>
  );
}

/** A card whose body can be collapsed. Header is a real button with aria-expanded. */
export function CollapsibleCard({
  title,
  subtitle,
  summary,
  defaultOpen = true,
  children,
  id,
  badge,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  id?: string;
  badge?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <section className={`card card--collapsible ${open ? 'is-open' : ''}`} id={id}>
      <h2 className="card__toggle-heading">
        <button type="button" className="card__toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}>
          <span className="card__toggle-text">
            <span className="card__title">
              {title}
              {badge}
            </span>
            {subtitle && <span className="card__subtitle">{subtitle}</span>}
          </span>
          {!open && summary && <span className="card__summary">{summary}</span>}
          <ChevronDown className="card__chevron" size={18} aria-hidden />
        </button>
      </h2>
      <div className="card__body" id={bodyId} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

type Tone = 'info' | 'warning' | 'danger' | 'success' | 'neutral';
const TONE_ICON = { info: Info, warning: TriangleAlert, danger: OctagonAlert, success: CircleCheckBig, neutral: CircleAlert };

export function Callout({
  tone = 'info',
  title,
  children,
  action,
  className,
  compact,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const Icon = TONE_ICON[tone];
  return (
    <div className={`callout callout--${tone} ${compact ? 'callout--compact' : ''} ${className ?? ''}`}>
      <Icon size={compact ? 16 : 18} aria-hidden className="callout__icon" />
      <div className="callout__content">
        {title && <p className="callout__title">{title}</p>}
        {children && <div className="callout__body">{children}</div>}
        {action && <div className="callout__action">{action}</div>}
      </div>
    </div>
  );
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone | 'green' | 'amber' | 'red' | 'sample'; children: ReactNode; className?: string }) {
  return <span className={`badge badge--${tone} ${className ?? ''}`}>{children}</span>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1 className="page-title" tabIndex={-1} data-page-heading>
          {title}
        </h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, children, actions }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state__icon">{icon}</div>}
      <h3 className="empty-state__title">{title}</h3>
      {children && <div className="empty-state__body">{children}</div>}
      {actions && <div className="empty-state__actions">{actions}</div>}
    </div>
  );
}

/** Small inline "what does this mean?" helper that expands in place (no hover-only tooltips). */
export function HelpText({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="help">
      <button type="button" className="help__toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open && (
        <span className="help__text" id={id} role="note">
          {children}
        </span>
      )}
    </span>
  );
}
