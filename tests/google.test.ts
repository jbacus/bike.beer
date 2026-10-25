import { googleBikeRoute, googleNearbyBreweries } from '../web/google';
import { haversineMiles, ROAD_FACTOR } from '../web/venues';

const portland = { lat: 45.5152, lon: -122.6784 };
const venue = { lat: 45.535, lon: -122.66 };

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('googleNearbyBreweries', () => {
  it('sends a key-authenticated Text Search biased to the rider and maps results', async () => {
    const fetchFn = jest.fn(async (_url: string, _init: RequestInit) =>
      jsonResponse({
        places: [
          { id: 'far', displayName: { text: 'Far' }, shortFormattedAddress: '1 A St, Beaverton', location: { latitude: 45.49, longitude: -122.8 }, businessStatus: 'OPERATIONAL' },
          { id: 'shut', displayName: { text: 'Shut' }, location: { latitude: 45.52, longitude: -122.68 }, businessStatus: 'CLOSED_PERMANENTLY' },
          { id: 'near', displayName: { text: 'Near' }, shortFormattedAddress: '2 B Ave, Portland', location: { latitude: 45.52, longitude: -122.68 } },
          { id: 'noloc', displayName: { text: 'No location' } },
        ],
      }),
    );
    const venues = await googleNearbyBreweries(portland, 'KEY', 15, fetchFn as unknown as typeof fetch);
    expect(venues.map(v => [v.id, v.city])).toEqual([['near', 'Portland'], ['far', 'Beaverton']]);

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Goog-Api-Key']).toBe('KEY');
    expect(headers['X-Goog-FieldMask']).toContain('places.location');
    const body = JSON.parse(String(init.body));
    expect(body.textQuery).toBe('brewery');
    expect(body.locationBias.circle.center).toEqual({ latitude: 45.5152, longitude: -122.6784 });
  });

  it('throws on an HTTP error, e.g. a rejected key', async () => {
    const fetchFn = async () => jsonResponse({}, 403);
    await expect(googleNearbyBreweries(portland, 'BAD', 15, fetchFn as typeof fetch)).rejects.toThrow('403');
  });
});

describe('googleBikeRoute', () => {
  it('requests a BICYCLE route and returns miles and geometry', async () => {
    const fetchFn = jest.fn(async (_url: string, _init: RequestInit) =>
      jsonResponse({
        routes: [{ distanceMeters: 16093.44, polyline: { geoJsonLinestring: { type: 'LineString', coordinates: [[-122.68, 45.51], [-122.66, 45.53]] } } }],
      }),
    );
    const result = await googleBikeRoute(portland, venue, 'KEY', fetchFn as unknown as typeof fetch);
    expect(result).toEqual({ miles: 10, estimated: false, path: [{ lat: 45.51, lon: -122.68 }, { lat: 45.53, lon: -122.66 }] });
    const body = JSON.parse(String(fetchFn.mock.calls[0][1].body));
    expect(body.travelMode).toBe('BICYCLE');
    expect(body.polylineEncoding).toBe('GEO_JSON_LINESTRING');
  });

  it('falls back to the straight-line estimate when no route comes back', async () => {
    const fetchFn = async () => jsonResponse({});
    const result = await googleBikeRoute(portland, venue, 'KEY', fetchFn as typeof fetch);
    expect(result.estimated).toBe(true);
    expect(result.miles).toBeCloseTo(haversineMiles(portland, venue) * ROAD_FACTOR, 6);
  });

  it('falls back on a network error', async () => {
    const fetchFn = async () => {
      throw new TypeError('Failed to fetch');
    };
    expect((await googleBikeRoute(portland, venue, 'KEY', fetchFn as typeof fetch)).estimated).toBe(true);
  });
});
