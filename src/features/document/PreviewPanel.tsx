import { Download, ImageUp, Palette, Printer, Trash, ZoomIn, ZoomOut } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { CustomerDocument } from '../../domain/customerDocument';
import type { QuoteDisplayOptions } from '../../domain/types';
import { processLogoFile } from '../../io/files';
import { paths } from '../../state/router';
import { useStore } from '../../state/store';
import { Button } from '../../ui/Button';
import { useFeedback } from '../../ui/feedback';
import { Checkbox, TextArea, TextField } from '../../ui/fields';
import { QuoteDocument } from './QuoteDocument';

const PAGE_WIDTH = { a4: 794, letter: 816 } as const;

/** Renders the document at true page width, scaled down to fit its container (or at 100% with scrolling). */
export function ScaledDocument({ doc, fit = true }: { doc: CustomerDocument; fit?: boolean }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const pageWidth = PAGE_WIDTH[doc.paperSize];

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      const s = fit && o.clientWidth > 0 ? Math.min(1, o.clientWidth / pageWidth) : 1;
      setScale(s);
      setHeight(i.offsetHeight * s);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [pageWidth, fit]);

  return (
    <div className={`scaled-doc ${fit ? '' : 'scaled-doc--actual'}`} ref={outer} style={{ height: fit ? height : undefined }}>
      <div className="scaled-doc__page" ref={inner} style={{ width: pageWidth, transform: `scale(${scale})` }}>
        <QuoteDocument doc={doc} />
      </div>
    </div>
  );
}

const TOGGLES: { key: keyof Omit<QuoteDisplayOptions, 'documentTitle'>; label: string }[] = [
  { key: 'showScope', label: 'Scope of work' },
  { key: 'showLineDescriptions', label: 'Item descriptions' },
  { key: 'showQuantities', label: 'Quantities & unit prices' },
  { key: 'showTaxBreakdown', label: 'Tax breakdown' },
  { key: 'showPaymentTerms', label: 'Payment terms' },
  { key: 'showExclusions', label: 'Exclusions' },
  { key: 'showNotes', label: 'Customer notes' },
  { key: 'showAcceptance', label: 'Acceptance & validity' },
  { key: 'showSignature', label: 'Signature area' },
];

export function PreviewPanel({
  doc,
  display,
  onDisplayChange,
  onPrint,
  onPdf,
  extraWarning,
}: {
  doc: CustomerDocument;
  display: QuoteDisplayOptions;
  onDisplayChange: (patch: Partial<QuoteDisplayOptions>) => void;
  onPrint: () => void;
  onPdf: () => Promise<void> | void;
  extraWarning?: ReactNode;
}) {
  const [customize, setCustomize] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [fit, setFit] = useState(true);
  return (
    <section className="preview" aria-labelledby="preview-title">
      <header className="preview__toolbar">
        <div>
          <h2 id="preview-title" className="preview__title">
            Customer preview
          </h2>
          <p className="preview__sub">Exactly what your customer receives · {doc.paperSize === 'letter' ? 'US Letter' : 'A4'}</p>
        </div>
        <div className="preview__actions">
          <Button size="sm" variant="ghost" icon={fit ? ZoomIn : ZoomOut} aria-pressed={!fit} onClick={() => setFit(!fit)}>
            {fit ? '100%' : 'Fit'}
            <span className="sr-only">{fit ? ' — show the page at actual size' : ' — fit the page to the panel'}</span>
          </Button>
          <Button size="sm" variant="ghost" icon={Palette} aria-expanded={customize} onClick={() => setCustomize(!customize)}>
            Customize
          </Button>
          <Button size="sm" icon={Printer} onClick={onPrint}>
            Print
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={Download}
            disabled={pdfBusy}
            onClick={async () => {
              setPdfBusy(true);
              try {
                await onPdf();
              } finally {
                setPdfBusy(false);
              }
            }}
          >
            {pdfBusy ? 'Creating…' : 'PDF'}
          </Button>
        </div>
      </header>
      {customize && <CustomizePanel display={display} onDisplayChange={onDisplayChange} />}
      {extraWarning}
      <div className={`preview__stage ${fit ? '' : 'preview__stage--scroll'}`}>
        <ScaledDocument doc={doc} fit={fit} />
      </div>
    </section>
  );
}

function CustomizePanel({ display, onDisplayChange }: { display: QuoteDisplayOptions; onDisplayChange: (patch: Partial<QuoteDisplayOptions>) => void }) {
  const { state, actions } = useStore();
  const { toast } = useFeedback();
  const b = state.business;
  return (
    <div className="customize">
      <div className="customize__group">
        <h3 className="customize__title">This quote</h3>
        <TextField label="Document title" value={display.documentTitle} onChange={(documentTitle) => onDisplayChange({ documentTitle })} maxLength={40} hint="e.g. Quote, Estimate, Proposal" />
        <div className="customize__toggles">
          {TOGGLES.map((t) => (
            <Checkbox key={t.key} label={t.label} checked={display[t.key]} onChange={(v) => onDisplayChange({ [t.key]: v })} />
          ))}
        </div>
      </div>
      <div className="customize__group">
        <h3 className="customize__title">
          Branding <span className="muted">— applies to all quotes</span>
        </h3>
        <div className="customize__brand">
          <div className="field">
            <label className="field__label" htmlFor="brand-color">
              Brand colour
            </label>
            <div className="color-input">
              <input id="brand-color" type="color" value={b.brandColor} onChange={(e) => actions.updateBusiness({ brandColor: e.target.value.toUpperCase() })} />
              <span className="num">{b.brandColor}</span>
            </div>
          </div>
          <div className="field">
            <span className="field__label">Logo</span>
            <div className="customize__logo">
              <label className="btn btn--secondary btn--sm file-btn">
                <ImageUp size={15} aria-hidden />
                {b.logoDataUrl ? 'Replace' : 'Upload'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    const result = await processLogoFile(file);
                    if (result.ok) {
                      actions.updateBusiness({ logoDataUrl: result.dataUrl });
                      toast({ message: 'Logo updated.', tone: 'success' });
                    } else toast({ message: result.error, tone: 'danger' });
                  }}
                />
              </label>
              {b.logoDataUrl && (
                <Button size="sm" variant="ghost" icon={Trash} onClick={() => actions.updateBusiness({ logoDataUrl: null })}>
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>
        <TextArea label="Footer text" value={b.quoteFooter} onChange={(quoteFooter) => actions.updateBusiness({ quoteFooter })} rows={2} maxLength={1000} />
        <p className="muted small">
          Payment terms and validity are set per quote in the editor; defaults live in <a href={paths.pricing}>Pricing settings</a>. More branding in{' '}
          <a href={paths.business}>Business profile</a>.
        </p>
      </div>
    </div>
  );
}
