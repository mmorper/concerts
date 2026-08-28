/**
 * The region that follows a city on a card — `Silver Spring, MD`, `Glasgow, UK`.
 *
 * 🔴 `venuesMetadata.state` IS ALREADY "STATE OR COUNTRY". Measured across all 79 venues:
 * eight US states plus `District of Columbia`, and then `Mexico` and `UK` sitting in the
 * same field. There is no country column to fall back to, so this is one lookup with two
 * outcomes, not a state path and a country path.
 *
 * ABBREVIATE STATES, SPELL COUNTRIES. The owner asked for a two-letter code either way.
 * US postal abbreviations are a reading convention people parse without thinking; ISO
 * country codes are not — `Tijuana, MX` reads as a form field, `Tijuana, Mexico` reads as a
 * place. `UK` is the exception that proves it: it is already the common short form and
 * already what the data stores, so it needs no mapping. (It is also not the ISO code, which
 * is `GB` — another reason to print what people say rather than what a standard says.)
 *
 * 🔴 DISTRICT OF COLUMBIA IS 15 OF 79 VENUES — the second most common value after
 * California, and the one a naive first-two-letters rule gets wrong. It is mapped
 * explicitly.
 *
 * 🔴 AN UNMAPPED VALUE WARNS AND IS PRINTED AS-IS, and that is the whole design.
 * #232 is the precedent: `regionOf` was keyed on postal codes while the data holds full
 * names, so every concert resolved to "International" for six months. It stayed invisible
 * because an unmapped US state and a genuinely foreign one produce the same answer. The
 * same trap is here — an unmapped US state would silently render `Portland, Oregon` beside
 * `Silver Spring, MD`, which looks deliberate and is not. Falling through is correct
 * behaviour for a country and a bug for a state, and only a warning can tell them apart.
 */

/** USPS abbreviations, for the states this archive actually holds plus the rest. */
const STATE_CODE: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY",
  // Not a state, and the one every naive rule gets wrong. 15 of this archive's venues.
  "district of columbia": "DC",
  "puerto rico": "PR",
};

/** Values known to be countries, so falling through is correct rather than a miss. */
export const KNOWN_COUNTRIES = new Set(["mexico", "uk", "canada", "france", "germany", "japan"]);

export interface RegionResult {
  /** What goes after the city. */
  label: string;
  /** True when this fell through unrecognised — the caller should say so out loud. */
  unmapped: boolean;
}

export function regionLabel(state: string | undefined): RegionResult {
  const key = state?.trim().toLowerCase() ?? "";
  if (!key) return { label: "", unmapped: false };
  const code = STATE_CODE[key];
  if (code) return { label: code, unmapped: false };
  return { label: state!.trim(), unmapped: !KNOWN_COUNTRIES.has(key) };
}

/** `Silver Spring, MD` — or just the city when there is no region to add. */
export function cityRegion(city: string, state: string | undefined): string {
  const { label, unmapped } = regionLabel(state);
  if (unmapped) {
    console.warn(
      `[card] unrecognised region "${state}" — printed as-is. Add it to STATE_CODE if it is ` +
        `a US state, or KNOWN_COUNTRIES if it is a country.`
    );
  }
  return label ? `${city}, ${label}` : city;
}
