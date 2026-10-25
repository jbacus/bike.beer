import { gainAndLoss, resample, routeElevation } from '../web/elevation';
import { haversineMiles } from '../web/venues';

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

const line = (n: number) => Array.from({ length: n }, (_, i) => ({ lat: 45.5 + i * 0.001, lon: -122.6 }));

describe('resample', () => {
  it('leaves short paths alone', () => {
    const path = line(10);
    expect(resample(path)).toBe(path);
  });

  it('keeps both ends and spaces points evenly', () => {
    const path = line(1000);
    const out = resample(path, 100);
    expect(out).toHaveLength(100);
    expect(out[0]).toEqual(path[0]);
    expect(out[99].lat).toBeCloseTo(path[999].lat, 9);
    const step = haversineMiles(out[0], out[1]);
    expect(haversineMiles(out[50], out[51])).toBeCloseTo(step, 6);
  });
});

describe('gainAndLoss', () => {
  it('sums real climbs and descents', () => {
    expect(gainAndLoss([10, 20, 40, 30, 50])).toEqual({ gainM: 50, lossM: 10 });
  });

  it('ignores sub-threshold noise on a flat route', () => {
    expect(gainAndLoss([10, 11, 9, 10.5, 9.5, 11, 10])).toEqual({ gainM: 0, lossM: 0 });
  });

  it('still counts a slow climb made of small steps', () => {
    const steps = Array.from({ length: 21 }, (_, i) => i); // 0..20 m in 1 m steps
    expect(gainAndLoss(steps).gainM).toBeGreaterThanOrEqual(18);
  });
});

describe('routeElevation', () => {
  it('converts the profile to feet', async () => {
    const fetchFn = async () => jsonResponse({ elevation: [0, 100, 50] });
    const result = await routeElevation(line(3), fetchFn as typeof fetch);
    expect(result!.gainFeet).toBeCloseTo(328.084, 2);
    expect(result!.lossFeet).toBeCloseTo(164.042, 2);
  });

  it('returns null on failure or a malformed body', async () => {
    const fail = async () => {
      throw new TypeError('Failed to fetch');
    };
    expect(await routeElevation(line(3), fail as typeof fetch)).toBeNull();
    const short = async () => jsonResponse({ elevation: [1, 2] });
    expect(await routeElevation(line(3), short as typeof fetch)).toBeNull();
    expect(await routeElevation(line(1))).toBeNull();
  });
});
