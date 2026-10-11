/**
 * The three starter quote templates. They are fully editable; "Reset starter
 * templates" restores these original definitions. Prices are demonstration
 * values, not market rates.
 */
import { createLineItem } from '../domain/quoteFactory';
import type { LineItem, QuoteTemplate } from '../domain/types';

export const STARTER_TEMPLATE_IDS = {
  standard: 'tpl_starter_standard',
  detailed: 'tpl_starter_detailed',
  premium: 'tpl_starter_premium',
} as const;

const EPOCH = '2026-01-01T00:00:00.000Z';

type L = Parameters<typeof createLineItem>[0];
const lines = (defs: L[]): LineItem[] => defs.map((d) => createLineItem({ autoPrice: false, ...d }));

export function starterTemplates(): QuoteTemplate[] {
  return [
    {
      id: STARTER_TEMPLATE_IDS.standard,
      name: 'Standard Service',
      description: 'For ordinary one-off jobs: a short scope, one or two service lines and standard terms.',
      kind: 'standard',
      tradeType: 'pressureWashing',
      isStarter: true,
      title: 'Driveway and path cleaning',
      scopeOfWork:
        'Pre-treat stains, then surface-clean the concrete driveway and front path. Rinse surrounding areas and leave the site tidy.',
      exclusions: 'Removal of rust, paint or deep oil stains is not guaranteed.',
      customerNotes: 'Please move vehicles off the driveway before we arrive.',
      paymentTerms: '',
      deposit: { type: 'none', value: 0 },
      jobCosts: [],
      lineItems: lines([
        {
          name: 'Driveway cleaning',
          description: 'Surface-cleaner wash of concrete driveway with stain pre-treatment.',
          unit: 'sqft',
          quantity: 600,
          unitPrice: 0.25,
          costs: { unitCost: 0.02, laborHours: 1.5, laborPerUnit: false, crewSize: 1, materials: 0, equipment: 15, travel: 0, other: 0 },
        },
        {
          name: 'Front path cleaning',
          description: 'Pressure clean of front path and steps.',
          unit: 'sqft',
          quantity: 120,
          unitPrice: 0.35,
          costs: { unitCost: 0.02, laborHours: 0.5, laborPerUnit: false, crewSize: 1, materials: 0, equipment: 0, travel: 0, other: 0 },
        },
      ]),
      createdAt: EPOCH,
      updatedAt: EPOCH,
    },
    {
      id: STARTER_TEMPLATE_IDS.detailed,
      name: 'Detailed Project',
      description: 'For painting, landscaping installations and larger jobs: labor, materials, equipment, prep, milestones and a deposit.',
      kind: 'detailed',
      tradeType: 'painting',
      isStarter: true,
      title: 'Exterior repaint',
      scopeOfWork:
        'Prepare and repaint the exterior siding and trim of the house.\n\n• Wash down all surfaces to be painted\n• Scrape and sand loose or flaking paint\n• Fill and caulk gaps and cracks\n• Spot-prime bare timber\n• Apply two finish coats to siding and one to trim\n• Clean up and remove all project waste',
      exclusions:
        'Repairs to rotten timber beyond minor filling are not included and will be quoted separately if found.\nWindows, doors and decks are not included unless listed above.',
      customerNotes:
        'Project milestones:\n1. Deposit received and colours confirmed\n2. Preparation complete (approx. day 2)\n3. Painting complete (approx. day 5)\n4. Final walk-through and balance due\n\nWork is weather-dependent; we will keep you informed of any delays.',
      paymentTerms: 'Deposit due on acceptance to book the start date. Balance due on completion after the final walk-through.',
      deposit: { type: 'percent', value: 30 },
      jobCosts: [{ id: 'jc_starter_waste', label: 'Waste removal', category: 'disposal', amount: 45 }],
      lineItems: lines([
        {
          name: 'Surface preparation',
          description: 'Washing, scraping, sanding, filling and caulking.',
          category: 'labor',
          unit: 'hour',
          quantity: 12,
          unitPrice: 55,
          costs: { unitCost: 0, laborHours: 1, laborPerUnit: true, crewSize: 1, materials: 30, equipment: 0, travel: 0, other: 0 },
        },
        {
          name: 'Exterior painting — siding and trim',
          description: 'Two finish coats to siding, one to trim.',
          unit: 'sqft',
          quantity: 1500,
          unitPrice: 2.25,
          costs: { unitCost: 0, laborHours: 30, laborPerUnit: false, crewSize: 2, materials: 0, equipment: 0, travel: 0, other: 0 },
        },
        {
          name: 'Primer',
          description: 'Stain-blocking primer for bare timber.',
          category: 'materials',
          unit: 'custom',
          customUnit: 'gal',
          quantity: 3,
          unitPrice: 48,
          costs: { unitCost: 32, laborHours: 0, laborPerUnit: false, crewSize: 1, materials: 0, equipment: 0, travel: 0, other: 0 },
        },
        {
          name: 'Paint and consumables',
          description: 'Premium exterior acrylic, tape, drop sheets and sundries.',
          category: 'materials',
          unit: 'custom',
          customUnit: 'gal',
          quantity: 12,
          unitPrice: 62,
          costs: { unitCost: 42, laborHours: 0, laborPerUnit: false, crewSize: 1, materials: 0, equipment: 0, travel: 0, other: 0 },
        },
        {
          name: 'Equipment and staging',
          description: 'Ladders, planks and access equipment for the duration of the job.',
          category: 'equipment',
          unit: 'lot',
          quantity: 1,
          unitPrice: 180,
          costs: { unitCost: 110, laborHours: 0, laborPerUnit: false, crewSize: 1, materials: 0, equipment: 0, travel: 0, other: 0 },
        },
      ]),
      createdAt: EPOCH,
      updatedAt: EPOCH,
    },
    {
      id: STARTER_TEMPLATE_IDS.premium,
      name: 'Premium Package',
      description: 'For higher-value packages: a core service, an upgrade and optional extras the customer can add.',
      kind: 'premium',
      tradeType: 'windowCleaning',
      isStarter: true,
      title: 'Premium Shine Package',
      scopeOfWork:
        'Our Premium Shine Package is a complete inside-and-out window service for your home: every pane cleaned inside and out, screens washed, tracks detailed, and frames and sills wiped down. Ideal before a sale, after renovation, or as a seasonal deep clean.',
      exclusions: 'Removal of paint, cement or construction residue from glass is not included.',
      customerNotes: 'Optional extras can be added at the prices shown. Just let us know which you would like.',
      paymentTerms: '',
      deposit: { type: 'none', value: 0 },
      jobCosts: [],
      lineItems: lines([
        {
          name: 'Premium Shine — interior and exterior windows',
          description: 'All windows cleaned inside and out, frames and sills wiped.',
          unit: 'each',
          quantity: 24,
          unitPrice: 10,
          costs: { unitCost: 0, laborHours: 0.2, laborPerUnit: true, crewSize: 1, materials: 8, equipment: 0, travel: 0, other: 0 },
        },
        {
          name: 'Upgrade: screen and track detailing',
          description: 'Screens removed, washed and refitted; tracks vacuumed and detailed.',
          unit: 'each',
          quantity: 16,
          unitPrice: 6,
          costs: { unitCost: 0, laborHours: 0.12, laborPerUnit: true, crewSize: 1, materials: 3, equipment: 0, travel: 0, other: 0 },
        },
        {
          name: 'Optional: hard-water stain treatment',
          description: 'Mineral deposit removal on affected panes.',
          unit: 'each',
          quantity: 6,
          unitPrice: 15,
          visibility: 'optional',
          costs: { unitCost: 0, laborHours: 0.25, laborPerUnit: true, crewSize: 1, materials: 6, equipment: 0, travel: 0, other: 0 },
        },
        {
          name: 'Optional: glass protective coating',
          description: 'Hydrophobic coating that keeps glass cleaner for longer.',
          unit: 'each',
          quantity: 24,
          unitPrice: 8,
          visibility: 'optional',
          costs: { unitCost: 1.5, laborHours: 0.1, laborPerUnit: true, crewSize: 1, materials: 0, equipment: 0, travel: 0, other: 0 },
        },
      ]),
      createdAt: EPOCH,
      updatedAt: EPOCH,
    },
  ];
}
