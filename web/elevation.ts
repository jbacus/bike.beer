/**
 * Climb and descent along a route, from the Open-Meteo elevation API (Copernicus 90 m DEM;
 * free, keyless, CORS-enabled). The route is resampled to at most 100 evenly spaced points,
 * the API's per-request limit.
 */
import type { RouteElevation } from '../src';
import { haversineMiles, LatLon } from './venues';

const ELEVATION_API = 'https://api.open-meteo.com/v1/elevation';
const MAX_POINTS = 100;
const FT_PER_M = 3.28084;
const TIMEOUT_MS = 10000;
/**
 * Elevation changes smaller than this are treated as DEM noise. Without it, summing every
 * wiggle in a 90 m grid overstates climbing on flat routes.
 */
export const NOISE_THRESHOLD_M = 3;

type Fetch = typeof fetch;

/** Points spaced evenly by distance along `path`, including both ends. */
export function resample(path: LatLon[], maxPoints = MAX_POINTS): LatLon[] {
  if (path.length <= maxPoints) return path;
  const cumulative = [0];
  for (let i = 1; i < path.length; i++) cumulative.push(cumulative[i - 1] + haversineMiles(path[i - 1], path[i]));
  const total = cumulative[cumulative.length - 1];
  const out: LatLon[] = [];
  let seg = 1;
  for (let k = 0; k < maxPoints; k++) {
    const target = (total * k) / (maxPoints - 1);
    while (seg < path.length - 1 && cumulative[seg] < target) seg++;
    const span = cumulative[seg] - cumulative[seg - 1];
    const t = span > 0 ? Math.min(1, Math.max(0, (target - cumulative[seg - 1]) / span)) : 0;
    const a = path[seg - 1];
    const b = path[seg];
    out.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t });
  }
  return out;
}

/** Total climb and descent in metres, ignoring moves smaller than `threshold` from the last counted point. */
export function gainAndLoss(elevationsM: number[], threshold = NOISE_THRESHOLD_M): { gainM: number; lossM: number } {
  let gainM = 0;
  let lossM = 0;
  let ref = elevationsM[0];
  for (const e of elevationsM.slice(1)) {
    const d = e - ref;
    if (d >= threshold) {
      gainM += d;
      ref = e;
    } else if (d <= -threshold) {
      lossM -= d;
      ref = e;
    }
  }
  return { gainM, lossM };
}

/** Climb and descent along `path` in feet, or null if the elevation lookup fails. */
export async function routeElevation(path: LatLon[], fetchFn: Fetch = fetch): Promise<RouteElevation | null> {
  if (path.length < 2) return null;
  const points = resample(path);
  const lat = points.map(p => p.lat.toFixed(5)).join(',');
  const lon = points.map(p => p.lon.toFixed(5)).join(',');
  try {
    const res = await fetchFn(`${ELEVATION_API}?latitude=${lat}&longitude=${lon}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { elevation?: number[] };
    const elev = body.elevation;
    if (!Array.isArray(elev) || elev.length !== points.length || elev.some(e => !Number.isFinite(e))) return null;
    const { gainM, lossM } = gainAndLoss(elev);
    return { gainFeet: gainM * FT_PER_M, lossFeet: lossM * FT_PER_M };
  } catch {
    return null;
  }
}
