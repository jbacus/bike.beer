/**
 * Hand-entered venues with a tap list, until a live beer feed (radar.beer / Untappd) exists.
 * Coordinates are resolved at runtime (Google Places or Open Brewery DB) rather than hard-coded.
 */
import { googleFindPlace } from './google';
import { haversineMiles, LatLon, Venue } from './venues';

export interface Tap {
  name: string;
  style: string;
  abv: number;
  /** Pour sizes offered, US fl oz. */
  sizesOz: number[];
}

export interface FeaturedVenue {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  menuUrl: string;
  /** Date the tap list below was copied, ISO yyyy-mm-dd. */
  tapsAsOf: string;
  taps: Tap[];
}

export const VISION_QUEST: FeaturedVenue = {
  id: 'featured-vision-quest',
  name: 'Vision Quest Brewing',
  address: '2510 47th St, Boulder, CO 80301',
  city: 'Boulder',
  state: 'Colorado',
  menuUrl: 'https://taplist.io/taplist-515677',
  tapsAsOf: '2026-10-25',
  // Copied from the taplist.io menu linked from visionquestbrewing.com/menu.html; a few style
  // names are rewritten in Untappd's "Family - Variant" form so the carb model classifies them.
  // Hop Tea (0% ABV, not a beer) is left out: the carb model would invent calories for it.
  taps: [
    { name: 'Dad Joke Lager', style: 'American Lager', abv: 5.5, sizesOz: [4, 12, 16] },
    { name: 'Father Figure Vienna Lager', style: 'Vienna Lager', abv: 4.6, sizesOz: [4, 12, 16] },
    { name: 'CRAFtea Wit', style: 'Belgian-style Witbier', abv: 5.2, sizesOz: [4, 12, 16] },
    { name: 'Boombox Pale Ale', style: 'Pale Ale - West Coast', abv: 6, sizesOz: [4, 12, 16] },
    { name: 'Headier Than Thou Hazy IPA', style: 'IPA - Hazy', abv: 6, sizesOz: [4, 12, 16] },
    { name: "Patients' Pleas Hazy IPA", style: 'IPA - Hazy', abv: 7.4, sizesOz: [4, 12, 16] },
    { name: 'Candy Griper Double IPA', style: 'IPA - Double', abv: 8.2, sizesOz: [4, 12] },
    { name: 'Sunless Skies Cascadian Dark Ale', style: 'Cascadian Dark Ale', abv: 5.4, sizesOz: [4, 12, 16] },
    { name: 'Famine Wolf Stout', style: 'Stout', abv: 4.2, sizesOz: [4, 12, 16] },
    { name: 'Gnarlyquin Romance', style: 'Stout (with chocolate and figs)', abv: 7.9, sizesOz: [4, 12, 16] },
    { name: 'The Magical Liopleurodon Porter', style: 'Porter', abv: 7, sizesOz: [4, 12, 16] },
    { name: 'Exasberryated Worm Farm', style: 'Sour - Pastry', abv: 7.5, sizesOz: [4, 12, 16] },
  ],
};

const OPEN_BREWERY_SEARCH = 'https://api.openbrewerydb.org/v1/breweries/search';
const TIMEOUT_MS = 10000;
type Fetch = typeof fetch;

/** Finds the venue's coordinates: Google Places when a key is set, otherwise Open Brewery DB. */
export async function locateFeatured(
  venue: FeaturedVenue,
  from: LatLon,
  apiKey: string,
  fetchFn: Fetch = fetch,
): Promise<Venue | null> {
  let pos: LatLon | null = null;
  if (apiKey) {
    pos = await googleFindPlace(`${venue.name}, ${venue.address}`, apiKey, fetchFn);
  } else {
    try {
      const res = await fetchFn(`${OPEN_BREWERY_SEARCH}?query=${encodeURIComponent(venue.name)}&per_page=10`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) {
        const records = (await res.json()) as Array<{ city?: string; latitude?: string | null; longitude?: string | null }>;
        const hit = records.find(r => r.city === venue.city && r.latitude && r.longitude);
        if (hit) pos = { lat: Number(hit.latitude), lon: Number(hit.longitude) };
      }
    } catch {
      pos = null;
    }
  }
  if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lon)) return null;
  return { id: venue.id, name: venue.name, city: venue.city, state: venue.state, ...pos, crowMiles: haversineMiles(from, pos) };
}
