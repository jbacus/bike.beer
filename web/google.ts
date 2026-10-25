/**
 * Google Maps Platform providers for venue search and bike routing, called over REST from the
 * browser with a browser API key:
 * - Places API (New) Text Search for breweries near a point.
 * - Routes API computeRoutes with travelMode BICYCLE.
 * The key ships in the page, so it must be restricted to the site's referrer and these two APIs.
 */
import { haversineMiles, LatLon, RouteResult, ROAD_FACTOR, Venue } from './venues';

const PLACES_SEARCH = 'https://places.googleapis.com/v1/places:searchText';
const ROUTES_COMPUTE = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const METERS_PER_MILE = 1609.344;
/** Bias the search toward this radius around the rider; Text Search allows up to 50 km. */
const SEARCH_RADIUS_M = 25000;
const TIMEOUT_MS = 10000;

type Fetch = typeof fetch;

interface PlaceRecord {
  id: string;
  displayName?: { text?: string };
  shortFormattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  businessStatus?: string;
}

const latLng = (p: LatLon) => ({ latitude: p.lat, longitude: p.lon });

function googleHeaders(apiKey: string, fieldMask: string): Record<string, string> {
  return { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': fieldMask };
}

/** Breweries near `from`, closest first. Places that are closed temporarily or permanently are skipped. */
export async function googleNearbyBreweries(
  from: LatLon,
  apiKey: string,
  limit = 15,
  fetchFn: Fetch = fetch,
): Promise<Venue[]> {
  const res = await fetchFn(PLACES_SEARCH, {
    method: 'POST',
    headers: googleHeaders(
      apiKey,
      'places.id,places.displayName,places.shortFormattedAddress,places.location,places.businessStatus',
    ),
    body: JSON.stringify({
      textQuery: 'brewery',
      locationBias: { circle: { center: latLng(from), radius: SEARCH_RADIUS_M } },
      pageSize: 20,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Google Places search failed (${res.status})`);
  const body = (await res.json()) as { places?: PlaceRecord[] };
  return (body.places ?? [])
    .filter(p => (p.businessStatus ?? 'OPERATIONAL') === 'OPERATIONAL')
    .filter(p => Number.isFinite(p.location?.latitude) && Number.isFinite(p.location?.longitude))
    .map(p => {
      const pos = { lat: p.location!.latitude!, lon: p.location!.longitude! };
      // shortFormattedAddress is "street, locality"; the last part is the town to show.
      const city = p.shortFormattedAddress?.split(',').pop()?.trim() ?? '';
      return { id: p.id, name: p.displayName?.text ?? 'Unnamed brewery', city, state: '', ...pos, crowMiles: haversineMiles(from, pos) };
    })
    .sort((a, b) => a.crowMiles - b.crowMiles)
    .slice(0, limit);
}

/** Coordinates of the best Places match for a name-and-address query, or null. */
export async function googleFindPlace(query: string, apiKey: string, fetchFn: Fetch = fetch): Promise<LatLon | null> {
  try {
    const res = await fetchFn(PLACES_SEARCH, {
      method: 'POST',
      headers: googleHeaders(apiKey, 'places.location'),
      body: JSON.stringify({ textQuery: query, pageSize: 1 }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const loc = ((await res.json()) as { places?: PlaceRecord[] }).places?.[0]?.location;
    return Number.isFinite(loc?.latitude) && Number.isFinite(loc?.longitude) ? { lat: loc!.latitude!, lon: loc!.longitude! } : null;
  } catch {
    return null;
  }
}

/** Cycling route from `from` to `to`, falling back to a straight-line estimate if routing fails. */
export async function googleBikeRoute(
  from: LatLon,
  to: LatLon,
  apiKey: string,
  fetchFn: Fetch = fetch,
): Promise<RouteResult> {
  try {
    const res = await fetchFn(ROUTES_COMPUTE, {
      method: 'POST',
      headers: googleHeaders(apiKey, 'routes.distanceMeters,routes.polyline.geoJsonLinestring'),
      body: JSON.stringify({
        origin: { location: { latLng: latLng(from) } },
        destination: { location: { latLng: latLng(to) } },
        travelMode: 'BICYCLE',
        polylineEncoding: 'GEO_JSON_LINESTRING',
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) {
      const body = (await res.json()) as {
        routes?: Array<{ distanceMeters?: number; polyline?: { geoJsonLinestring?: { coordinates?: Array<[number, number]> } } }>;
      };
      const route = body.routes?.[0];
      if (typeof route?.distanceMeters === 'number') {
        const path = route.polyline?.geoJsonLinestring?.coordinates?.map(([lon, lat]) => ({ lat, lon }));
        return { miles: route.distanceMeters / METERS_PER_MILE, estimated: false, path };
      }
    }
  } catch {
    // Network, CORS or timeout failure: fall through to the estimate.
  }
  return { miles: haversineMiles(from, to) * ROAD_FACTOR, estimated: true };
}
