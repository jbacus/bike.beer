import { Beer, BurnPlan, Rider, RouteElevation, TripMode } from '../types';
import { estimateBeerCalories } from './beerCalories';
import { climbCalories } from './climb';
import { netCaloriesPerMile } from './rideBurn';

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Plans the ride needed to burn off one beer at a venue `directMiles` away.
 * Any shortfall is made up with a detour loop on the way there, assumed flat.
 * `elevation` is the outbound route's climb and descent; omit it for flat ground.
 */
export function planBurn(
  beer: Beer,
  directMiles: number,
  rider: Rider,
  tripMode: TripMode = 'outbound',
  elevation: RouteElevation = { gainFeet: 0, lossFeet: 0 },
): BurnPlan {
  if (!(directMiles >= 0)) throw new RangeError(`directMiles must be >= 0, got ${directMiles}`);

  const beerCalories = estimateBeerCalories(beer);
  const caloriesPerMile = netCaloriesPerMile(rider);
  const countedMiles = tripMode === 'roundTrip' ? directMiles * 2 : directMiles;
  const climbedFeet = elevation.gainFeet + (tripMode === 'roundTrip' ? elevation.lossFeet : 0);
  const climbBurn = climbCalories(rider, climbedFeet);
  const directBurn = countedMiles * caloriesPerMile + climbBurn;
  const netCalorieBalance = directBurn - beerCalories;
  const detourMiles = netCalorieBalance >= 0 ? 0 : -netCalorieBalance / caloriesPerMile;

  return {
    beerCalories,
    caloriesPerMile: round1(caloriesPerMile),
    countedMiles: round1(countedMiles),
    directBurn: Math.round(directBurn),
    climbBurn: Math.round(climbBurn),
    netCalorieBalance: Math.round(netCalorieBalance),
    isCoveredByDirectRide: netCalorieBalance >= 0,
    detourMiles: round1(detourMiles),
    totalMiles: round1(countedMiles + detourMiles),
  };
}
