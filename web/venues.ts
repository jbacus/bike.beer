/**
 * Venue lookup for the dev site. Both services are free, keyless and callable from a static page:
 * - Open Brewery DB for breweries near a point.
 * - The FOSSGIS OSRM bike router (OpenStreetMap data) for cycling distance.
 * If routing fails, distance falls back to a straight-line estimate scaled by ROAD_FACTOR.
 */

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Venue extends LatLon {
  id: string;
  name: string;
  city: string;
  state: string;
  /** Straight-line distance from the search point, miles. */
  crowMiles: number;
}

export interface RouteResult {
  miles: number;
  /** True when routing failed and `miles` is the straight-line estimate. */
  estimated: boolean;
  /** Route geometry from start to venue; absent for an estimate. */
  path?: LatLon[];
}

const BREWERY_API = 'https://api.openbrewerydb.org/v1/breweries';
const BIKE_ROUTER = 'https://routing.openstreetmap.de/routed-bike/route/v1/driving';
const METERS_PER_MILE = 1609.344;
const EARTH_RADIUS_MILES = 3958.8;
/** Typical ratio of road distance to straight-line distance in a street grid. */
export const ROAD_FACTOR = 1.3;
const TIMEOUT_MS = 10000;

type Fetch = typeof fetch;

export function haversineMiles(a: LatLon, b: LatLon): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

interface BreweryRecord {
  id: string;
  name: string;
  city: string | null;
  state_province?: string | null;
  state?: string | null;
  latitude: string | null;
  longitude: string | null;
  brewery_type?: string | null;
}

/** Breweries nearest `from`, closest first. Planning-stage and closed breweries are skipped. */
export async function nearbyBreweries(from: LatLon, limit = 15, fetchFn: Fetch = fetch): Promise<Venue[]> {
  const url = `${BREWERY_API}?by_dist=${from.lat},${from.lon}&per_page=${limit * 2}`;
  const res = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Brewery search failed (${res.status})`);
  const records = (await res.json()) as BreweryRecord[];
  return records
    .filter(r => r.latitude && r.longitude && r.brewery_type !== 'planning' && r.brewery_type !== 'closed')
    .map(r => {
      const pos = { lat: Number(r.latitude), lon: Number(r.longitude) };
      return {
        id: r.id,
        name: r.name,
        city: r.city ?? '',
        state: r.state_province ?? r.state ?? '',
        ...pos,
        crowMiles: haversineMiles(from, pos),
      };
    })
    .filter(v => Number.isFinite(v.lat) && Number.isFinite(v.lon))
    .sort((a, b) => a.crowMiles - b.crowMiles)
    .slice(0, limit);
}

/** Cycling distance from `from` to `to`, falling back to a straight-line estimate if routing fails. */
export async function bikeRouteMiles(from: LatLon, to: LatLon, fetchFn: Fetch = fetch): Promise<RouteResult> {
  const url = `${BIKE_ROUTER}/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
  try {
    const res = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.ok) {
      const body = (await res.json()) as {
        code?: string;
        routes?: Array<{ distance: number; geometry?: { coordinates?: Array<[number, number]> } }>;
      };
      const route = body.routes?.[0];
      if (body.code === 'Ok' && typeof route?.distance === 'number') {
        const path = route.geometry?.coordinates?.map(([lon, lat]) => ({ lat, lon }));
        return { miles: route.distance / METERS_PER_MILE, estimated: false, path };
      }
    }
  } catch {
    // Network, CORS or timeout failure: fall through to the estimate.
  }
  return { miles: haversineMiles(from, to) * ROAD_FACTOR, estimated: true };
}
