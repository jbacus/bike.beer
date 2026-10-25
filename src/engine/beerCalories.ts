import { Beer } from '../types';

const ML_PER_US_FL_OZ = 29.5735;
const ETHANOL_DENSITY_G_PER_ML = 0.789;
const KCAL_PER_G_ETHANOL = 7;
const KCAL_PER_G_CARB = 4;
export const DEFAULT_SERVING_OZ = 16;

/**
 * Approximate residual carbohydrate by style, in grams per US fl oz.
 * Rules are checked in order; the first pattern that matches the style wins.
 * Values are style-typical estimates, not lab data for any specific beer.
 */
const CARB_RULES: Array<{ pattern: RegExp; carbGPerOz: number }> = [
  { pattern: /pastry|dessert|milkshake|adjunct|barrel[- ]aged|barleywine|wheatwine|quad|eisbock/i, carbGPerOz: 2.6 },
  { pattern: /imperial|double|tripel|triple|baltic|doppelbock|wee heavy|strong ale|old ale/i, carbGPerOz: 1.9 },
  { pattern: /stout|porter|bock|scotch|brown|dunkel|schwarz|milk|sweet/i, carbGPerOz: 1.5 },
  { pattern: /light|lite|session|brut|ultra/i, carbGPerOz: 0.5 },
  { pattern: /sour|gose|berliner|lambic|gueuze|wild/i, carbGPerOz: 0.9 },
  { pattern: /ipa|pale ale|apa|amber|red|saison|farmhouse|wheat|hefe|witbier|k[oö]lsch|pils|lager|helles|blonde/i, carbGPerOz: 1.2 },
];
const DEFAULT_CARB_G_PER_OZ = 1.2;

export function carbGramsPerOz(style: string): number {
  const rule = CARB_RULES.find(r => r.pattern.test(style));
  return rule ? rule.carbGPerOz : DEFAULT_CARB_G_PER_OZ;
}

/** Calories from ethanol alone: volume × ABV × density × 7 kcal/g. */
export function alcoholCalories(servingOz: number, abvPercent: number): number {
  const ethanolMl = servingOz * ML_PER_US_FL_OZ * (abvPercent / 100);
  return ethanolMl * ETHANOL_DENSITY_G_PER_ML * KCAL_PER_G_ETHANOL;
}

/** Estimated calories in a serving: ethanol plus style-typical residual carbohydrate. */
export function estimateBeerCalories(beer: Beer): number {
  const servingOz = beer.servingOz ?? DEFAULT_SERVING_OZ;
  if (!(servingOz > 0)) throw new RangeError(`servingOz must be > 0, got ${servingOz}`);
  if (!(beer.abv >= 0 && beer.abv <= 70)) {
    throw new RangeError(`abv must be a percent between 0 and 70, got ${beer.abv}`);
  }
  if (beer.abv > 0 && beer.abv < 0.25) {
    // A fraction like 0.085 means 8.5%. No real beer is 0.01–0.24% ABV (non-alcoholic beers
    // list 0.0–0.5%), so refuse rather than silently underestimate by 100x.
    throw new RangeError(`abv looks like a fraction (${beer.abv}); pass a percent, e.g. 8.5`);
  }
  const carbKcal = servingOz * carbGramsPerOz(beer.style) * KCAL_PER_G_CARB;
  return Math.round(alcoholCalories(servingOz, beer.abv) + carbKcal);
}
