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
//   directBurn: 270, netCalorieBalance: -118, isCoveredByDirectRide: false,
//   detourMiles: 2.7, totalMiles: 8.9
// }
```

The lower-level functions are exported too: `estimateBeerCalories`, `alcoholCalories`, `carbGramsPerOz`, `netCaloriesPerMile` and `grossMet`.

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

### Detour

If the counted miles burn less than the beer contains, `detourMiles` is the shortfall divided by calories per mile. The host app should route this as a loop on the way to the venue.

## Limitations

- Assumes flat ground and still air. Hills and headwind change the burn far more than the MET choice does. The next step is a power-based model that uses route elevation from the routing provider.
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

"Find breweries near me" uses the browser's location, [Open Brewery DB](https://www.openbrewerydb.org/) for nearby breweries, and the [FOSSGIS OSRM](https://routing.openstreetmap.de/) bike router for distance (`web/venues.ts`). Both are free and need no key. If routing fails, the distance falls back to straight-line × 1.3 and the page says so. The FOSSGIS router is a shared community server with a fair-use policy, so production traffic should move to a hosted router such as Mapbox Directions.
