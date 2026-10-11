import type { ButtonHTMLAttributes, ComponentType, ReactNode } from 'react';
import { forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ComponentType<{ size?: number; 'aria-hidden'?: boolean; strokeWidth?: number }>;
  iconOnly?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, iconOnly, className, children, type = 'button', ...rest },
  ref,
) {
  const classes = ['btn', `btn--${variant}`, `btn--${size}`, iconOnly ? 'btn--icon' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} type={type} className={classes} {...rest}>
      {Icon && <Icon size={size === 'sm' ? 15 : 17} aria-hidden strokeWidth={2} />}
      {iconOnly ? <span className="sr-only">{children}</span> : children}
    </button>
  );
});

export function LinkButton({
  href,
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  children,
  className,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  icon?: ButtonProps['icon'];
  children: ReactNode;
  className?: string;
}) {
  return (
    <a href={href} className={['btn', `btn--${variant}`, `btn--${size}`, className ?? ''].join(' ')}>
      {Icon && <Icon size={size === 'sm' ? 15 : 17} aria-hidden strokeWidth={2} />}
      {children}
    </a>
  );
}
