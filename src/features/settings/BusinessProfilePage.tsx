import { ImageUp, Trash } from 'lucide-react';
import { useState } from 'react';
import { DEFAULT_BRAND_COLOR } from '../../data/defaults';
import { CURRENCIES, LOCALES, REGIONS, TRADE_LABELS, paperForLocale } from '../../data/regions';
import { contrastText } from '../../domain/customerDocument';
import { TRADE_TYPES, type BusinessProfile } from '../../domain/types';
import { formatDate, formatMoney } from '../../format/format';
import { MAX_LOGO_FILE_BYTES, processLogoFile } from '../../io/files';
import { useStore } from '../../state/store';
import { Button } from '../../ui/Button';
import { useFeedback } from '../../ui/feedback';
import { emailError, SelectField, TextArea, TextField } from '../../ui/fields';
import { Callout, Card, PageHeader } from '../../ui/layout';

const SWATCHES = ['#16845B', '#123D2B', '#1F6F8B', '#2E4A7D', '#7A3E9D', '#B5462F', '#C27C0E', '#3B3F45'];

export function BusinessProfilePage() {
  const { state, actions } = useStore();
  const { toast } = useFeedback();
  const b = state.business;
  const set = (patch: Partial<BusinessProfile>) => actions.updateBusiness(patch);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const contrastOk = contrastText(b.brandColor) === '#FFFFFF';
  const ctx = { locale: b.locale, currency: b.currency, dateFormat: b.dateFormat };

  return (
    <div className="page page--narrow">
      <PageHeader
        title="Business profile"
        subtitle="Your details and branding appear on every customer quote. Changes apply immediately to previews and exports."
      />
      {state.isSampleSession && (
        <Callout tone="info" compact>
          You're editing the fictional demo business. Clear the session or complete setup to use your own details.
        </Callout>
      )}

      <Card title="Business details">
        <div className="grid grid--2">
          <TextField
            label="Business name"
            value={b.name}
            onChange={(name) => set({ name })}
            error={b.name.trim() ? null : 'Add your business name — it is the heading of every quote.'}
          />
          <SelectField
            label="Main trade"
            value={b.tradeType}
            onChange={(tradeType) => set({ tradeType })}
            options={TRADE_TYPES.map((t) => ({ value: t, label: TRADE_LABELS[t] }))}
            hint="Used as the default job category and item library."
          />
          <TextField label="Email" type="email" value={b.email} onChange={(email) => set({ email })} error={emailError(b.email)} maxLength={254} />
          <TextField label="Phone" type="tel" value={b.phone} onChange={(phone) => set({ phone })} maxLength={60} />
          <TextField label="Website" type="url" value={b.website} onChange={(website) => set({ website })} placeholder="example.com" optional />
        </div>
        <TextArea label="Address" value={b.address} onChange={(address) => set({ address })} rows={3} maxLength={1000} optional />
      </Card>

      <Card title="Branding" subtitle="Applies to all quotes, including existing ones.">
        <div className="brand-grid">
          <div className="field">
            <span className="field__label">Logo</span>
            <div className="logo-box">
              {b.logoDataUrl ? <img src={b.logoDataUrl} alt="Current logo" className="logo-box__img" /> : <span className="muted small">No logo</span>}
            </div>
            <div className="button-row">
              <label className={`btn btn--secondary btn--sm file-btn ${busy ? 'is-disabled' : ''}`}>
                <ImageUp size={15} aria-hidden />
                {b.logoDataUrl ? 'Replace logo' : 'Upload logo'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={busy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    setBusy(true);
                    const result = await processLogoFile(file);
                    setBusy(false);
                    if (result.ok) {
                      setLogoError(null);
                      set({ logoDataUrl: result.dataUrl });
                      toast({ message: 'Logo updated.', tone: 'success' });
                    } else setLogoError(result.error);
                  }}
                />
              </label>
              {b.logoDataUrl && (
                <Button size="sm" variant="ghost" icon={Trash} onClick={() => set({ logoDataUrl: null })}>
                  Remove
                </Button>
              )}
            </div>
            {logoError ? (
              <p className="field__error" role="alert">
                {logoError}
              </p>
            ) : (
              <p className="field__hint">
                PNG, JPEG or WebP up to {MAX_LOGO_FILE_BYTES / 1024 / 1024} MB. Resized in your browser; never uploaded.
              </p>
            )}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="profile-brand">
              Brand colour
            </label>
            <div className="color-input">
              <input id="profile-brand" type="color" value={b.brandColor} onChange={(e) => set({ brandColor: e.target.value.toUpperCase() })} />
              <span className="num">{b.brandColor}</span>
              {b.brandColor !== DEFAULT_BRAND_COLOR && (
                <button type="button" className="link-button" onClick={() => set({ brandColor: DEFAULT_BRAND_COLOR })}>
                  Reset
                </button>
              )}
            </div>
            <div className="swatches" role="group" aria-label="Suggested colours">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`swatch ${b.brandColor.toUpperCase() === c ? 'is-active' : ''}`}
                  style={{ background: c }}
                  aria-label={`Use colour ${c}`}
                  aria-pressed={b.brandColor.toUpperCase() === c}
                  onClick={() => set({ brandColor: c })}
                />
              ))}
            </div>
            {!contrastOk && <p className="field__hint">This colour is light; headings will use dark text for readability.</p>}
          </div>
        </div>
        <TextArea
          label="Quote footer"
          value={b.quoteFooter}
          onChange={(quoteFooter) => set({ quoteFooter })}
          rows={2}
          maxLength={1000}
          hint="Printed at the bottom of every quote — e.g. licence or insurance details, a thank-you."
        />
      </Card>

      <Card title="Region & formats" subtitle="New quotes use this currency. Existing quotes keep the currency they were created with.">
        <div className="grid grid--2">
          <SelectField
            label="Country or region"
            value={REGIONS.some((r) => r.code === b.region) ? b.region : 'OTHER'}
            onChange={(code) => {
              const r = REGIONS.find((x) => x.code === code);
              if (r) set({ region: r.code, currency: r.currency, locale: r.locale, dateFormat: r.dateFormat });
            }}
            options={REGIONS.map((r) => ({ value: r.code, label: r.label }))}
            hint="Suggests a currency, number and date format. No tax rates are assumed."
          />
          <SelectField
            label="Currency"
            value={b.currency}
            onChange={(currency) => set({ currency })}
            options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.label}` }))}
          />
          <SelectField
            label="Number format (locale)"
            value={LOCALES.some((l) => l.code === b.locale) ? b.locale : 'en-US'}
            onChange={(locale) => set({ locale })}
            options={LOCALES.map((l) => ({ value: l.code, label: l.label }))}
            hint={`Example: ${formatMoney(123456789, ctx)}`}
          />
          <SelectField
            label="Date format"
            value={b.dateFormat}
            onChange={(dateFormat) => set({ dateFormat })}
            options={[
              { value: 'locale', label: `Locale style (${formatDate('2026-03-09', { ...ctx, dateFormat: 'locale' })})` },
              { value: 'dmy', label: 'DD/MM/YYYY' },
              { value: 'mdy', label: 'MM/DD/YYYY' },
              { value: 'ymd', label: 'YYYY-MM-DD' },
            ]}
          />
          <SelectField
            label="Paper size"
            value={b.paperSize}
            onChange={(paperSize) => set({ paperSize })}
            options={[
              { value: 'auto', label: `Automatic (${paperForLocale(b.locale) === 'letter' ? 'US Letter' : 'A4'} for this locale)` },
              { value: 'a4', label: 'A4' },
              { value: 'letter', label: 'US Letter' },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}
