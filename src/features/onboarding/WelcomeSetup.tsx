import { ArrowLeft, ArrowRight, Check, ImageUp, Sparkles, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { defaultBusiness, defaultPricing } from '../../data/defaults';
import { hasExampleAmounts, PRESET_TRADES, starterPreset } from '../../data/presets';
import { CURRENCIES, REGIONS, TRADE_LABELS } from '../../data/regions';
import { newId } from '../../domain/ids';
import { LIMITS } from '../../domain/limits';
import { TRADE_TYPES, type BusinessProfile, type PricingDefaults, type TaxMode, type TradeType } from '../../domain/types';
import { processLogoFile } from '../../io/files';
import { navigate, paths } from '../../state/router';
import { useStore } from '../../state/store';
import { Button } from '../../ui/Button';
import { emailError, MoneyField, PercentField, Segmented, SelectField, TextArea, TextField } from '../../ui/fields';
import { Callout } from '../../ui/layout';
import { BrandMark } from '../shell/BrandMark';

type Step = 'intro' | 'business' | 'pricing';

/**
 * Example pricing for the chosen trade. Money examples are only offered for
 * currencies of a similar magnitude to the demonstration values; otherwise the
 * amounts are left at 0 for the owner to fill in (no exchange rates are assumed).
 */
function examplePricing(trade: TradeType, currency: string): Partial<PricingDefaults> {
  const base = defaultPricing();
  const preset = PRESET_TRADES.includes(trade as (typeof PRESET_TRADES)[number])
    ? starterPreset(trade as (typeof PRESET_TRADES)[number]).pricingExample
    : null;
  const money = hasExampleAmounts(currency);
  return {
    defaultCrewSize: preset?.defaultCrewSize ?? base.defaultCrewSize,
    targetMarginPercent: preset?.targetMarginPercent ?? base.targetMarginPercent,
    laborCostPerHour: money ? (preset?.laborCostPerHour ?? base.laborCostPerHour) : 0,
    minimumCharge: money ? (preset?.minimumCharge ?? base.minimumCharge) : 0,
    overhead: money && preset ? { ...preset.overhead } : { method: 'none', amount: 0 },
  };
}

export function WelcomeSetup() {
  const { actions } = useStore();
  const [step, setStep] = useState<Step>('intro');
  const [business, setBusiness] = useState<BusinessProfile>(() => ({ ...defaultBusiness(), tradeType: 'pressureWashing', region: 'US' }));
  const [pricing, setPricing] = useState<PricingDefaults>(() => ({ ...defaultPricing(), ...examplePricing('pressureWashing', 'USD') }));
  const moneyExamples = hasExampleAmounts(business.currency);
  const [logoError, setLogoError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const setB = (patch: Partial<BusinessProfile>) => setBusiness((b) => ({ ...b, ...patch }));
  const setP = (patch: Partial<PricingDefaults>) => setPricing((p) => ({ ...p, ...patch }));
  const taxRate = pricing.tax.components[0]?.ratePercent ?? 0;
  const taxName = pricing.tax.components[0]?.name ?? 'Tax';

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const finish = () => {
    actions.finishSetup(business, pricing);
    navigate(paths.dashboard);
  };

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome__panel">
        <div className="welcome__brand">
          <BrandMark />
          <span>TradeMaker</span>
        </div>

        {step === 'intro' && (
          <>
            <h1 id="welcome-title" className="welcome__title" tabIndex={-1} ref={headingRef}>
              Quote confidently. Know your costs. Protect your profit.
            </h1>
            <p className="welcome__lead">
              Build professional quotes for pressure washing, painting, window cleaning and landscaping jobs, and see what each job really costs and earns
              before you send it.
            </p>
            <div className="welcome__choices">
              <button type="button" className="choice choice--primary" onClick={() => setStep('business')}>
                <span className="choice__title">Set up my business</span>
                <span className="choice__text">Two quick steps: your details and pricing basics.</span>
                <ArrowRight size={18} aria-hidden className="choice__icon" />
              </button>
              <button
                type="button"
                className="choice"
                onClick={() => {
                  actions.loadDemo();
                  navigate(paths.dashboard);
                }}
              >
                <span className="choice__title">
                  <Sparkles size={16} aria-hidden /> Load demo
                </span>
                <span className="choice__text">Explore with “Evergreen Exterior Care”, a fictional business with sample quotes.</span>
              </button>
              <button
                type="button"
                className="choice"
                onClick={() => {
                  actions.dismissSetup();
                  navigate(paths.data);
                }}
              >
                <span className="choice__title">
                  <Upload size={16} aria-hidden /> Restore a backup
                </span>
                <span className="choice__text">Continue from a JSON backup you exported before.</span>
              </button>
            </div>
            <button type="button" className="link-button welcome__skip" onClick={() => actions.dismissSetup()}>
              Skip for now and go straight to the calculator
            </button>
            <p className="welcome__privacy">
              No account needed. Your data stays in this browser tab and is cleared when you close it — export a backup to keep it.
            </p>
          </>
        )}

        {step === 'business' && (
          <>
            <p className="welcome__step">Step 1 of 2</p>
            <h1 id="welcome-title" className="welcome__title welcome__title--sm" tabIndex={-1} ref={headingRef}>
              Your business
            </h1>
            <div className="grid grid--2">
              <TextField label="Business name" value={business.name} onChange={(name) => setB({ name })} hint="Shown at the top of your quotes." />
              <SelectField
                label="Trade"
                value={business.tradeType}
                onChange={(tradeType) => {
                  setB({ tradeType });
                  setP(examplePricing(tradeType, business.currency));
                }}
                options={TRADE_TYPES.map((t) => ({ value: t, label: TRADE_LABELS[t] }))}
              />
              <SelectField
                label="Country or region"
                value={business.region || 'OTHER'}
                onChange={(code) => {
                  const r = REGIONS.find((x) => x.code === code);
                  if (r) {
                    setB({ region: r.code, currency: r.currency, locale: r.locale, dateFormat: r.dateFormat });
                    setP(examplePricing(business.tradeType, r.currency));
                  }
                }}
                options={REGIONS.map((r) => ({ value: r.code, label: r.label }))}
              />
              <SelectField
                label="Currency"
                value={business.currency}
                onChange={(currency) => {
                  setB({ currency });
                  setP(examplePricing(business.tradeType, currency));
                }}
                options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.label}` }))}
              />
              <TextField label="Business email" type="email" value={business.email} onChange={(email) => setB({ email })} error={emailError(business.email)} maxLength={254} />
              <TextField label="Phone" type="tel" value={business.phone} onChange={(phone) => setB({ phone })} maxLength={60} />
              <TextField label="Website" type="url" value={business.website} onChange={(website) => setB({ website })} optional />
              <div className="field">
                <span className="field__label">
                  Logo <span className="field__optional">(optional)</span>
                </span>
                <div className="button-row">
                  <label className="btn btn--secondary btn--sm file-btn">
                    <ImageUp size={15} aria-hidden />
                    {business.logoDataUrl ? 'Replace logo' : 'Upload logo'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        const r = await processLogoFile(file);
                        if (r.ok) {
                          setLogoError(null);
                          setB({ logoDataUrl: r.dataUrl });
                        } else setLogoError(r.error);
                      }}
                    />
                  </label>
                  {business.logoDataUrl && <img src={business.logoDataUrl} alt="Logo preview" className="welcome__logo" />}
                </div>
                {logoError && (
                  <p className="field__error" role="alert">
                    {logoError}
                  </p>
                )}
              </div>
            </div>
            <TextArea label="Address" value={business.address} onChange={(address) => setB({ address })} rows={2} optional maxLength={1000} />
            <div className="welcome__nav">
              <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep('intro')}>
                Back
              </Button>
              <Button variant="primary" onClick={() => setStep('pricing')}>
                Next: pricing basics
              </Button>
            </div>
          </>
        )}

        {step === 'pricing' && (
          <>
            <p className="welcome__step">Step 2 of 2</p>
            <h1 id="welcome-title" className="welcome__title welcome__title--sm" tabIndex={-1} ref={headingRef}>
              Pricing basics
            </h1>
            <Callout tone="neutral" compact>
              {moneyExamples
                ? `Pre-filled with example values for ${TRADE_LABELS[business.tradeType].toLowerCase()} — demonstration numbers, not market rates. Replace them with your own; you can change everything later in Pricing settings.`
                : `Enter your own amounts in ${business.currency}. Example amounts are only offered for a few currencies, so they're left blank here — the margin target is an example you can change.`}
            </Callout>
            <div className="grid grid--2">
              <MoneyField
                label="Labor cost per hour"
                value={pricing.laborCostPerHour}
                onChange={(laborCostPerHour) => setP({ laborCostPerHour })}
                locale={business.locale}
                currency={business.currency}
                hint={
                  pricing.laborCostPerHour > 0
                    ? 'Wages plus payroll taxes and insurance for one worker-hour (not your billing rate).'
                    : 'Enter what one worker-hour costs you, including payroll taxes and insurance.'
                }
              />
              <PercentField
                label="Target gross margin"
                value={pricing.targetMarginPercent}
                onChange={(targetMarginPercent) => setP({ targetMarginPercent })}
                locale={business.locale}
                max={LIMITS.targetMargin.max}
                maxMessage="A margin of 100% or more is impossible."
                hint="Profit as a share of the price, after costs and overhead."
              />
              <MoneyField
                label="Minimum job charge"
                value={pricing.minimumCharge}
                onChange={(minimumCharge) => setP({ minimumCharge })}
                locale={business.locale}
                currency={business.currency}
                hint="0 = no minimum."
              />
            </div>
            <Segmented
              label="Tax"
              value={pricing.tax.mode}
              onChange={(mode: TaxMode) => setP({ tax: { ...pricing.tax, mode } })}
              options={[
                { value: 'none', label: 'No tax' },
                { value: 'exclusive', label: 'Add tax to prices' },
                { value: 'inclusive', label: 'Prices include tax' },
              ]}
            />
            {pricing.tax.mode !== 'none' && (
              <div className="grid grid--2">
                <TextField
                  label="Tax name"
                  value={taxName}
                  onChange={(name) => setP({ tax: { ...pricing.tax, components: [{ id: pricing.tax.components[0]?.id ?? newId('tax'), name, ratePercent: taxRate }] } })}
                  placeholder="e.g. Sales tax, GST, VAT"
                  maxLength={60}
                />
                <PercentField
                  label="Default tax rate"
                  value={taxRate}
                  onChange={(ratePercent) => setP({ tax: { ...pricing.tax, components: [{ id: pricing.tax.components[0]?.id ?? newId('tax'), name: taxName, ratePercent }] } })}
                  locale={business.locale}
                  hint="Confirm the correct rate for your location — tax rules vary."
                />
              </div>
            )}
            <div className="welcome__nav">
              <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep('business')}>
                Back
              </Button>
              <Button variant="primary" icon={Check} onClick={finish}>
                Finish setup
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
