import { useEffect, useId, useRef, useState, type ComponentType, type ReactNode } from 'react';

export interface MenuItem {
  label: string;
  icon?: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** Accessible menu button: Enter/Space/ArrowDown opens, arrows move, Escape closes. */
export function Menu({
  label,
  items,
  trigger,
  align = 'end',
  triggerClassName = 'btn btn--secondary btn--md',
}: {
  label: string;
  items: MenuItem[];
  trigger: ReactNode;
  align?: 'start' | 'end';
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current.find((el) => el && !el.disabled)?.focus();
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const move = (delta: number) => {
    const els = itemRefs.current.filter((el): el is HTMLButtonElement => !!el && !el.disabled);
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    els[(i + delta + els.length) % els.length]?.focus();
  };

  return (
    <div className="menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          aria-label={label}
          className={`menu__list menu__list--${align}`}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              close();
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              move(1);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              move(-1);
            } else if (e.key === 'Tab') {
              close(false);
            }
          }}
        >
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={item.disabled}
                className={`menu__item ${item.danger ? 'menu__item--danger' : ''}`}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
              >
                {Icon && <Icon size={16} aria-hidden />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
