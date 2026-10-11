import { useId, useState, type ReactNode, type SelectHTMLAttributes } from 'react';
import { currencyDecimals } from '../domain/currency';
import { countDecimals, currencySymbol, parseDecimal, toInputString } from '../format/format';

interface FieldShellProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  htmlFor: string;
  hintId: string;
  errorId: string;
  className?: string;
  hideLabel?: boolean;
  optional?: boolean;
  children: ReactNode;
}

function FieldShell({ label, hint, error, htmlFor, hintId, errorId, className, hideLabel, optional, children }: FieldShellProps) {
  return (
    <div className={`field ${className ?? ''} ${error ? 'has-error' : ''}`}>
      <label className={hideLabel ? 'sr-only' : 'field__label'} htmlFor={htmlFor}>
        {label}
        {optional && !hideLabel && <span className="field__optional"> (optional)</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(hint: unknown, error: unknown, hintId: string, errorId: string) {
  return error ? errorId : hint ? hintId : undefined;
}

interface TextFieldProps {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: string | null;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel' | 'url' | 'date';
  maxLength?: number;
  className?: string;
  hideLabel?: boolean;
  optional?: boolean;
  autoComplete?: string;
  inputClassName?: string;
  onBlur?: () => void;
  inputRef?: React.Ref<HTMLInputElement>;
  required?: boolean;
  disabled?: boolean;
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  error,
  placeholder,
  type = 'text',
  maxLength = 200,
  className,
  hideLabel,
  optional,
  autoComplete,
  inputClassName,
  onBlur,
  inputRef,
  required,
  disabled,
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <FieldShell {...{ label, hint, error, htmlFor: id, hintId, errorId, className, hideLabel, optional }}>
      <input
        ref={inputRef}
        id={id}
        className={`input ${inputClassName ?? ''}`}
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete ?? 'off'}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, hintId, errorId)}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        required={required}
        disabled={disabled}
      />
    </FieldShell>
  );
}

interface TextAreaProps {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  className?: string;
  hideLabel?: boolean;
  optional?: boolean;
}

export function TextArea({ label, value, onChange, hint, placeholder, rows = 3, maxLength = 10_000, className, hideLabel, optional }: TextAreaProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <FieldShell {...{ label, hint, htmlFor: id, hintId, errorId: '', className, hideLabel, optional }}>
      <textarea
        id={id}
        className="input textarea"
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-describedby={hint ? hintId : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldShell>
  );
}

interface SelectFieldProps<T extends string> extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  label: ReactNode;
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  hint?: ReactNode;
  hideLabel?: boolean;
  fieldClassName?: string;
}

export function SelectField<T extends string>({ label, value, onChange, options, hint, hideLabel, fieldClassName, ...rest }: SelectFieldProps<T>) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <FieldShell {...{ label, hint, htmlFor: id, hintId, errorId: '', className: fieldClassName, hideLabel }}>
      <select
        id={id}
        className="input select"
        value={value}
        aria-describedby={hint ? hintId : undefined}
        onChange={(e) => onChange(e.target.value as T)}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export interface NumberFieldProps {
  label: ReactNode;
  value: number;
  onChange: (value: number) => void;
  locale: string;
  min?: number;
  max?: number;
  maxDecimals?: number;
  integer?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  hint?: ReactNode;
  className?: string;
  hideLabel?: boolean;
  placeholder?: string;
  /** Message for values above `max`. */
  maxMessage?: string;
  inputClassName?: string;
  /** Pad the displayed value (when not editing) to at least this many decimals, e.g. 0.6 → 0.60. */
  minDecimals?: number;
  readOnlyLook?: boolean;
  disabled?: boolean;
  onFocusChange?: (focused: boolean) => void;
}

/**
 * Text input for numbers. Keeps the user's draft while typing (so "1." or ""
 * are allowed mid-edit), commits only valid in-range values, and shows an
 * inline, screen-reader-announced error for anything else.
 */
export function NumberField({
  label,
  value,
  onChange,
  locale,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  maxDecimals = 4,
  integer,
  prefix,
  suffix,
  hint,
  className,
  hideLabel,
  placeholder,
  maxMessage,
  inputClassName,
  minDecimals = 0,
  readOnlyLook,
  disabled,
  onFocusChange,
}: NumberFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const decimals = integer ? 0 : maxDecimals;

  const validate = (text: string): { value: number } | { error: string } => {
    const parsed = parseDecimal(text, locale);
    if (!parsed.ok) return parsed.reason === 'empty' ? { value: Math.max(0, min) } : { error: 'Enter a number.' };
    const v = parsed.value;
    if (v < min) return { error: min === 0 ? 'Enter 0 or more.' : `Enter at least ${min}.` };
    if (v > max) return { error: maxMessage ?? `Enter ${max.toLocaleString(locale)} or less.` };
    if (integer && !Number.isInteger(v)) return { error: 'Enter a whole number.' };
    if (countDecimals(v) > decimals) return { error: `Use at most ${decimals} decimal places.` };
    return { value: v };
  };

  const shown = draft ?? (Number.isFinite(value) ? toInputString(value, locale, decimals, minDecimals) : '');

  return (
    <FieldShell {...{ label, hint, error, htmlFor: id, hintId, errorId, className, hideLabel }}>
      <div className={`input-group ${readOnlyLook ? 'is-derived' : ''}`}>
        {prefix && <span className="input-affix input-affix--pre">{prefix}</span>}
        <input
          id={id}
          className={`input num ${inputClassName ?? ''}`}
          inputMode={integer ? 'numeric' : 'decimal'}
          autoComplete="off"
          value={shown}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hint, error, hintId, errorId)}
          onFocus={(e) => {
            setDraft(toInputString(value, locale, decimals));
            onFocusChange?.(true);
            e.currentTarget.select();
          }}
          onChange={(e) => {
            const text = e.target.value;
            setDraft(text);
            const result = validate(text);
            if ('error' in result) {
              setError(result.error);
            } else {
              setError(null);
              if (result.value !== value) onChange(result.value);
            }
          }}
          onBlur={() => {
            onFocusChange?.(false);
            if (!error) setDraft(null);
          }}
        />
        {suffix && <span className="input-affix input-affix--post">{suffix}</span>}
      </div>
    </FieldShell>
  );
}

export function MoneyField(props: Omit<NumberFieldProps, 'prefix'> & { currency: string }) {
  const { currency, ...rest } = props;
  return <NumberField max={10_000_000} minDecimals={currencyDecimals(currency)} {...rest} prefix={currencySymbol(currency, props.locale)} />;
}

export function PercentField(props: Omit<NumberFieldProps, 'suffix'>) {
  return <NumberField max={100} {...props} suffix="%" />;
}

export function Checkbox({
  label,
  checked,
  onChange,
  hint,
  className,
  disabled,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={`check ${className ?? ''}`}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      <label htmlFor={id}>
        <span className="check__label">{label}</span>
        {hint && (
          <span className="check__hint" id={`${id}-hint`}>
            {hint}
          </span>
        )}
      </label>
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  hideLabel,
  size = 'md',
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: ReactNode; description?: string }[];
  onChange: (value: T) => void;
  hideLabel?: boolean;
  size?: 'sm' | 'md';
}) {
  const id = useId();
  return (
    <div className="field">
      <span id={id} className={hideLabel ? 'sr-only' : 'field__label'}>
        {label}
      </span>
      <div className={`segmented segmented--${size}`} role="radiogroup" aria-labelledby={id}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            title={o.description}
            className={`segmented__option ${o.value === value ? 'is-active' : ''}`}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const i = options.findIndex((x) => x.value === value);
              let target = -1;
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') target = (i + 1) % options.length;
              else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') target = (i - 1 + options.length) % options.length;
              const next = options[target];
              if (!next) return;
              e.preventDefault();
              onChange(next.value);
              (e.currentTarget.parentElement?.children[target] as HTMLElement | undefined)?.focus();
            }}
            tabIndex={o.value === value ? 0 : -1}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function emailError(value: string): string | null {
  return value.trim() && !EMAIL_PATTERN.test(value.trim()) ? 'Enter a valid email address, like name@example.com.' : null;
}
