/**
 * Demo session for the fictional "Evergreen Exterior Care". Every quote is
 * flagged `isSample` and the UI labels it as sample data. Customers, prices
 * and costs are invented for demonstration and are not real business results.
 */
import { addDays, toISODate } from '../domain/dates';
import { newId } from '../domain/ids';
import { createLineItem, quotePricingFromDefaults } from '../domain/quoteFactory';
import type { BusinessProfile, LineCosts, LineItem, PricingDefaults, Quote, QuoteTemplate, SessionData } from '../domain/types';
import { defaultDisplayOptions } from './defaults';
import { starterPresets } from './presets';
import { starterTemplates } from './templates';

type LineDef = Partial<Omit<LineItem, 'costs'>> & { costs?: Partial<LineCosts> };
const L = (def: LineDef): LineItem => {
  const { costs, ...rest } = def;
  const base = createLineItem({ autoPrice: false, ...rest }, 1);
  return { ...base, costs: { ...base.costs, ...costs } };
};

export function demoBusiness(): BusinessProfile {
  return {
    name: 'Evergreen Exterior Care',
    tradeType: 'pressureWashing',
    region: 'US',
    currency: 'USD',
    locale: 'en-US',
    dateFormat: 'locale',
    email: 'hello@evergreen-exterior.example',
    phone: '(555) 014-2290',
    website: 'evergreen-exterior.example',
    address: '1820 Alder Way\nSpringfield',
    logoDataUrl: null,
    brandColor: '#16845B',
    quoteFooter: 'Evergreen Exterior Care · Fully insured exterior cleaning and garden care · Thank you for choosing a local business.',
    paperSize: 'auto',
  };
}

export function demoPricing(): PricingDefaults {
  return {
    laborCostPerHour: 30,
    laborRateBasis: 'burdened',
    defaultCrewSize: 2,
    pricingMode: 'manual',
    targetMarginPercent: 45,
    markupPercent: 60,
    minimumMarginPercent: 20,
    minimumCharge: 175,
    minimumChargeBasis: 'afterDiscount',
    overhead: { method: 'perLaborHour', amount: 9 },
    defaultTravelCharge: 0,
    tax: {
      mode: 'exclusive',
      compounding: 'independent',
      components: [{ id: newId('tax'), name: 'Sales tax (example rate)', ratePercent: 7 }],
    },
    defaultDiscountType: 'percent',
    discountWarningPercent: 15,
    deposit: { type: 'none', value: 0 },
    validityDays: 30,
    paymentTerms: 'Payment due on completion by card, bank transfer or check.',
    acceptanceInstructions: 'To accept, sign below and return a copy, or reply to this quote by email. We will confirm your booking within one business day.',
    documentTitle: 'Quote',
    quoteNumberPrefix: 'EEC-',
    nextQuoteNumber: 1007,
  };
}

export function demoSession(now: Date): SessionData {
  const business = demoBusiness();
  const pricing = demoPricing();
  const today = toISODate(now);

  const base = (n: number, daysAgo: number, partial: Partial<Quote>): Quote => {
    const created = addDays(today, -daysAgo);
    const stamp = new Date(now.getTime() - daysAgo * 86_400_000 - n * 60_000).toISOString();
    return {
      id: newId('q'),
      number: `EEC-${1000 + n}`,
      title: '',
      createdDate: created,
      validityDays: pricing.validityDays,
      expiryDate: null,
      jobDate: null,
      duration: '',
      tradeType: 'pressureWashing',
      currency: business.currency,
      customer: { name: '', company: '', email: '', phone: '', billingAddress: '', serviceAddress: '', locationNotes: '' },
      scopeOfWork: '',
      exclusions: '',
      customerNotes: '',
      internalNotes: '',
      paymentTerms: pricing.paymentTerms,
      acceptanceInstructions: pricing.acceptanceInstructions,
      lineItems: [],
      jobCosts: [],
      extraLaborHours: 0,
      extraLaborCrew: 2,
      pricing: quotePricingFromDefaults(pricing),
      discount: { type: 'none', value: 0, reason: '' },
      deposit: { type: 'none', value: 0 },
      tax: { ...pricing.tax, components: pricing.tax.components.map((c) => ({ ...c, id: newId('tax') })) },
      display: defaultDisplayOptions(pricing.documentTitle),
      sourceTemplateId: null,
      isSample: true,
      createdAt: stamp,
      updatedAt: stamp,
      ...partial,
    };
  };

  const quotes: Quote[] = [
    base(6, 0, {
      title: 'Roof moss treatment',
      customer: { name: 'Elena Fischer', company: '', email: 'elena.fischer@example.com', phone: '(555) 014-7781', billingAddress: '77 Brookside Court\nSpringfield', serviceAddress: '77 Brookside Court\nSpringfield', locationNotes: 'Steep pitch on north side — bring roof anchors.' },
      scopeOfWork: 'Low-pressure soft-wash treatment of moss and lichen on the asphalt-shingle roof, with rinse of gutters and downpipes.',
      internalNotes: 'Priced to match a competitor quote. Check the margin before sending.',
      jobDate: addDays(today, 12),
      duration: 'Half a day',
      lineItems: [
        L({ name: 'Roof soft wash — moss and lichen treatment', description: 'Biodegradable treatment applied at low pressure; dead growth weathers off over the following weeks.', unit: 'each', quantity: 1, unitPrice: 250, costs: { laborHours: 4, crewSize: 2, materials: 65, equipment: 40 } }),
      ],
    }),
    base(5, 1, {
      title: 'Small patio clean',
      customer: { name: 'Front desk', company: 'Hillcrest Dental Studio', email: 'office@hillcrest-dental.example', phone: '(555) 014-3100', billingAddress: '400 Market Street, Suite 2\nSpringfield', serviceAddress: '400 Market Street (rear patio)\nSpringfield', locationNotes: 'Work before 8am or after 5pm only.' },
      scopeOfWork: 'Pressure clean the rear staff patio and entrance step.',
      duration: '1 hour',
      lineItems: [
        L({ name: 'Patio cleaning', description: 'Pressure clean of concrete patio and entrance step.', unit: 'sqft', quantity: 120, unitPrice: 0.35, costs: { unitCost: 0.03, laborHours: 1.25, crewSize: 1 } }),
      ],
    }),
    base(4, 3, {
      title: 'Deck and fence restoration',
      customer: { name: 'Sam Ortega', company: '', email: 'sam.ortega@example.com', phone: '(555) 014-5562', billingAddress: '12 Willow Lane\nSpringfield', serviceAddress: '12 Willow Lane\nSpringfield', locationNotes: 'Dog in back yard — call ahead.' },
      scopeOfWork: 'Clean and brighten the rear deck, wash the perimeter fence, and apply a semi-transparent stain to the deck boards and railings.',
      exclusions: 'Board replacement and structural repairs are not included.',
      discount: { type: 'percent', value: 10, reason: 'Spring booking discount' },
      deposit: { type: 'percent', value: 30 },
      jobDate: addDays(today, 20),
      duration: '2 days',
      lineItems: [
        L({ name: 'Deck cleaning and brightening', description: 'Wood-safe clean and brightener for a 400 sq ft deck.', unit: 'sqft', quantity: 400, unitPrice: 0.6, costs: { unitCost: 0.05, laborHours: 2.5, crewSize: 1, materials: 20 } }),
        L({ name: 'Fence cleaning', description: 'Low-pressure wash of the cedar fence, both sides.', unit: 'lft', quantity: 150, unitPrice: 2.5, costs: { unitCost: 0.15, laborHours: 3, crewSize: 1 } }),
        L({ name: 'Deck staining', description: 'One coat of semi-transparent stain to deck boards and railings.', unit: 'sqft', quantity: 400, unitPrice: 1.1, costs: { laborHours: 6, crewSize: 2, materials: 140 } }),
      ],
    }),
    base(3, 5, {
      title: 'Spring garden cleanup and mulch',
      tradeType: 'landscaping',
      customer: { name: 'Marcus Bell', company: '', email: 'marcus.bell@example.com', phone: '', billingAddress: '5 Orchard Rise\nSpringfield', serviceAddress: '5 Orchard Rise\nSpringfield', locationNotes: '' },
      scopeOfWork: 'Full spring cleanup of front and rear beds, hedge trim along the driveway, fresh mulch to all beds and removal of green waste.',
      pricing: { ...quotePricingFromDefaults(pricing), mode: 'targetMargin' },
      deposit: { type: 'percent', value: 25 },
      duration: '1–2 days',
      lineItems: [
        L({ name: 'Garden cleanup', description: 'Weeding, pruning and leaf removal in all beds.', category: 'labor', unit: 'hour', quantity: 6, autoPrice: true, costs: { laborHours: 1, laborPerUnit: true, crewSize: 1 } }),
        L({ name: 'Hedge trimming', description: 'Trim the driveway hedge to shape and height; clippings collected.', unit: 'lft', quantity: 80, autoPrice: true, costs: { laborHours: 3, crewSize: 1 } }),
        L({ name: 'Mulch installation', description: 'Spread hardwood mulch to an even 3-inch depth.', unit: 'custom', customUnit: 'cu yd', quantity: 5, autoPrice: true, costs: { laborHours: 1.25, laborPerUnit: true, crewSize: 1 } }),
        L({ name: 'Mulch (materials)', description: 'Premium hardwood mulch, delivered.', category: 'materials', unit: 'custom', customUnit: 'cu yd', quantity: 5, autoPrice: true, costs: { unitCost: 34 } }),
        L({ name: 'Green-waste disposal', description: 'Removal and tipping of all green waste.', category: 'disposal', unit: 'load', quantity: 1, autoPrice: true, costs: { unitCost: 45, travel: 10 } }),
      ],
    }),
    base(2, 6, {
      title: 'Two-story window cleaning',
      tradeType: 'windowCleaning',
      customer: { name: 'Priya Natarajan', company: '', email: 'priya.n@example.com', phone: '(555) 014-8820', billingAddress: '230 Ridgeview Drive\nSpringfield', serviceAddress: '230 Ridgeview Drive\nSpringfield', locationNotes: '' },
      scopeOfWork: 'Interior and exterior cleaning of all windows on a two-story home, plus screen cleaning.',
      duration: 'Most of a day',
      lineItems: [
        L({ name: 'Exterior window cleaning', description: 'Pure-water pole system on upper floor.', unit: 'each', quantity: 32, unitPrice: 6, costs: { laborHours: 0.1, laborPerUnit: true, crewSize: 1, materials: 5 } }),
        L({ name: 'Interior window cleaning', description: 'Glass cleaned, sills wiped, floors protected.', unit: 'each', quantity: 32, unitPrice: 5, costs: { laborHours: 0.12, laborPerUnit: true, crewSize: 1 } }),
        L({ name: 'Screen cleaning', description: 'Screens removed, washed and refitted.', unit: 'each', quantity: 20, unitPrice: 3, costs: { laborHours: 0.05, laborPerUnit: true, crewSize: 1 } }),
        L({ name: 'Additional-story surcharge', description: 'Ladder work for second-story windows.', unit: 'custom', customUnit: 'story', quantity: 1, unitPrice: 45, costs: { laborHours: 0.5, crewSize: 1, equipment: 10 } }),
      ],
    }),
    base(1, 9, {
      title: 'Exterior house wash and driveway',
      customer: { name: 'Jordan Avery', company: '', email: 'jordan.avery@example.com', phone: '(555) 014-2047', billingAddress: '48 Maple Street\nSpringfield', serviceAddress: '48 Maple Street\nSpringfield', locationNotes: 'Outdoor tap on east wall.' },
      scopeOfWork: 'Soft wash of all exterior siding, soffits and fascia; surface-clean the driveway; brighten the outside faces of the gutters.',
      exclusions: 'Window glass is rinsed but not detailed. Rust and oil staining may not fully lift.',
      customerNotes: 'Please close all windows and move vehicles off the driveway before we arrive.',
      jobDate: addDays(today, 5),
      duration: '1 day',
      lineItems: [
        L({ name: 'House washing (soft wash)', description: 'Low-pressure wash of siding, soffits and fascia, including rinse of landscaping.', unit: 'each', quantity: 1, unitPrice: 495, costs: { laborHours: 3, crewSize: 2, materials: 40, equipment: 25 } }),
        L({ name: 'Driveway cleaning', description: 'Surface-cleaner wash with stain pre-treatment.', unit: 'sqft', quantity: 650, unitPrice: 0.28, costs: { unitCost: 0.02, laborHours: 1.5, crewSize: 1, equipment: 15 } }),
        L({ name: 'Gutter face brightening', description: 'Removal of black streaking from the outside of the gutters.', unit: 'lft', quantity: 140, unitPrice: 1.25, costs: { laborHours: 1.5, crewSize: 1, materials: 12 } }),
      ],
    }),
  ];

  const seasonal: QuoteTemplate = {
    id: newId('tpl'),
    name: 'Evergreen — seasonal exterior refresh',
    description: 'House wash plus driveway and windows; the most-requested Evergreen package (sample).',
    kind: 'custom',
    tradeType: 'pressureWashing',
    isStarter: false,
    title: 'Seasonal exterior refresh',
    scopeOfWork: 'Soft wash of exterior siding, surface-clean of the driveway and exterior window rinse.',
    exclusions: '',
    customerNotes: '',
    paymentTerms: '',
    deposit: null,
    jobCosts: [],
    lineItems: [
      L({ name: 'House washing (soft wash)', description: 'Low-pressure wash of siding, soffits and fascia.', unit: 'each', quantity: 1, unitPrice: 495, costs: { laborHours: 3, crewSize: 2, materials: 40, equipment: 25 } }),
      L({ name: 'Driveway cleaning', description: 'Surface-cleaner wash with stain pre-treatment.', unit: 'sqft', quantity: 600, unitPrice: 0.28, costs: { unitCost: 0.02, laborHours: 1.5, crewSize: 1, equipment: 15 } }),
      L({ name: 'Exterior window rinse', description: 'Pure-water rinse of exterior glass.', unit: 'each', quantity: 20, unitPrice: 4, costs: { laborHours: 0.08, laborPerUnit: true, crewSize: 1 } }),
    ],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  return {
    business,
    pricing,
    quotes,
    templates: [...starterTemplates(), seasonal],
    presets: starterPresets(),
    isSampleSession: true,
  };
}
