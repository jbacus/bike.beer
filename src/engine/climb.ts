import { Rider } from '../types';
import { validateRider } from './rideBurn';

const KG_PER_LB = 0.45359237;
const M_PER_FT = 0.3048;
const G = 9.81;
const J_PER_KCAL = 4184;
/** Typical bike mass added to the rider when climbing. */
export const BIKE_KG = 10;
/** Gross mechanical efficiency of cycling: about a quarter of metabolic energy becomes work at the pedals. */
export const GROSS_EFFICIENCY = 0.24;

/**
 * Metabolic calories to lift rider and bike up `gainFeet` of climbing: m·g·h divided by
 * gross efficiency. This is on top of the flat-ground burn. Descents get no credit, because
 * coasting downhill saves little compared with what the climb cost.
 */
export function climbCalories(rider: Rider, gainFeet: number): number {
  validateRider(rider);
  if (!(gainFeet >= 0)) throw new RangeError(`gainFeet must be >= 0, got ${gainFeet}`);
  const massKg = rider.weightLbs * KG_PER_LB + BIKE_KG;
  return (massKg * G * gainFeet * M_PER_FT) / GROSS_EFFICIENCY / J_PER_KCAL;
}
