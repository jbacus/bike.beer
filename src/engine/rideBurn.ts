import { Rider } from '../types';

const KG_PER_LB = 0.45359237;
export const MIN_SPEED_MPH = 3;
export const MAX_SPEED_MPH = 30;

/**
 * Gross MET by speed, anchored at the midpoints of the Compendium of Physical
 * Activities cycling brackets (<10, 10–11.9, 12–13.9, 14–15.9, 16–19, >20 mph),
 * plus a 3 mph anchor near walking-pace effort. Interpolating between anchors
 * avoids the step jumps you get from using the brackets directly.
 */
const MET_ANCHORS: Array<[speedMph: number, met: number]> = [
  [3, 2.0],
  [8, 4.0],
  [11, 6.8],
  [13, 8.0],
  [15, 10.0],
  [17.5, 12.0],
  [21, 15.8],
];

export function grossMet(speedMph: number): number {
  const a = MET_ANCHORS;
  let i = a.findIndex(([s]) => s >= speedMph);
  if (i === 0) return a[0][1];
  if (i === -1) i = a.length - 1; // extrapolate along the last segment
  const [s0, m0] = a[i - 1];
  const [s1, m1] = a[i];
  return m0 + ((m1 - m0) * (speedMph - s0)) / (s1 - s0);
}

export function validateRider(rider: Rider): void {
  if (!(rider.weightLbs >= 50 && rider.weightLbs <= 500)) {
    throw new RangeError(`weightLbs must be between 50 and 500, got ${rider.weightLbs}`);
  }
  if (!(rider.speedMph >= MIN_SPEED_MPH && rider.speedMph <= MAX_SPEED_MPH)) {
    throw new RangeError(
      `speedMph must be between ${MIN_SPEED_MPH} and ${MAX_SPEED_MPH}, got ${rider.speedMph}`,
    );
  }
}

/**
 * Net calories burned per mile: energy above resting (MET − 1), using the
 * ACSM equation kcal/min = MET × 3.5 × kg / 200. Subtracting the resting MET
 * counts only the calories the ride adds, which is what "burning off" a beer means.
 */
export function netCaloriesPerMile(rider: Rider): number {
  validateRider(rider);
  const kg = rider.weightLbs * KG_PER_LB;
  const kcalPerMin = ((grossMet(rider.speedMph) - 1) * 3.5 * kg) / 200;
  return kcalPerMin * (60 / rider.speedMph);
}
