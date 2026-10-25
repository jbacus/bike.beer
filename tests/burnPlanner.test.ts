import { planBurn } from '../src';

const rider = { weightLbs: 160, speedMph: 14 }; // ≈ 43.5 net kcal/mile
const paleAle = { name: 'Pale', style: 'Pale Ale - American', abv: 5, servingOz: 12 }; // 156 kcal
const imperialStout = { name: 'Imperial', style: 'Stout - Imperial', abv: 10, servingOz: 16 }; // 368 kcal

describe('planBurn', () => {
  test('a long enough direct ride needs no detour', () => {
    const plan = planBurn(paleAle, 5, rider);
    expect(plan.isCoveredByDirectRide).toBe(true);
    expect(plan.detourMiles).toBe(0);
    expect(plan.totalMiles).toBe(5);
    expect(plan.netCalorieBalance).toBeGreaterThan(0);
  });

  test('a short ride gets a detour that exactly closes the gap', () => {
    const plan = planBurn(imperialStout, 4, rider);
    expect(plan.isCoveredByDirectRide).toBe(false);
    expect(plan.detourMiles).toBeGreaterThan(0);
    // Total miles × kcal/mile ≈ beer calories (within rounding).
    expect(plan.totalMiles * plan.caloriesPerMile).toBeCloseTo(plan.beerCalories, -1);
  });

  test('counting the ride home doubles the counted miles and shrinks the detour', () => {
    const outbound = planBurn(imperialStout, 3, rider, 'outbound');
    const roundTrip = planBurn(imperialStout, 3, rider, 'roundTrip');
    expect(roundTrip.countedMiles).toBe(6);
    expect(roundTrip.detourMiles).toBeCloseTo(outbound.detourMiles - 3, 0);
    expect(roundTrip.totalMiles).toBeCloseTo(outbound.totalMiles, 0);
  });

  test('a venue at distance 0 needs the whole ride as a loop', () => {
    const plan = planBurn(paleAle, 0, rider);
    expect(plan.detourMiles).toBe(plan.totalMiles);
  });

  test('rejects a negative distance', () => {
    expect(() => planBurn(paleAle, -1, rider)).toThrow(RangeError);
  });
});
