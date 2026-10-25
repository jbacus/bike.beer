export interface Rider {
  /** Body weight in pounds. */
  weightLbs: number;
  /** Average moving speed in mph on flat ground. */
  speedMph: number;
}

export interface Beer {
  name: string;
  /** Untappd style string, e.g. "IPA - Imperial / Double New England / Hazy". */
  style: string;
  /** Alcohol by volume as a percent: 8.5 means 8.5%, not 0.085. */
  abv: number;
  /** Serving size in US fluid ounces. Defaults to 16. */
  servingOz?: number;
}

/**
 * Which legs of the trip count toward burning off the beer.
 * - "outbound": only the ride to the venue (the beer is earned before it is drunk).
 * - "roundTrip": the ride there and back.
 */
export type TripMode = 'outbound' | 'roundTrip';

export interface BurnPlan {
  beerCalories: number;
  caloriesPerMile: number;
  /** Miles counted toward the burn with no detour (direct distance, doubled for round trips). */
  countedMiles: number;
  directBurn: number;
  /** Positive when the direct ride burns more than the beer contains. */
  netCalorieBalance: number;
  isCoveredByDirectRide: boolean;
  /** Extra loop miles to add to the outbound leg to reach break-even. */
  detourMiles: number;
  /** Total miles ridden, including the return leg if it counts. */
  totalMiles: number;
}
