import { Beer, BurnPlan, Rider, TripMode } from '../types';
import { estimateBeerCalories } from './beerCalories';
import { netCaloriesPerMile } from './rideBurn';

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Plans the ride needed to burn off one beer at a venue `directMiles` away.
 * Any shortfall is made up with a detour loop on the way there.
 */
export function planBurn(
  beer: Beer,
  directMiles: number,
  rider: Rider,
  tripMode: TripMode = 'outbound',
): BurnPlan {
  if (!(directMiles >= 0)) throw new RangeError(`directMiles must be >= 0, got ${directMiles}`);

  const beerCalories = estimateBeerCalories(beer);
  const caloriesPerMile = netCaloriesPerMile(rider);
  const countedMiles = tripMode === 'roundTrip' ? directMiles * 2 : directMiles;
  const directBurn = countedMiles * caloriesPerMile;
  const netCalorieBalance = directBurn - beerCalories;
  const detourMiles = netCalorieBalance >= 0 ? 0 : -netCalorieBalance / caloriesPerMile;

  return {
    beerCalories,
    caloriesPerMile: round1(caloriesPerMile),
    countedMiles: round1(countedMiles),
    directBurn: Math.round(directBurn),
    netCalorieBalance: Math.round(netCalorieBalance),
    isCoveredByDirectRide: netCalorieBalance >= 0,
    detourMiles: round1(detourMiles),
    totalMiles: round1(countedMiles + detourMiles),
  };
}
