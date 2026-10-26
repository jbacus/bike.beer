/**
 * Elevation along a route from Google's ElevationService (Maps JavaScript API). Google's
 * Elevation web service does not allow browser (CORS) calls, so it goes through the JS API,
 * which is loaded on first use.
 */
import type { RouteElevation } from '../src';
import { gainAndLoss, resample } from './elevation';
import type { LatLon } from './venues';

const FT_PER_M = 3.28084;
const SAMPLES = 100;
const TIMEOUT_MS = 10000;

interface ElevationResult {
  elevation: number;
}
interface ElevationService {
  getElevationAlongPath(req: { path: Array<{ lat: number; lng: number }>; samples: number }): Promise<{ results: ElevationResult[] }>;
}
interface MapsNamespace {
  importLibrary(name: 'elevation'): Promise<{ ElevationService: new () => ElevationService }>;
}

let mapsLoad: Promise<MapsNamespace> | null = null;

function loadMaps(apiKey: string): Promise<MapsNamespace> {
  if (!mapsLoad) {
    mapsLoad = new Promise((resolve, reject) => {
      const w = window as unknown as Record<string, unknown>;
      w.__bikeBeerMapsReady = () => resolve((w.google as { maps: MapsNamespace }).maps);
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=__bikeBeerMapsReady`;
      script.async = true;
      script.onerror = () => {
        mapsLoad = null; // allow a retry on the next venue
        reject(new Error('Google Maps JavaScript API failed to load'));
      };
      document.head.appendChild(script);
    });
  }
  return mapsLoad;
}

const withTimeout = <T>(p: Promise<T>) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS))]);

/** Climb and descent along `path` in feet from Google elevation data, or null if it fails. */
export async function googleRouteElevation(path: LatLon[], apiKey: string): Promise<RouteElevation | null> {
  if (path.length < 2) return null;
  try {
    const maps = await withTimeout(loadMaps(apiKey));
    const { ElevationService } = await withTimeout(maps.importLibrary('elevation'));
    const { results } = await withTimeout(
      new ElevationService().getElevationAlongPath({
        path: resample(path).map(p => ({ lat: p.lat, lng: p.lon })),
        samples: SAMPLES,
      }),
    );
    const elev = results.map(r => r.elevation);
    if (elev.length < 2 || elev.some(e => !Number.isFinite(e))) return null;
    const { gainM, lossM } = gainAndLoss(elev);
    return { gainFeet: gainM * FT_PER_M, lossFeet: lossM * FT_PER_M };
  } catch {
    return null;
  }
}
