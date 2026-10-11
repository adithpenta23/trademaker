import { newId } from '../domain/ids';
import type { BusinessProfile, PricingDefaults, QuoteDisplayOptions } from '../domain/types';

export const DEFAULT_BRAND_COLOR = '#16845B';

export function defaultBusiness(): BusinessProfile {
  return {
    name: '',
    tradeType: 'other',
    region: '',
    currency: 'USD',
    locale: 'en-US',
    dateFormat: 'locale',
    email: '',
    phone: '',
    website: '',
    address: '',
    logoDataUrl: null,
    brandColor: DEFAULT_BRAND_COLOR,
    quoteFooter: 'Thank you for the opportunity to quote for your project.',
    paperSize: 'auto',
  };
}

/**
 * Starting values so the calculator works immediately. They are placeholders,
 * not recommendations — the UI asks the owner to replace them.
 */
export function defaultPricing(): PricingDefaults {
  return {
    laborCostPerHour: 30,
    laborRateBasis: 'burdened',
    defaultCrewSize: 1,
    pricingMode: 'manual',
    targetMarginPercent: 40,
    markupPercent: 50,
    minimumMarginPercent: 15,
    minimumCharge: 0,
    minimumChargeBasis: 'afterDiscount',
    overhead: { method: 'none', amount: 0 },
    defaultTravelCharge: 0,
    tax: {
      mode: 'none',
      components: [{ id: newId('tax'), name: 'Tax', ratePercent: 0 }],
      compounding: 'independent',
    },
    defaultDiscountType: 'percent',
    discountWarningPercent: 15,
    deposit: { type: 'none', value: 0 },
    validityDays: 30,
    paymentTerms: 'Payment is due on completion of the work.',
    acceptanceInstructions:
      'To accept this quote, sign and date below and return a copy to us, or reply to confirm in writing. We will then contact you to schedule the work.',
    documentTitle: 'Quote',
    quoteNumberPrefix: 'Q-',
    nextQuoteNumber: 1001,
  };
}

export function defaultDisplayOptions(documentTitle = 'Quote'): QuoteDisplayOptions {
  return {
    documentTitle,
    showScope: true,
    showLineDescriptions: true,
    showQuantities: true,
    showExclusions: true,
    showNotes: true,
    showPaymentTerms: true,
    showAcceptance: true,
    showSignature: true,
    showTaxBreakdown: true,
  };
}
