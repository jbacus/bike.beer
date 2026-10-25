import { alcoholCalories, carbGramsPerOz, estimateBeerCalories } from '../src';

describe('alcoholCalories', () => {
  test('12 oz at 5% ABV is about 98 kcal of ethanol', () => {
    // 12 × 29.5735 mL × 0.05 × 0.789 g/mL × 7 kcal/g
    expect(alcoholCalories(12, 5)).toBeCloseTo(98.0, 1);
  });
});

describe('carbGramsPerOz', () => {
  test.each([
    ['Stout - Imperial / Pastry', 2.6],
    ['Stout - Imperial / Double Barrel-Aged', 2.6],
    ['IPA - Imperial / Double New England / Hazy', 1.9],
    ['Stout - Oatmeal', 1.5],
    ['Lager - American Light', 0.5],
    ['Sour - Berliner Weisse', 0.9],
    ['IPA - American', 1.2],
    ['Mead - Traditional', 1.2], // unknown style falls back to the default
  ])('%s → %d g/oz', (style, expected) => {
    expect(carbGramsPerOz(style)).toBe(expected);
  });
});

describe('estimateBeerCalories', () => {
  test('12 oz 5% pale ale ≈ 156 kcal (published pale ales: 150–180)', () => {
    expect(estimateBeerCalories({ name: 'Pale', style: 'Pale Ale - American', abv: 5, servingOz: 12 })).toBe(156);
  });

  test('16 oz 8.5% hazy DIPA ≈ 344 kcal', () => {
    const beer = { name: 'Hazy DIPA', style: 'IPA - Imperial / Double New England / Hazy', abv: 8.5, servingOz: 16 };
    expect(estimateBeerCalories(beer)).toBe(344);
  });

  test('16 oz 12% pastry stout ≈ 480 kcal', () => {
    expect(estimateBeerCalories({ name: 'Pastry', style: 'Stout - Imperial / Pastry', abv: 12, servingOz: 16 })).toBe(480);
  });

  test('defaults to a 16 oz serving', () => {
    const beer = { name: 'IPA', style: 'IPA - American', abv: 6.5 };
    expect(estimateBeerCalories(beer)).toBe(estimateBeerCalories({ ...beer, servingOz: 16 }));
  });

  test('ABV given as a fraction is rejected instead of silently underestimated', () => {
    expect(() => estimateBeerCalories({ name: 'x', style: 'IPA', abv: 0.085 })).toThrow(/fraction/);
  });

  test('non-alcoholic 0.5% beer is accepted', () => {
    expect(estimateBeerCalories({ name: 'NA', style: 'Non-Alcoholic Beer - IPA', abv: 0.5, servingOz: 12 })).toBeGreaterThan(0);
  });

  test.each([0, -12])('rejects servingOz %d', servingOz => {
    expect(() => estimateBeerCalories({ name: 'x', style: 'IPA', abv: 6, servingOz })).toThrow(RangeError);
  });
});
