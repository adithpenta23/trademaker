import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { demoSession } from '../data/demo';
import { calculateQuote } from '../domain/calc';
import { buildCustomerDocument } from '../domain/customerDocument';
import { line } from '../test/fixtures';
import { FIXED_NOW } from '../test/fixtures';
import { createQuotePdf, pdfFileName, unsupportedCharacters } from './exportPdf';

async function bytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/** Set PDF_OUT=<dir> to write the generated PDFs for manual inspection. */
const outDir = process.env.PDF_OUT;

describe('PDF export', () => {
  const session = demoSession(FIXED_NOW);

  it('creates a real PDF from the customer document', async () => {
    const quote = session.quotes.find((q) => q.title.startsWith('Deck'))!;
    const doc = buildCustomerDocument(quote, calculateQuote(quote), session.business);
    const result = await createQuotePdf(doc);
    const data = await bytes(result.blob);
    if (outDir) writeFileSync(join(outDir, result.filename), data);
    expect(new TextDecoder().decode(data.slice(0, 5))).toBe('%PDF-');
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
    expect(result.pageCount).toBeLessThanOrEqual(2);
    expect(result.warnings).toEqual([]);
    expect(result.filename).toBe('Quote-EEC-1004.pdf');
  });

  it('paginates long quotes with many items and long descriptions', async () => {
    const base = session.quotes[0]!;
    const quote = {
      ...base,
      title: 'Whole-property exterior restoration with a deliberately long title to test wrapping across the page width',
      lineItems: Array.from({ length: 40 }, (_, i) =>
        line({
          name: `Item ${i + 1}: ${'Pressure wash and treat surfaces '.repeat((i % 3) + 1)}`,
          description: 'Detailed description of the work. '.repeat((i % 5) + 1),
          quantity: i + 1,
          unitPrice: 12.5,
        }),
      ),
      customerNotes: 'Line one of the notes.\n'.repeat(30),
    };
    const doc = buildCustomerDocument(quote, calculateQuote(quote), session.business);
    const result = await createQuotePdf(doc);
    expect(result.pageCount).toBeGreaterThan(2);
    if (outDir) writeFileSync(join(outDir, 'long-quote.pdf'), await bytes(result.blob));
  });

  it('renders every demo quote without warnings', async () => {
    for (const quote of session.quotes) {
      const doc = buildCustomerDocument(quote, calculateQuote(quote), session.business);
      const result = await createQuotePdf(doc);
      expect(result.warnings).toEqual([]);
      if (outDir) writeFileSync(join(outDir, `demo-${result.filename}`), await bytes(result.blob));
    }
  });

  it('flags characters the embedded font cannot draw', () => {
    expect(unsupportedCharacters('Zoë Łukasz ₹1,234 €9 £5 Ωμέγα Привет')).toEqual([]);
    expect(unsupportedCharacters('山田 太郎')).toEqual(['山', '田', '太', '郎']);
  });

  it('builds safe file names', () => {
    const quote = session.quotes[0]!;
    const doc = buildCustomerDocument({ ...quote, number: 'A/B:12*?' }, calculateQuote(quote), session.business);
    expect(pdfFileName(doc)).toBe('Quote-AB12.pdf');
  });
});
