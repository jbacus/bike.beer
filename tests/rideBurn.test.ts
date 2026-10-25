import { MAX_SPEED_MPH, MIN_SPEED_MPH, grossMet, netCaloriesPerMile } from '../src';

describe('grossMet', () => {
  test('hits the Compendium bracket values at bracket midpoints', () => {
    expect(grossMet(11)).toBeCloseTo(6.8);
    expect(grossMet(13)).toBeCloseTo(8.0);
    expect(grossMet(15)).toBeCloseTo(10.0);
  });

  test('interpolates between anchors', () => {
    expect(grossMet(14)).toBeCloseTo(9.0);
  });
});

describe('netCaloriesPerMile', () => {
  test('160 lb rider at 14 mph burns about 43.5 net kcal/mile', () => {
    // (9.0 − 1) × 3.5 × 72.57 kg / 200 = 10.16 kcal/min; × 60/14 min/mile
    expect(netCaloriesPerMile({ weightLbs: 160, speedMph: 14 })).toBeCloseTo(43.5, 1);
  });

  test('scales linearly with body weight', () => {
    const a = netCaloriesPerMile({ weightLbs: 150, speedMph: 15 });
    const b = netCaloriesPerMile({ weightLbs: 300, speedMph: 15 });
    expect(b / a).toBeCloseTo(2, 6);
  });

  test('never decreases as speed rises, and has no step jumps', () => {
    let prev = 0;
    for (let tenths = MIN_SPEED_MPH * 10; tenths <= MAX_SPEED_MPH * 10; tenths++) {
      const mph = tenths / 10;
      const cpm = netCaloriesPerMile({ weightLbs: 165, speedMph: mph });
      if (prev > 0) {
        expect(cpm).toBeGreaterThanOrEqual(prev - 1e-9);
        expect(cpm / prev).toBeLessThan(1.05); // < 5% change per 0.1 mph
      }
      prev = cpm;
    }
  });

  test.each([
    [{ weightLbs: 165, speedMph: 0 }],
    [{ weightLbs: 165, speedMph: 45 }],
    [{ weightLbs: 0, speedMph: 14 }],
    [{ weightLbs: NaN, speedMph: 14 }],
  ])('rejects out-of-range rider %o', rider => {
    expect(() => netCaloriesPerMile(rider)).toThrow(RangeError);
  });
});
