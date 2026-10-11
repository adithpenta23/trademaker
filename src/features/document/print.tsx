import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';
import type { CustomerDocument } from '../../domain/customerDocument';
import { QuoteDocument } from './QuoteDocument';

/**
 * Print / "Save as PDF" through the browser. A print-only root outside the
 * app holds the customer document; print CSS hides the app and shows it.
 * Paper size and page numbers come from the @page rules in document.css.
 * The editor registers its current document so Ctrl/Cmd+P prints the quote.
 */

interface PrintApi {
  printDocument: (doc: CustomerDocument) => boolean;
  registerDocument: (doc: CustomerDocument | null) => void;
}

const PrintContext = createContext<PrintApi | null>(null);

export function PrintProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<CustomerDocument | null>(null);
  const registered = useRef<CustomerDocument | null>(null);

  useEffect(() => {
    const before = () => {
      if (registered.current) flushSync(() => setActive((current) => current ?? registered.current));
    };
    const after = () => setActive(null);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  // Layout effect: the class must be on <body> before the browser lays out the print.
  useLayoutEffect(() => {
    document.body.classList.toggle('has-print-doc', active !== null);
  }, [active]);

  const printDocument = useCallback((doc: CustomerDocument) => {
    if (typeof window.print !== 'function') return false;
    flushSync(() => setActive(doc));
    try {
      window.print();
      return true;
    } catch {
      setActive(null);
      return false;
    }
  }, []);

  const registerDocument = useCallback((doc: CustomerDocument | null) => {
    registered.current = doc;
  }, []);

  const api = useMemo(() => ({ printDocument, registerDocument }), [printDocument, registerDocument]);

  return (
    <PrintContext.Provider value={api}>
      {children}
      {active &&
        createPortal(
          <div id="print-root">
            <QuoteDocument doc={active} />
          </div>,
          document.body,
        )}
    </PrintContext.Provider>
  );
}

export function usePrint(): PrintApi {
  const ctx = useContext(PrintContext);
  if (!ctx) throw new Error('usePrint must be used inside PrintProvider');
  return ctx;
}
