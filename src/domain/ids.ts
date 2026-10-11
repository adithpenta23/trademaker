/**
 * Stable random IDs for quotes, templates, line items etc. These are internal
 * identifiers, independent of the editable customer-facing quote number.
 * Uses crypto.getRandomValues, which is available in every modern browser
 * (including non-secure contexts, unlike crypto.randomUUID).
 */
export function newId(prefix: string): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += (b % 36).toString(36);
  return `${prefix}_${out}`;
}
