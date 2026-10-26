import { carbGramsPerOz, estimateBeerCalories } from '../src';
import { locateFeatured, VISION_QUEST } from '../web/featured';

const boulder = { lat: 40.015, lon: -105.27 };
const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('Vision Quest tap list', () => {
  it('has valid entries the engine accepts', () => {
    expect(VISION_QUEST.taps).toHaveLength(12);
    for (const t of VISION_QUEST.taps) {
      expect(t.abv).toBeGreaterThan(0);
      expect(t.sizesOz.length).toBeGreaterThan(0);
      expect(estimateBeerCalories({ ...t, servingOz: Math.max(...t.sizesOz) })).toBeGreaterThan(0);
    }
  });

  it('styles map to the intended carb classes', () => {
    const carbs = (name: string) => carbGramsPerOz(VISION_QUEST.taps.find(t => t.name === name)!.style);
    expect(carbs('Candy Griper Double IPA')).toBe(1.9);
    expect(carbs('Exasberryated Worm Farm')).toBe(2.6);
    expect(carbs('Famine Wolf Stout')).toBe(1.5);
    expect(carbs('Dad Joke Lager')).toBe(1.2);
  });
});

describe('locateFeatured', () => {
  it('uses Google Places when a key is set', async () => {
    const fetchFn = jest.fn(async (_u: string, _i: RequestInit) => jsonResponse({ places: [{ location: { latitude: 40.02, longitude: -105.24 } }] }));
    const v = await locateFeatured(VISION_QUEST, boulder, 'KEY', fetchFn as unknown as typeof fetch);
    expect(v).toMatchObject({ id: VISION_QUEST.id, lat: 40.02, lon: -105.24 });
    expect(JSON.parse(String(fetchFn.mock.calls[0][1].body)).textQuery).toContain('2510 47th St');
  });

  it('falls back to Open Brewery DB, matching on city', async () => {
    const fetchFn = async () =>
      jsonResponse([
        { city: 'Denver', latitude: '39.7', longitude: '-104.9' },
        { city: 'Boulder', latitude: '40.03', longitude: '-105.25' },
      ]);
    const v = await locateFeatured(VISION_QUEST, boulder, '', fetchFn as typeof fetch);
    expect(v).toMatchObject({ lat: 40.03, lon: -105.25 });
  });

  it('returns null when the venue cannot be found', async () => {
    const fetchFn = async () => jsonResponse([]);
    expect(await locateFeatured(VISION_QUEST, boulder, '', fetchFn as typeof fetch)).toBeNull();
  });
});
