import { carbGramsPerOz, planBurn, RouteElevation, TripMode } from '../src';
import { routeElevation } from './elevation';
import { googleBikeRoute, googleNearbyBreweries } from './google';
import { bikeRouteMiles, LatLon, nearbyBreweries, Venue } from './venues';

declare const __BUILD_INFO__: string;
/** Browser key for Google Maps Platform, injected at build time; empty means use the keyless providers. */
declare const __GOOGLE_MAPS_API_KEY__: string;

const GOOGLE_KEY = __GOOGLE_MAPS_API_KEY__;
const findBreweries = GOOGLE_KEY
  ? (from: LatLon) => googleNearbyBreweries(from, GOOGLE_KEY)
  : (from: LatLon) => nearbyBreweries(from);
const routeBetween = GOOGLE_KEY
  ? (from: LatLon, to: LatLon) => googleBikeRoute(from, to, GOOGLE_KEY)
  : (from: LatLon, to: LatLon) => bikeRouteMiles(from, to);

const form = document.getElementById('form') as HTMLFormElement;
const result = document.getElementById('result') as HTMLElement;
const carbHint = document.getElementById('carbHint') as HTMLElement;

/** Climb and descent of the routed venue; null when the distance was typed or the lookup failed. */
let elevation: RouteElevation | null = null;

const fmt = (n: number, digits = 0) =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function render(): void {
  const data = new FormData(form);
  const str = (k: string) => String(data.get(k) ?? '');
  const num = (k: string) => parseFloat(str(k));

  const style = str('style');
  carbHint.textContent = `Residual carbs for this style: ${carbGramsPerOz(style)} g/oz`;

  try {
    const plan = planBurn(
      { name: str('name'), style, abv: num('abv'), servingOz: num('servingOz') },
      num('directMiles'),
      { weightLbs: num('weightLbs'), speedMph: num('speedMph') },
      str('tripMode') as TripMode,
      elevation ?? undefined,
    );
    const name = escapeHtml(str('name') || 'This beer');
    const verdict = plan.isCoveredByDirectRide
      ? `<p class="verdict ok">Covered. The ride burns ${fmt(plan.netCalorieBalance)} kcal more than ${name} contains.</p>`
      : `<p class="verdict short">Add a <strong>${fmt(plan.detourMiles, 1)} mi</strong> loop on the way there to break even.</p>`;

    result.innerHTML = `
      ${verdict}
      <dl class="stats">
        <div><dt>Beer</dt><dd>${fmt(plan.beerCalories)} kcal</dd></div>
        <div><dt>Burn rate</dt><dd>${fmt(plan.caloriesPerMile, 1)} kcal/mi</dd></div>
        <div><dt>Direct ride burn</dt><dd>${fmt(plan.directBurn)} kcal over ${fmt(plan.countedMiles, 1)} mi</dd></div>
        <div class="wide"><dt>Climbing</dt><dd>${
          elevation
            ? `${fmt(plan.climbBurn)} kcal · ↑${fmt(elevation.gainFeet)} ft ↓${fmt(elevation.lossFeet)} ft out`
            : 'Flat (no route)'
        }</dd></div>
        <div><dt>Total ride</dt><dd>${fmt(plan.totalMiles, 1)} mi</dd></div>
      </dl>`;
  } catch (err) {
    result.innerHTML = `<p class="verdict error">${escapeHtml((err as Error).message)}</p>`;
  }
}

const nearMe = document.getElementById('nearMe') as HTMLButtonElement;
const venueSelect = document.getElementById('venue') as HTMLSelectElement;
const venueStatus = document.getElementById('venueStatus') as HTMLElement;
const distanceInput = form.elements.namedItem('directMiles') as HTMLInputElement;

let origin: LatLon | null = null;
let venues: Venue[] = [];
let routeRequest = 0;

function currentPosition(): Promise<LatLon> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('This browser has no location access.'));
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      err => reject(new Error(err.code === err.PERMISSION_DENIED ? 'Location permission was denied.' : 'Could not get your location.')),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  });
}

async function findNearby(): Promise<void> {
  nearMe.disabled = true;
  venueStatus.textContent = 'Finding your location…';
  try {
    origin = await currentPosition();
    venueStatus.textContent = 'Searching for breweries…';
    venues = await findBreweries(origin);
    if (venues.length === 0) {
      venueStatus.textContent = 'No breweries found near you. Enter a distance below.';
      return;
    }
    venueSelect.innerHTML =
      '<option value="">Pick a brewery</option>' +
      venues
        .map(v => `<option value="${escapeHtml(v.id)}">${escapeHtml(v.name)}, ${escapeHtml(v.city)} (${fmt(v.crowMiles, 1)} mi away)</option>`)
        .join('');
    venueSelect.disabled = false;
    venueStatus.textContent = `${venues.length} breweries found. Distances shown are straight-line.`;
  } catch (err) {
    venueStatus.textContent = (err as Error).message;
  } finally {
    nearMe.disabled = false;
  }
}

async function routeToVenue(): Promise<void> {
  const venue = venues.find(v => v.id === venueSelect.value);
  if (!venue || !origin) return;
  const request = ++routeRequest;
  venueStatus.textContent = `Routing to ${venue.name}…`;
  const route = await routeBetween(origin, venue);
  const climb = route.path ? await routeElevation(route.path) : null;
  if (request !== routeRequest) return; // a newer selection superseded this one
  distanceInput.value = route.miles.toFixed(1);
  elevation = climb;
  venueStatus.textContent = route.estimated
    ? `Bike routing is unavailable, so ${fmt(route.miles, 1)} mi is an estimate from straight-line distance. Treated as flat.`
    : `${fmt(route.miles, 1)} mi by bike route to ${venue.name}.` +
      (climb ? '' : ' Elevation is unavailable, so the route is treated as flat.');
  render();
}

// A typed distance no longer matches the routed venue, so its elevation no longer applies.
distanceInput.addEventListener('input', () => {
  routeRequest++;
  elevation = null;
  venueSelect.value = '';
  venueStatus.textContent = '';
});

// Remember the rider between visits. Storage can be unavailable (private mode), which is fine.
const RIDER_KEY = 'bikebeer.rider';
const riderFields = ['weightLbs', 'speedMph'] as const;
try {
  const saved = JSON.parse(localStorage.getItem(RIDER_KEY) ?? '{}') as Record<string, unknown>;
  for (const f of riderFields) {
    if (typeof saved[f] === 'number') (form.elements.namedItem(f) as HTMLInputElement).value = String(saved[f]);
  }
} catch {
  /* ignore */
}
form.addEventListener('input', e => {
  const name = (e.target as HTMLInputElement).name;
  if (!(riderFields as readonly string[]).includes(name)) return;
  const values = Object.fromEntries(
    riderFields.map(f => [f, parseFloat((form.elements.namedItem(f) as HTMLInputElement).value)]),
  );
  try {
    localStorage.setItem(RIDER_KEY, JSON.stringify(values));
  } catch {
    /* ignore */
  }
});

nearMe.addEventListener('click', findNearby);
venueSelect.addEventListener('change', routeToVenue);
form.addEventListener('input', render);
(document.getElementById('build') as HTMLElement).textContent = __BUILD_INFO__;
(document.getElementById(GOOGLE_KEY ? 'creditsOpen' : 'creditsGoogle') as HTMLElement).hidden = true;
render();
