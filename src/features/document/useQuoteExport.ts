import { useCallback } from 'react';
import { calculateQuote } from '../../domain/calc';
import { buildCustomerDocument, type CustomerDocument } from '../../domain/customerDocument';
import type { Quote } from '../../domain/types';
import { backupFileName, buildBackup, serializeBackup } from '../../io/backup';
import { downloadBlob, downloadText } from '../../io/files';
import { useStore } from '../../state/store';
import { useFeedback } from '../../ui/feedback';
import { usePrint } from './print';

let pdfModule: Promise<typeof import('../../pdf/exportPdf')> | null = null;

/** Load the PDF engine (and its embedded font) ahead of time so PDF export also works offline later. */
export function preloadPdfEngine() {
  pdfModule ??= import('../../pdf/exportPdf');
  pdfModule.catch(() => {
    pdfModule = null;
  });
  return pdfModule;
}

export function useQuoteExport() {
  const { state } = useStore();
  const { toast } = useFeedback();
  const { printDocument } = usePrint();
  const business = state.business;

  const documentFor = useCallback((quote: Quote): CustomerDocument => buildCustomerDocument(quote, calculateQuote(quote), business), [business]);

  const downloadPdf = useCallback(
    async (doc: CustomerDocument) => {
      try {
        const { createQuotePdf } = await preloadPdfEngine();
        const result = await createQuotePdf(doc);
        downloadBlob(result.blob, result.filename);
        toast({ message: `PDF downloaded (${result.pageCount} page${result.pageCount === 1 ? '' : 's'}).`, tone: 'success' });
        for (const w of result.warnings) toast({ message: w, tone: 'warning', duration: 9000 });
      } catch {
        toast({ message: "The PDF couldn't be created in this browser. Use Print / Save as PDF instead.", tone: 'danger', duration: 9000 });
      }
    },
    [toast],
  );

  const print = useCallback(
    (doc: CustomerDocument) => {
      if (!printDocument(doc)) {
        toast({ message: "Printing isn't available here. Try Download PDF instead.", tone: 'danger' });
      }
    },
    [printDocument, toast],
  );

  const exportQuoteJson = useCallback(
    (quote: Quote) => {
      const now = new Date();
      const file = buildBackup('quote', state, now, [quote.id]);
      downloadText(serializeBackup(file), backupFileName('quote', quote.number || quote.title || 'quote', now));
      toast({ message: `Exported ${quote.number || 'quote'} as JSON.`, tone: 'success' });
    },
    [state, toast],
  );

  return { documentFor, downloadPdf, print, exportQuoteJson };
}
