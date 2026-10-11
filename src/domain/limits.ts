/** Input limits shared by the UI, the calculation engine and backup import validation. */
export const LIMITS = {
  quantity: { min: 0, max: 1_000_000 },
  money: { min: 0, max: 10_000_000 },
  hours: { min: 0, max: 100_000 },
  crew: { min: 1, max: 100 },
  percent: { min: 0, max: 100 },
  /** A gross margin of 100% or more is impossible (it needs an infinite price). */
  targetMargin: { min: 0, max: 99.9 },
  markup: { min: 0, max: 10_000 },
  validityDays: { min: 1, max: 730 },
  lineItems: 200,
  jobCosts: 100,
  taxComponents: 5,
  quotes: 2_000,
  templates: 200,
  presetItems: 200,
  shortText: 200,
  longText: 10_000,
} as const;
