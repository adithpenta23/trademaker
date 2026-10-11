/**
 * Minimal validation combinators for untrusted input (imported backups).
 * Each validator returns a clean, fully-typed value built from scratch —
 * unknown properties are dropped, so nothing unexpected reaches app state.
 */

export class ValidationError extends Error {
  readonly path: string;
  constructor(path: string, message: string) {
    super(path ? `${path}: ${message}` : message);
    this.name = 'ValidationError';
    this.path = path;
  }
}

export type Validator<T> = (value: unknown, path: string) => T;

const at = (path: string, key: string | number) =>
  typeof key === 'number' ? `${path}[${key}]` : path ? `${path}.${key}` : key;

export function str(opts: { max?: number; pattern?: RegExp; patternMessage?: string; nonEmpty?: boolean } = {}): Validator<string> {
  const max = opts.max ?? 10_000;
  return (value, path) => {
    if (typeof value !== 'string') throw new ValidationError(path, 'must be text');
    if (value.length > max) throw new ValidationError(path, `is too long (maximum ${max.toLocaleString('en-US')} characters)`);
    if (opts.nonEmpty && value.trim() === '') throw new ValidationError(path, 'must not be empty');
    if (opts.pattern && !opts.pattern.test(value)) throw new ValidationError(path, opts.patternMessage ?? 'has an invalid format');
    return value;
  };
}

export function num(min: number, max: number, opts: { integer?: boolean } = {}): Validator<number> {
  return (value, path) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new ValidationError(path, 'must be a number');
    if (opts.integer && !Number.isInteger(value)) throw new ValidationError(path, 'must be a whole number');
    if (value < min || value > max) {
      throw new ValidationError(path, `must be between ${min.toLocaleString('en-US')} and ${max.toLocaleString('en-US')}`);
    }
    return value;
  };
}

export const bool: Validator<boolean> = (value, path) => {
  if (typeof value !== 'boolean') throw new ValidationError(path, 'must be true or false');
  return value;
};

export function oneOf<T extends string>(values: readonly T[]): Validator<T> {
  return (value, path) => {
    if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
      throw new ValidationError(path, `must be one of: ${values.join(', ')}`);
    }
    return value as T;
  };
}

export function nullable<T>(inner: Validator<T>): Validator<T | null> {
  return (value, path) => (value === null ? null : inner(value, path));
}

/** A property that may be absent. */
export function optional<T>(inner: Validator<T>): Validator<T | undefined> {
  return (value, path) => (value === undefined ? undefined : inner(value, path));
}

/** Accept a missing (undefined) property by substituting a default. */
export function withDefault<T>(inner: Validator<T>, fallback: () => T): Validator<T> {
  return (value, path) => (value === undefined ? fallback() : inner(value, path));
}

export function arrayOf<T>(inner: Validator<T>, max: number): Validator<T[]> {
  return (value, path) => {
    if (!Array.isArray(value)) throw new ValidationError(path, 'must be a list');
    if (value.length > max) throw new ValidationError(path, `has too many entries (maximum ${max})`);
    return value.map((item, i) => inner(item, at(path, i)));
  };
}

type Shape<T> = { [K in keyof T]-?: Validator<T[K]> };

export function object<T>(shape: Shape<T>): Validator<T> {
  return (value, path) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new ValidationError(path, 'must be an object');
    }
    const source = value as Record<string, unknown>;
    const out = {} as T;
    for (const key of Object.keys(shape) as (keyof T & string)[]) {
      const validator = shape[key];
      out[key] = validator(Object.prototype.hasOwnProperty.call(source, key) ? source[key] : undefined, at(path, key));
    }
    return out;
  };
}

/** Reject lists containing duplicate `id` values. */
export function uniqueIds<T extends { id: string }>(inner: Validator<T[]>, what: string): Validator<T[]> {
  return (value, path) => {
    const list = inner(value, path);
    const seen = new Set<string>();
    for (const item of list) {
      if (seen.has(item.id)) throw new ValidationError(path, `contains a duplicate ${what} ID "${item.id}"`);
      seen.add(item.id);
    }
    return list;
  };
}
