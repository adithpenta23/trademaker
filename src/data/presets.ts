/**
 * Trade presets: editable starter item libraries and example pricing settings.
 * All prices and costs are DEMONSTRATION VALUES ONLY — they are not market
 * rates and must be replaced with the owner's own numbers.
 */
import { newId } from '../domain/ids';
import { emptyLineCosts } from '../domain/quoteFactory';
import type { LineCosts, PresetItem, TradePreset, TradeType } from '../domain/types';

type ItemDef = Omit<PresetItem, 'id' | 'costs' | 'customUnit' | 'taxable'> & {
  customUnit?: string;
  taxable?: boolean;
  costs?: Partial<LineCosts>;
};

function item(def: ItemDef): PresetItem {
  return {
    id: newId('pi'),
    customUnit: '',
    taxable: true,
    ...def,
    costs: { ...emptyLineCosts(), ...def.costs },
  };
}

function pressureWashing(): TradePreset {
  return {
    tradeType: 'pressureWashing',
    label: 'Pressure washing',
    description: 'House washing, driveways, patios, fences and decks.',
    pricingExample: {
      laborCostPerHour: 28,
      defaultCrewSize: 2,
      targetMarginPercent: 45,
      minimumCharge: 175,
      overhead: { method: 'perLaborHour', amount: 9 },
    },
    items: [
      item({ name: 'House washing (soft wash)', description: 'Low-pressure soft wash of exterior siding, soffits and fascia, including rinse of landscaping.', category: 'service', unit: 'each', defaultQuantity: 1, unitPrice: 425, costs: { laborHours: 3, crewSize: 2, materials: 40, equipment: 25 } }),
      item({ name: 'Driveway cleaning', description: 'Surface-cleaner wash of concrete driveway with pre-treatment of stains.', category: 'service', unit: 'sqft', defaultQuantity: 600, unitPrice: 0.25, costs: { unitCost: 0.02, laborHours: 1.5, crewSize: 1, equipment: 15 } }),
      item({ name: 'Patio cleaning', description: 'Pressure cleaning of patio pavers or concrete, including joints.', category: 'service', unit: 'sqft', defaultQuantity: 300, unitPrice: 0.35, costs: { unitCost: 0.03, laborHours: 1.25, crewSize: 1 } }),
      item({ name: 'Fence cleaning', description: 'Low-pressure wash of wood or vinyl fence, both sides where accessible.', category: 'service', unit: 'lft', defaultQuantity: 120, unitPrice: 2.5, costs: { unitCost: 0.15, laborHours: 2.5, crewSize: 1 } }),
      item({ name: 'Deck cleaning', description: 'Wood-safe cleaning and brightening of deck boards and railings.', category: 'service', unit: 'sqft', defaultQuantity: 350, unitPrice: 0.6, costs: { unitCost: 0.05, laborHours: 2.5, crewSize: 1, materials: 20 } }),
      item({ name: 'Surface preparation', description: 'Pre-treatment of heavy staining, oil spots or organic growth.', category: 'labor', unit: 'hour', defaultQuantity: 1, unitPrice: 75, costs: { laborHours: 1, laborPerUnit: true, crewSize: 1, materials: 10 } }),
      item({ name: 'Travel surcharge', description: 'Travel to sites outside the standard service area.', category: 'travel', unit: 'visit', defaultQuantity: 1, unitPrice: 35, costs: { travel: 18 } }),
    ],
  };
}

function painting(): TradePreset {
  return {
    tradeType: 'painting',
    label: 'Painting',
    description: 'Interior and exterior painting, prep, materials and repairs.',
    pricingExample: {
      laborCostPerHour: 32,
      defaultCrewSize: 2,
      targetMarginPercent: 40,
      minimumCharge: 350,
      overhead: { method: 'perJob', amount: 85 },
    },
    items: [
      item({ name: 'Interior painting — walls', description: 'Two coats to walls of one standard room. Furniture moved and covered.', category: 'service', unit: 'room', defaultQuantity: 1, unitPrice: 450, costs: { laborHours: 7, crewSize: 1, equipment: 10 } }),
      item({ name: 'Exterior painting', description: 'Two coats to exterior siding and trim, brush and roll or spray as suitable.', category: 'service', unit: 'sqft', defaultQuantity: 1500, unitPrice: 2.25, costs: { laborHours: 30, crewSize: 2, equipment: 120 } }),
      item({ name: 'Surface preparation', description: 'Scraping, sanding, filling and caulking ahead of painting.', category: 'labor', unit: 'hour', defaultQuantity: 6, unitPrice: 55, costs: { laborHours: 1, laborPerUnit: true, crewSize: 1 } }),
      item({ name: 'Primer', description: 'Stain-blocking or bonding primer where required.', category: 'materials', unit: 'custom', customUnit: 'gal', defaultQuantity: 4, unitPrice: 48, costs: { unitCost: 32 } }),
      item({ name: 'Paint and consumables', description: 'Premium paint plus tape, drop sheets, rollers and sundries.', category: 'materials', unit: 'custom', customUnit: 'gal', defaultQuantity: 10, unitPrice: 62, costs: { unitCost: 42 } }),
      item({ name: 'Minor repairs', description: 'Drywall patching or small timber repairs before painting.', category: 'labor', unit: 'hour', defaultQuantity: 2, unitPrice: 60, costs: { laborHours: 1, laborPerUnit: true, crewSize: 1, materials: 25 } }),
      item({ name: 'Additional labor', description: 'Extra painter time for detailed work.', category: 'labor', unit: 'hour', defaultQuantity: 4, unitPrice: 55, costs: { laborHours: 1, laborPerUnit: true, crewSize: 1 } }),
      item({ name: 'Equipment and cleanup', description: 'Ladders, staging, masking and full site cleanup.', category: 'equipment', unit: 'lot', defaultQuantity: 1, unitPrice: 95, costs: { unitCost: 40, laborHours: 1, crewSize: 1 } }),
    ],
  };
}

function windowCleaning(): TradePreset {
  return {
    tradeType: 'windowCleaning',
    label: 'Window cleaning',
    description: 'Residential and commercial window, screen and track cleaning.',
    pricingExample: {
      laborCostPerHour: 26,
      defaultCrewSize: 1,
      targetMarginPercent: 50,
      minimumCharge: 120,
      overhead: { method: 'perLaborHour', amount: 8 },
    },
    items: [
      item({ name: 'Exterior window cleaning', description: 'Exterior glass cleaned with pure water or squeegee, frames wiped.', category: 'service', unit: 'each', defaultQuantity: 24, unitPrice: 6, costs: { laborHours: 0.1, laborPerUnit: true, crewSize: 1, materials: 5 } }),
      item({ name: 'Interior window cleaning', description: 'Interior glass cleaned, sills wiped, floors protected.', category: 'service', unit: 'each', defaultQuantity: 24, unitPrice: 5, costs: { laborHours: 0.12, laborPerUnit: true, crewSize: 1 } }),
      item({ name: 'Screen cleaning', description: 'Screens removed, washed and refitted.', category: 'service', unit: 'each', defaultQuantity: 16, unitPrice: 3, costs: { laborHours: 0.05, laborPerUnit: true, crewSize: 1 } }),
      item({ name: 'Track cleaning', description: 'Window tracks vacuumed and detailed.', category: 'service', unit: 'each', defaultQuantity: 16, unitPrice: 4, costs: { laborHours: 0.08, laborPerUnit: true, crewSize: 1, materials: 3 } }),
      item({ name: 'Additional-story surcharge', description: 'Ladder or pole work for windows above the second story.', category: 'service', unit: 'custom', customUnit: 'story', defaultQuantity: 1, unitPrice: 45, costs: { laborHours: 0.5, crewSize: 1, equipment: 10 } }),
      item({ name: 'Commercial recurring-service visit', description: 'Scheduled storefront and office glass clean, per visit.', category: 'service', unit: 'visit', defaultQuantity: 1, unitPrice: 180, costs: { laborHours: 3, laborPerUnit: true, crewSize: 1, unitCost: 8 } }),
    ],
  };
}

function landscaping(): TradePreset {
  return {
    tradeType: 'landscaping',
    label: 'Landscaping',
    description: 'Mowing, trimming, cleanups, mulch, planting and green waste.',
    pricingExample: {
      laborCostPerHour: 27,
      defaultCrewSize: 2,
      targetMarginPercent: 42,
      minimumCharge: 90,
      overhead: { method: 'perLaborHour', amount: 7 },
    },
    items: [
      item({ name: 'Lawn mowing', description: 'Mow, edge and blow clean hard surfaces.', category: 'service', unit: 'visit', defaultQuantity: 1, unitPrice: 65, costs: { laborHours: 1, laborPerUnit: true, crewSize: 1, unitCost: 6 } }),
      item({ name: 'Hedge trimming', description: 'Trim hedges to shape and height, clippings collected.', category: 'service', unit: 'lft', defaultQuantity: 60, unitPrice: 3.5, costs: { laborHours: 2.5, crewSize: 1 } }),
      item({ name: 'Garden cleanup', description: 'Weeding, pruning, leaf removal and general tidy.', category: 'labor', unit: 'hour', defaultQuantity: 4, unitPrice: 58, costs: { laborHours: 1, laborPerUnit: true, crewSize: 1 } }),
      item({ name: 'Mulch installation', description: 'Spread mulch to an even depth in prepared beds.', category: 'service', unit: 'custom', customUnit: 'cu yd', defaultQuantity: 4, unitPrice: 55, costs: { laborHours: 1.25, laborPerUnit: true, crewSize: 1 } }),
      item({ name: 'Mulch (materials)', description: 'Premium hardwood mulch, delivered.', category: 'materials', unit: 'custom', customUnit: 'cu yd', defaultQuantity: 4, unitPrice: 48, costs: { unitCost: 34 } }),
      item({ name: 'Planting', description: 'Plant supplied shrubs or perennials, including soil amendment.', category: 'service', unit: 'each', defaultQuantity: 6, unitPrice: 25, costs: { laborHours: 0.5, laborPerUnit: true, crewSize: 1, materials: 12 } }),
      item({ name: 'Materials (soil, plants, edging)', description: 'Supplied materials as listed in the scope.', category: 'materials', unit: 'lot', defaultQuantity: 1, unitPrice: 120, costs: { unitCost: 80 } }),
      item({ name: 'Green-waste disposal', description: 'Removal and tipping of green waste.', category: 'disposal', unit: 'load', defaultQuantity: 1, unitPrice: 85, costs: { unitCost: 45, travel: 10 } }),
      item({ name: 'Equipment and travel', description: 'Equipment transport and travel to site.', category: 'travel', unit: 'visit', defaultQuantity: 1, unitPrice: 45, costs: { equipment: 15, travel: 15 } }),
    ],
  };
}

const BUILDERS: Record<Exclude<TradeType, 'other'>, () => TradePreset> = {
  pressureWashing,
  painting,
  windowCleaning,
  landscaping,
};

export const PRESET_TRADES = Object.keys(BUILDERS) as Exclude<TradeType, 'other'>[];

/**
 * The demonstration amounts are written at the scale of these currencies.
 * For others (e.g. INR, JPY) they would be meaningless, so the UI says so
 * instead of converting — no exchange rates are assumed.
 */
const EXAMPLE_AMOUNT_CURRENCIES = new Set(['USD', 'CAD', 'AUD', 'NZD', 'GBP', 'EUR', 'SGD', 'CHF']);

export function hasExampleAmounts(currency: string): boolean {
  return EXAMPLE_AMOUNT_CURRENCIES.has(currency);
}

export function starterPresets(): TradePreset[] {
  return PRESET_TRADES.map((t) => BUILDERS[t]());
}

export function starterPreset(trade: Exclude<TradeType, 'other'>): TradePreset {
  return BUILDERS[trade]();
}
