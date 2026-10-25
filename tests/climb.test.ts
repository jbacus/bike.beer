import { climbCalories, planBurn } from '../src';

const rider = { weightLbs: 160, speedMph: 14 };
const stout = { name: 'Imperial', style: 'Stout - Imperial', abv: 10, servingOz: 16 };

describe('climbCalories', () => {
  test('matches m·g·h / efficiency for 160 lb + bike up 328 ft (100 m)', () => {
    // (72.57 + 10) kg × 9.81 × 100 m / 0.24 / 4184 ≈ 80.7 kcal
    expect(climbCalories(rider, 328.084)).toBeCloseTo(80.7, 1);
  });

  test('is zero on flat ground and scales linearly with gain', () => {
    expect(climbCalories(rider, 0)).toBe(0);
    expect(climbCalories(rider, 600)).toBeCloseTo(2 * climbCalories(rider, 300), 9);
  });

  test('rejects negative gain', () => {
    expect(() => climbCalories(rider, -1)).toThrow(RangeError);
  });
});

describe('planBurn with elevation', () => {
  test('omitting elevation matches flat ground', () => {
    expect(planBurn(stout, 4, rider)).toEqual(planBurn(stout, 4, rider, 'outbound', { gainFeet: 0, lossFeet: 0 }));
    expect(planBurn(stout, 4, rider).climbBurn).toBe(0);
  });

  test('outbound counts only the climb; climbing shrinks the detour', () => {
    const flat = planBurn(stout, 4, rider);
    const hilly = planBurn(stout, 4, rider, 'outbound', { gainFeet: 400, lossFeet: 100 });
    expect(hilly.climbBurn).toBe(Math.round(climbCalories(rider, 400)));
    expect(hilly.directBurn - flat.directBurn).toBeCloseTo(climbCalories(rider, 400), -1);
    expect(hilly.detourMiles).toBeLessThan(flat.detourMiles);
  });

  test('round trip also climbs what the outbound leg descended', () => {
    const plan = planBurn(stout, 4, rider, 'roundTrip', { gainFeet: 400, lossFeet: 100 });
    expect(plan.climbBurn).toBe(Math.round(climbCalories(rider, 500)));
  });
});
