import { bikeRouteMiles, haversineMiles, nearbyBreweries, ROAD_FACTOR } from '../web/venues';

const portland = { lat: 45.5152, lon: -122.6784 };
const seattle = { lat: 47.6062, lon: -122.3321 };

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('haversineMiles', () => {
  it('matches the known Portland–Seattle great-circle distance', () => {
    expect(haversineMiles(portland, seattle)).toBeCloseTo(145, 0);
  });

  it('is zero for the same point', () => {
    expect(haversineMiles(portland, portland)).toBe(0);
  });
});

describe('nearbyBreweries', () => {
  it('drops records without coordinates or not open, and sorts by distance', async () => {
    const fetchFn = jest.fn(async () =>
      jsonResponse([
        { id: 'far', name: 'Far', city: 'X', state_province: 'OR', latitude: '45.60', longitude: '-122.68', brewery_type: 'micro' },
        { id: 'none', name: 'No coords', city: 'X', state_province: 'OR', latitude: null, longitude: null, brewery_type: 'micro' },
        { id: 'plan', name: 'Planned', city: 'X', state_province: 'OR', latitude: '45.52', longitude: '-122.68', brewery_type: 'planning' },
        { id: 'near', name: 'Near', city: 'X', state_province: 'OR', latitude: '45.52', longitude: '-122.68', brewery_type: 'brewpub' },
      ]),
    );
    const venues = await nearbyBreweries(portland, 10, fetchFn as unknown as typeof fetch);
    expect(venues.map(v => v.id)).toEqual(['near', 'far']);
    expect(String(fetchFn.mock.calls[0])).toContain('by_dist=45.5152,-122.6784');
  });

  it('throws on an HTTP error', async () => {
    const fetchFn = async () => jsonResponse({}, 500);
    await expect(nearbyBreweries(portland, 10, fetchFn as typeof fetch)).rejects.toThrow('500');
  });
});

describe('bikeRouteMiles', () => {
  it('converts the routed distance from meters to miles', async () => {
    const fetchFn = async () => jsonResponse({ code: 'Ok', routes: [{ distance: 16093.44 }] });
    await expect(bikeRouteMiles(portland, seattle, fetchFn as typeof fetch)).resolves.toEqual({
      miles: 10,
      estimated: false,
    });
  });

  it('falls back to a scaled straight-line estimate when routing fails', async () => {
    const fetchFn = async () => {
      throw new TypeError('Failed to fetch');
    };
    const result = await bikeRouteMiles(portland, seattle, fetchFn as typeof fetch);
    expect(result.estimated).toBe(true);
    expect(result.miles).toBeCloseTo(haversineMiles(portland, seattle) * ROAD_FACTOR, 6);
  });

  it('falls back when the router finds no route', async () => {
    const fetchFn = async () => jsonResponse({ code: 'NoRoute', routes: [] });
    const result = await bikeRouteMiles(portland, seattle, fetchFn as typeof fetch);
    expect(result.estimated).toBe(true);
  });
});
