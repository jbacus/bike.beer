# bike.beer: Burn & Brew engine

This TypeScript library works out how far you need to ride to burn off a specific beer. It's meant to power a "Burn & Brew" screen in [radar.beer](https://radar.beer). Give it a beer (style and ABV from Untappd), the distance to the venue, and the rider's weight and speed. It returns the beer's calories, the calories burned on the direct ride, and how long a detour loop needs to be to break even.

It has no runtime dependencies and makes no network calls. Venue data, routing and the UI belong to the host app.

## Usage

```ts
import { planBurn } from '@radar-beer/burn-and-brew';

const plan = planBurn(
  { name: 'Maharaja', style: 'IPA - Imperial / Double', abv: 10.2, servingOz: 16 },
  6.2,                                  // direct distance to the venue, miles
  { weightLbs: 160, speedMph: 14 },
  'outbound',                           // or 'roundTrip' to count the ride home
);
// {
//   beerCalories: 388, caloriesPerMile: 43.5, countedMiles: 6.2,
//   directBurn: 270, climbBurn: 0, netCalorieBalance: -118, isCoveredByDirectRide: false,
//   detourMiles: 2.7, totalMiles: 8.9
// }
```

The lower-level functions are exported too: `estimateBeerCalories`, `alcoholCalories`, `carbGramsPerOz`, `netCaloriesPerMile`, `grossMet` and `climbCalories`.

## Models

### Beer calories

Calories are ethanol plus residual carbohydrate:

```
ethanol kcal = oz × 29.5735 mL/oz × (ABV% / 100) × 0.789 g/mL × 7 kcal/g
carb kcal    = oz × carbs (g/oz, by style) × 4 kcal/g
```

`carbGramsPerOz` reads carbohydrate content from the Untappd style string:

- Pastry, barrel-aged and barleywine: 2.6 g/oz
- Imperial or double: 1.9
- Stout or porter: 1.5
- Standard ales and lagers: 1.2
- Sour: 0.9
- Light: 0.5

These are typical values for each style, not lab data for any specific beer. Pass `abv` as a percent (8.5, not 0.085). Values that look like a fraction are rejected.

### Ride burn

Calories per mile come from the ACSM equation, kcal/min = MET × 3.5 × kg / 200, multiplied by minutes per mile.

- **Smooth MET curve.** MET is interpolated against speed, using anchors at the midpoints of the Compendium of Physical Activities cycling brackets. Using the brackets directly creates step jumps, where 10 mph would score more per mile than 13.9 mph. A test checks that calories per mile never fall as speed rises.
- **Net burn.** The calculation uses MET − 1, counting only the calories the ride adds above resting, which is what "burning off" a beer means.
- **Allowed inputs.** Speed must be between 3 and 30 mph, and weight between 50 and 500 lb.

### Climbing

`planBurn` takes an optional fifth argument, `{ gainFeet, lossFeet }`, for the outbound route. `climbCalories` adds the metabolic cost of lifting rider plus a 10 kg bike: m·g·h divided by a gross efficiency of 0.24. A 160 lb rider climbing 100 m burns about 81 kcal extra. On a round trip the ride home climbs what the ride out descended, so both count. Descents earn no credit. `climbBurn` in the result is the climbing share of `directBurn`.

### Detour

If the counted miles burn less than the beer contains, `detourMiles` is the shortfall divided by calories per mile. The host app should route this as a loop on the way to the venue.

## Limitations

- Assumes still air, and detour loops are assumed flat. Climbing uses a simple m·g·h model on top of the flat-ground MET burn rather than a full power model, so it ignores rolling resistance changes and braking on descents.
- Carbohydrate values are estimates by style. Brewery-published nutrition data should override them when available.
- A 16 oz pint at 10% ABV is about 2.7 US standard drinks. The host app should not present riding home afterwards as the obvious next step.

## Development

```sh
npm install
npm test        # Jest via ts-jest
npm run build   # emits dist/
npm run build:site  # bundles the dev web UI into site/
```

## Dev site

`web/` holds a minimal static page that runs the engine in the browser. `.github/workflows/pages.yml` typechecks, tests and builds it on every PR, and deploys it to GitHub Pages on each push to `main` (or a manual run). Pages must be enabled once under Settings → Pages → Source: GitHub Actions.

"Find breweries near me" uses the browser's location, then one of two provider sets:

- **Google Maps Platform** (when the `GOOGLE_MAPS_API_KEY` repository variable is set): Places API (New) Text Search for breweries, Routes API `BICYCLE` routes (`web/google.ts`), and elevation along the route from the Maps JavaScript API `ElevationService` (`web/googleElevation.ts`; Google's Elevation web service does not allow browser calls).
- **Keyless fallback**: [Open Brewery DB](https://www.openbrewerydb.org/) and the [FOSSGIS OSRM](https://routing.openstreetmap.de/) bike router (`web/venues.ts`). The FOSSGIS router is a shared community server with a fair-use policy.

If routing fails, the distance falls back to straight-line × 1.3 and the page says so. Picking a venue also samples 100 points along the route and looks up their elevation, from Google when keyed and otherwise (or if Google fails) from the [Open-Meteo](https://open-meteo.com/) elevation API. Only changes of 3 m or more count, to filter out terrain-model noise.

Vision Quest Brewing (Boulder, CO) is a featured venue with its tap list copied into `web/featured.ts` (dated; source linked in the file). Picking a tap fills in the beer. The venue's coordinates are looked up at runtime, from Google Places or Open Brewery DB. Rider weight and speed are remembered in the browser's localStorage.

### Google Maps key

The key is compiled into the public page, so it is a browser key, not a secret. In Google Cloud:

1. Enable **Places API (New)**, **Routes API**, **Maps JavaScript API** and **Elevation API** on a project with billing.
2. Create an API key. Under *Application restrictions* choose **Websites** and add `https://jbacus.github.io/bike.beer/*`. Under *API restrictions* allow only those four APIs.
3. In this repo, add it under Settings → Secrets and variables → Actions → **Variables** as `GOOGLE_MAPS_API_KEY`, then re-run the Pages workflow.

For a local build, run `GOOGLE_MAPS_API_KEY=... npm run build:site`. The referrer restriction blocks localhost unless `http://localhost/*` is also allowed.
