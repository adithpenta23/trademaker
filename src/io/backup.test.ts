import { describe, expect, it } from 'vitest';
import { demoSession } from '../data/demo';
import { calculateQuote } from '../domain/calc';
import { FIXED_NOW } from '../test/fixtures';
import { buildBackup, mergeIntoSession, parseBackupText, replaceSessionWith, serializeBackup } from './backup';

const session = () => demoSession(FIXED_NOW);

describe('JSON backup', () => {
  it('20. full export → import round trip preserves everything', () => {
    const original = session();
    const text = serializeBackup(buildBackup('full', original, FIXED_NOW));
    const result = parseBackupText(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary).toMatchObject({ kind: 'full', quoteCount: 6, hasSettings: true, businessName: 'Evergreen Exterior Care' });
    const restored = replaceSessionWith(original, result.file);
    expect(restored).toEqual(original);
    // Calculations are identical after the round trip.
    original.quotes.forEach((q, i) => {
      expect(calculateQuote(restored.quotes[i]!)).toEqual(calculateQuote(q));
    });
  });

  it('20b. single-quote and quotes-only exports round trip', () => {
    const s = session();
    const one = parseBackupText(serializeBackup(buildBackup('quote', s, FIXED_NOW, [s.quotes[2]!.id])));
    expect(one.ok && one.file.data.quotes).toEqual([s.quotes[2]]);
    const many = parseBackupText(serializeBackup(buildBackup('quotes', s, FIXED_NOW)));
    expect(many.ok && many.summary.templateCount).toBe(s.templates.length);
  });

  it('21. rejects invalid JSON and non-backup files with readable errors', () => {
    expect(parseBackupText('{ not json')).toEqual({ ok: false, error: expect.stringContaining("isn't valid JSON") });
    expect(parseBackupText('[1,2,3]')).toEqual({ ok: false, error: expect.stringContaining("isn't a TradeMaker backup") });
    expect(parseBackupText('{"format":"trademaker-backup","schemaVersion":99,"kind":"full"}')).toEqual({
      ok: false,
      error: expect.stringContaining('newer version'),
    });
    expect(parseBackupText('{"format":"trademaker-backup","kind":"full"}')).toEqual({
      ok: false,
      error: expect.stringContaining('schema version'),
    });
  });

  it('21b. rejects out-of-range numbers, bad structure and unsafe content with the field path', () => {
    const file = buildBackup('full', session(), FIXED_NOW);
    const bad = JSON.parse(serializeBackup(file));
    bad.data.quotes[0].lineItems[0].quantity = -5;
    const r1 = parseBackupText(JSON.stringify(bad));
    expect(r1.ok).toBe(false);
    expect(!r1.ok && r1.error).toMatch(/quotes\[0\]\.lineItems\[0\]\.quantity/);

    const badMargin = JSON.parse(serializeBackup(file));
    badMargin.data.quotes[1].pricing.targetMarginPercent = 100;
    expect(parseBackupText(JSON.stringify(badMargin)).ok).toBe(false);

    const badCurrency = JSON.parse(serializeBackup(file));
    badCurrency.data.business.currency = 'DOLLARS';
    expect(parseBackupText(JSON.stringify(badCurrency)).ok).toBe(false);

    const badLogo = JSON.parse(serializeBackup(file));
    badLogo.data.business.logoDataUrl = 'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Pg==';
    expect(parseBackupText(JSON.stringify(badLogo)).ok).toBe(false);

    const dupIds = JSON.parse(serializeBackup(file));
    dupIds.data.quotes[1].id = dupIds.data.quotes[0].id;
    const r2 = parseBackupText(JSON.stringify(dupIds));
    expect(!r2.ok && r2.error).toMatch(/duplicate quote ID/);

    const missingLines = JSON.parse(serializeBackup(file));
    delete missingLines.data.quotes[0].lineItems;
    expect(parseBackupText(JSON.stringify(missingLines)).ok).toBe(false);
  });

  it('drops unknown properties instead of importing them', () => {
    const file = JSON.parse(serializeBackup(buildBackup('quote', session(), FIXED_NOW)));
    file.data.quotes[0].__proto__polluted = 'x';
    file.data.quotes[0].lineItems[0].onclick = 'alert(1)';
    const r = parseBackupText(JSON.stringify(file));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.file.data.quotes[0]!)).not.toContain('__proto__polluted');
    expect(Object.keys(r.file.data.quotes[0]!.lineItems[0]!)).not.toContain('onclick');
  });

  it('merge avoids ID collisions and skips exact duplicates', () => {
    const current = session();
    const file = buildBackup('quotes', current, FIXED_NOW);
    const parsed = parseBackupText(serializeBackup(file));
    if (!parsed.ok) throw new Error(parsed.error);
    // Identical content → skipped.
    const same = mergeIntoSession(current, parsed.file);
    expect(same.quotes).toHaveLength(0);
    expect(same.skippedDuplicates).toBe(current.quotes.length + current.templates.length);

    // Edited content with the same IDs → added with fresh IDs.
    const edited = parseBackupText(serializeBackup(file));
    if (!edited.ok) throw new Error(edited.error);
    edited.file.data.quotes[0]!.title = 'Edited elsewhere';
    const merged = mergeIntoSession(current, edited.file);
    expect(merged.quotes).toHaveLength(1);
    expect(merged.quotes[0]!.id).not.toBe(current.quotes[0]!.id);
    expect(merged.renumberedIds).toBe(1);
    expect(merged.duplicateQuoteNumbers).toBe(1);
  });
});
