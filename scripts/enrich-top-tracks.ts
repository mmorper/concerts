/**
 * Enrich artists with top 5 tracks from iTunes
 *
 * Quality bar: At least 40% of tracks must have VALIDATED preview URLs (2 of 5 tracks)
 * Preview URLs are tested with HEAD requests to ensure they're actually accessible
 * Only artists meeting this threshold are included in output
 *
 * Usage (flags mirror enrich-discography.ts):
 *   npm run enrich:tracks                     # New/stale artists only (30-day TTL)
 *   npm run enrich:tracks -- --dry-run        # Preview without writing
 *   npm run enrich:tracks -- --force          # Re-fetch every artist, ignoring the TTL
 *   npm run enrich:tracks -- --artist abc --force
 *   npm run enrich:tracks -- --force --skip 40 --limit 40   # one chunk of a sweep
 *                                             # Re-fetch ONE artist
 *
 * --force exists for the artist-billing guard (#275): it only runs on fetch, so
 * a cached record keeps whatever wrong artist it was born with until the TTL
 * expires. Pair it with --dry-run to see what the guard would reject before
 * touching the file.
 *
 * Output: public/data/artists-top-tracks.json
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { iTunesClient, ITunesBlockedError, type NormalizedTrack } from './utils/itunes-client.js'
import { normalizeArtistName } from '../src/utils/normalize.js'
import { foldArtistName } from './utils/artist-key.js'

// Configuration
const AUDIO_PREVIEW_CONFIG = {
  trackLimit: 5,               // Always fetch exactly 5 tracks
  minPreviewCoverage: 0.4,     // At least 2/5 must have VALIDATED preview URLs
  rateLimitMs: 600,            // 600ms between API requests (~1.6 req/sec)
  validationDelayMs: 100,      // 100ms between validation requests
  timeout: 5000,               // 5-second timeout per request
}

interface Concert {
  headliner: string
  headlinerNormalized: string
  openers?: string[]
}

interface ArtistTopTracksData {
  [artistNormalized: string]: {
    name: string
    source: 'itunes'
    fetchedAt: string
    /** How this artist was resolved, and to whom. One record, not one per track (#275). */
    resolvedVia?: ResolvedVia
    itunesArtistId?: number
    itunesArtistName?: string
    tracks: Omit<NormalizedTrack, 'artistName' | 'artistId'>[]
  }
}

/**
 * Simple rate limiter
 */
class RateLimiter {
  private lastCallTime = 0

  constructor(private delayMs: number) {}

  async wait(): Promise<void> {
    const now = Date.now()
    const timeSinceLastCall = now - this.lastCallTime
    const waitTime = Math.max(0, this.delayMs - timeSinceLastCall)

    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }

    this.lastCallTime = Date.now()
  }
}

// normalizeArtistName is imported from src/utils/normalize.ts.
//
// This file used to carry its own copy that *deleted* special characters
// (`[^a-z0-9\s-]` → '') where the canonical one *hyphenates* them. The two agree
// whenever punctuation sits next to a space — which is most names — so the
// divergence hid for a long time. It only shows up on internal punctuation:
// "The Go-Go's" keyed as `the-go-gos` here but `the-go-go-s` everywhere else.
//
// The SPA hook matched this file's spelling, so audio previews worked there. The
// liner-notes pipeline uses the canonical form, so `curate.ts` (album art,
// audio) and `score.ts` (the 3-point audio-preview bonus) silently missed for
// eight artists (#259).

/**
 * Validate that a preview URL is actually accessible
 */
async function validatePreviewUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), AUDIO_PREVIEW_CONFIG.timeout)

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    // Check for successful response and audio content type
    if (!response.ok) return false

    const contentType = response.headers.get('content-type')
    return contentType ? contentType.includes('audio') : true // Allow if no content-type header
  } catch (error) {
    // URL is not accessible (timeout, network error, CORS, etc.)
    return false
  }
}

/**
 * Validate and filter tracks to only include those with working preview URLs
 */
async function validateTracks(tracks: NormalizedTrack[]): Promise<NormalizedTrack[]> {
  const validatedTracks: NormalizedTrack[] = []
  const rateLimiter = new RateLimiter(AUDIO_PREVIEW_CONFIG.validationDelayMs)

  for (const track of tracks) {
    if (!track.previewUrl) {
      // Keep tracks without preview URLs (they'll be shown as disabled in UI)
      validatedTracks.push(track)
      continue
    }

    await rateLimiter.wait()
    const isValid = await validatePreviewUrl(track.previewUrl)

    if (isValid) {
      validatedTracks.push(track)
    } else {
      // Invalid URL: convert to null preview
      console.log(`    ⚠️  Invalid preview URL: ${track.name}`)
      validatedTracks.push({
        ...track,
        previewUrl: null
      })
    }
  }

  return validatedTracks
}

/**
 * Check if tracks meet quality bar (40% preview coverage)
 */
function meetsQualityBar(tracks: NormalizedTrack[]): boolean {
  if (tracks.length === 0) return false

  const previewCount = tracks.filter(t => t.previewUrl !== null).length
  const coverage = previewCount / tracks.length

  return coverage >= AUDIO_PREVIEW_CONFIG.minPreviewCoverage
}

/**
 * Count tracks with preview URLs
 */
function countPreviews(tracks: NormalizedTrack[]): number {
  return tracks.filter(t => t.previewUrl !== null).length
}

/**
 * Load existing cache if it exists
 */
function loadExistingCache(): ArtistTopTracksData {
  const cachePath = resolve('public/data/artists-top-tracks.json')

  try {
    const cacheData = readFileSync(cachePath, 'utf-8')
    return JSON.parse(cacheData)
  } catch (error) {
    // Cache doesn't exist yet, return empty object
    return {}
  }
}

/**
 * Check if artist should be skipped (already enriched recently).
 * iTunes URLs are stable indefinitely, so a 30-day TTL is sufficient.
 */
function shouldSkip(
  normalized: string,
  existingCache: ArtistTopTracksData
): boolean {
  const cached = existingCache[normalized]
  if (!cached) return false

  const fetchedAt = new Date(cached.fetchedAt).getTime()
  const thirtyDays = 30 * 24 * 60 * 60 * 1000
  return Date.now() - fetchedAt < thirtyDays
}

/**
 * iTunes search aliases for artists whose names don't match Apple Music's catalog.
 * Maps the concert data name → search term to use with the iTunes Search API.
 */
const SEARCH_ALIASES: Record<string, string> = {
  "Brian Setzer \u201968 Comeback Special": "Brian Setzer",
  "Brian Setzer and the Nashvillians": "Brian Setzer",

  // The archive spells these three differently from every catalogue on earth.
  // Corrected here rather than loosened in the matcher: a matcher slack enough
  // to bridge "Kahn"/"Khan" also bridges things that are genuinely different.
  // The concert data is what is actually wrong \u2014 see #275 follow-up.
  "Chaka Kahn": "Chaka Khan",
  "Jane Weidlin": "Jane Wiedlin",
  "Gene Loves Jezabel": "Gene Loves Jezebel",

  // The marquee said DJ Z-Trip; iTunes bills every track to "Z-Trip". Needed
  // even though his ID is pinned — the billing guard compares against the
  // search name, and a pinned ID does not exempt an artist from it.
  "DJ Z-Trip": "Z-Trip",
}

/**
 * Billings that mean the same act, from artist-aliases.json.
 *
 * Built exactly as derive-album-eras.ts builds it, from BOTH relations:
 *   sameAct         \u2014 marquees this act played under
 *   discographyKeys \u2014 the name their catalogue is filed under
 *
 * The second one is why this exists. iTunes bills OMD as "Orchestral Manoeuvres
 * In the Dark", which is precisely the case `discographyKeys` was created to
 * record. Without it the billing guard rejects them and deletes five good
 * tracks.
 */
function buildAliasIndex(): Map<string, string[]> {
  const index = new Map<string, string[]>()
  const add = (slug: string, alias: string) => {
    const list = index.get(slug) ?? []
    if (!list.includes(alias)) list.push(alias)
    index.set(slug, list)
  }

  try {
    const raw = JSON.parse(readFileSync(resolve('public/data/artist-aliases.json'), 'utf-8'))
    for (const entry of raw.sameAct ?? []) {
      for (const billing of entry.billings ?? []) {
        for (const other of entry.billings ?? []) add(billing, other)
      }
    }
    for (const entry of raw.discographyKeys ?? []) {
      if (entry.act && entry.discographyKey) add(entry.act, entry.discographyKey)
    }
  } catch {
    // No alias file is survivable \u2014 every artist just resolves to itself.
  }

  return index
}

/**
 * iTunes artist ID overrides for artists where name-based search is unreliable.
 * Maps the concert data name → iTunes artist ID (from music.apple.com/us/artist/.../ID).
 * Uses the iTunes Lookup API which is exact and unambiguous.
 *
 * Add an entry only with a stated reason — same discipline as MBID_CORRECTIONS
 * in enrich-discography.ts and RELEASE_EXCLUSIONS in derive-album-eras.ts. A
 * short common word is the tell: the shorter and more generic the name, the
 * more of the catalogue competes for it.
 */
const ARTIST_ID_OVERRIDES: Record<string, number> = {
  "The Roots": 43680,

  // #275 — all four resolved to a different act entirely under name search.
  // IDs verified against the Lookup API's top tracks before pinning.
  "ABC": 391195,              // was matching children's alphabet songs; this is Martin Fry's ABC (The Lexicon of Love)
  "Bad Religion": 150160,     // was returning Frank Ocean's channel ORANGE
  "Common Sense": 15898676,   // the SoCal reggae band that opened for The English Beat — not Common, not the dance act
  "Chris Shiflett": 214324366, // his solo work (Hard Lessons, Lost at Sea) — was returning Foo Fighters

  // Found by the first --force --dry-run sweep. Each ID disambiguated against
  // our OWN discography rather than by genre guess — where two acts share a
  // name, the one whose albums we already hold is the one who played here.
  "Berlin": 364321,             // was returning RY X's song "Berlin"; this is Terri Nunn's Berlin
  "Blue Plate Special": 1693845167, // the blues act (Can You Dig It, 2006, in our discography) — not the bluegrass one
  "Book of Love": 903133,       // was returning Peter Gabriel's "Book of Love"
  "Bow Wow Wow": 636669,        // was returning The Wiggles
  "DJ Z-Trip": 6199422,         // was returning Tommy Lee; iTunes bills him "Z-Trip" (see SEARCH_ALIASES)
  "Husbands": 955931737,        // the CUATRO band that opened for Cold War Kids — not HUSBANDS of New England Casket Co.
  "Inner Circle": 100091,       // was returning Jacob Miller, their late singer, under his own billing
  "John Doe": 2354096,          // was returning Public Announcement; this is X's John Doe

  // #275 full sweep, 2026-08-10. Every ID below was chosen by the archive owner
  // against our own discography, not by genre or popularity — where two acts
  // share a name, the one whose albums we already hold is the one who played
  // here. A blank in the worksheet meant "could not verify", and those artists
  // are deliberately left unpinned rather than guessed at: no previews is the
  // correct outcome, a wrong band is not.
  //
  // Left unpinned as unverified: EarthGang, Smoke & Mirrors Sound System,
  // Torres.
  //
  // Rebuilder was on that list and came off it (#275). The worksheet blank
  // meant "could not verify", not "unverifiable" — and the album test above is
  // exactly what settles it. iTunes artist 671035943 is billed "Rebuilder",
  // genre Punk, and its records are *Rock & Roll in America*, *Local Support*
  // and *Sounds from the Massachusetts Turnpike* — three titles we already hold
  // in this artist's MusicBrainz discography. Corroborated by the booking: they
  // opened for Streetlight Manifesto at The Wiltern. Matching a catalogue we
  // already have is the standard the rest of this table was pinned to; matching
  // a NAME is not, which is why the other three stay off.
  "Against Me!": 6946251, // Against Me! (Alternative) — was "Jx.Zero"; Against Me! (1997)
  "Dr Sick": 1230754055, // Dr. Sick (Hip-Hop/Rap) — was "Solo Sounds"; no discography held
  "Drag The River": 42042457, // Drag the River (Rock) — was "Pere Ubu"; Live at the Starlight (2002)
  "Fear": 45099030, // FEAR (Punk) — was "Current Joys"; The Record (1982)
  "Hot Rod Lincoln": 280372295, // Hot Rod Lincoln (Rock) — was "Asleep At The Wheel"; The Boulevard (1996)
  "James": 130451, // James (Rock) — was "Laufey"; Stutter (1986)
  "Me Not You": 1177786368, // Me Not You (Alternative) — was "Pere Navarro & Kiko Navarro"; Already Gone (2019)
  "Midnight Oil": 18747421, // Midnight Oil (Rock) — was "Elley Duhé & Whethan"; Midnight Oil (1978)
  "Pennywise": 2820315, // Pennywise (Hard Rock) — was "Angerfist"; Pennywise (1991)
  "Prophets of Rage": 1137215876, // Prophets of Rage (Hard Rock) — was "Public Enemy"; 2016-06-03: Hollywood Palladium, Los Angeles, CA, USA (2016)
  "Rebuilder": 671035943, // Rebuilder (Punk) — was "Carrollton"; Rock & Roll in America (2015)
  "Richard Cheese & Lounge Against the Machine": 3572356, // Richard Cheese (Rock) — was "Richard Cheese"; no discography held
  "Royal Blood": 809772445, // Royal Blood (Alternative) — was "RICHLIN"; Royal Blood (2014)
  "Sleigh Bells": 370695831, // Sleigh Bells (Alternative) — was "Gene Autry"; Treats (2010)
  "Snuff": 1896311816, // Snuff (Punk) — was "Slipknot"; SnuffSaidButGorBlimeyGuvStoneMeIfHeDidn’tThrowAWobblerChaChaChaChaChaChaChaChaChaYou’reGoingHomeInACosmicAmbience (1989)
  "Squeeze": 93650, // Squeeze (Pop) — was "Fifth Harmony"; Squeeze (1978)
  "Team Band": 318493222, // Team Band (Rock) — was "Chiquito Team Band"; Vodka Thieves (2009)
  "The Alarm": 468568, // The Alarm (Rock) — was "Buckcherry"; Declaration (1984)
  "The Bronx": 20918937, // The Bronx (Rock) — was "Kurtis Blow"; The Bronx (2003)
  "The Reflex": 53055311, // Re-Flex (Dance) — was "Duran Duran"; Million Sellers (2013)
  "The Untouchables": 1365524976, // The Untouchables (Reggae) — was "Ennio Morricone"; Live and Let Dance (1984)
  "The Wonderstuff": 13129677, // The Wonder Stuff (Rock) — was "The Wonder Stuff"; no discography held
  "Trombone Shorty & Orleans Avenue": 258779315, // Trombone Shorty (Jazz) — was "Trombone Shorty"; no discography held
  "Vandals": 3563419, // The Vandals (Alternative) — was "CuBox"; no discography held
  "When In Rome": 48883288, // When In Rome (Rock) — was "ROZZZQWEEN"; When in Rome (1988)
  "Wire": 3184306, // Wire (Rock) — was "U2"; Pink Flag (1977)
  "X": 1295432230, // X (Punk) — was "Nicky Jam & J Balvin"; Los Angeles (1980)

  // ── Post-rename keys (#275) ────────────────────────────────────────────────
  // The Google Sheet was corrected upstream on 2026-08-10, so `concerts.json`
  // will carry the RIGHT spellings after the next data refresh. This table is
  // keyed by the name as it appears there, so each of these five artists would
  // silently stop matching the moment the refresh lands — and fall back to the
  // name search that misresolved them in the first place.
  //
  // Both spellings are therefore pinned to the same ID: the old key keeps
  // working until the refresh, the new key takes over after it. Drop the old
  // keys once a refresh has run and `concerts.json` no longer contains them.
  "Re-Flex": 53055311,          // was "The Reflex"
  "The Wonder Stuff": 13129677, // was "The Wonderstuff"
  "Richard Cheese": 3572356,    // was "Richard Cheese & Lounge Against the Machine"
  "Trombone Shorty": 258779315, // was "Trombone Shorty & Orleans Avenue"
  "The Vandals": 3563419,       // was "Vandals"

  // NOT pinned, deliberately: Kiev. All four iTunes candidates are hip-hop
  // acts; ours is the LA indie band that opened for Foals (Falling Bough
  // Wisdom Teeth, Willing Eyes). No correct answer exists to pin, so the
  // billing guard rejects it and the artist carries no previews. A gap is the
  // right outcome — see the FAIL CLOSED note in scripts/utils/album-title.ts.
}

/**
 * How an artist's tracks were resolved. Stored once per artist, never per track.
 */
type ResolvedVia = 'artist-id' | 'alias' | 'search'

/**
 * Over-fetch, then discard impostors. Filtering a 5-track response leaves fewer
 * than 5; asking for 10 means five genuine tracks usually survive.
 */
const CANDIDATE_MULTIPLIER = 2

/**
 * The same over-fetch for a PINNED artist, where it can safely go deeper (#275).
 *
 * An artist whose guest credits outrank their own catalogue never reaches five
 * of their own in a pool of 10 — which is the whole of what was wrong with the
 * two stragglers this issue had left:
 *
 *   Dr Sick         10 candidates -> 4 own · 25 -> 15 own
 *   Drag The River  10 candidates -> 4 own · 25 ->  8 own
 *
 * Deeper only for a pin, and that asymmetry is the point. A pin settles
 * identity by ID, so extra candidates can only ADD the artist's own records.
 * An unpinned search has no such anchor: there, a deeper pool just offers more
 * billings that happen to MENTION the name, and the quota fills with other
 * people's records. Measured on EarthGang — at 25 candidates it finds five
 * tracks billed "…& EARTHGANG" spread across FOUR different iTunes artists
 * (Tiana Major9, Louis The Child, Rich Brian…), and stores that as EarthGang's
 * top tracks. At 10 it correctly finds nothing.
 *
 * The limit is a query parameter, so depth costs the same ONE request —
 * request count, not response size, is what the iTunes budget meters.
 */
const PINNED_CANDIDATE_MULTIPLIER = 5

/**
 * Separators that join several credited artists into one billing string.
 *
 * Deliberately NOT a bare "and": plenty of single acts carry it inside their
 * name — Simon and Garfunkel, Florence and the Machine, Belle and Sebastian —
 * and splitting those invents two artists where there is one. The ampersand
 * form is handled because it is what iTunes actually emits between credits.
 */
const BILLING_SEPARATORS = /\s*(?:,|&|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b)\s*/i

/**
 * Every artist credited in a billing string, folded.
 *
 * The whole string is kept alongside its parts, because a billing is only
 * sometimes a list: "Simon & Garfunkel" splits into two names that are each
 * meaningless on their own, so the unsplit form has to stay a candidate.
 */
function creditedArtists(billing: string): string[] {
  const whole = foldArtistName(billing)
  const parts = billing.split(BILLING_SEPARATORS).map(foldArtistName).filter(Boolean)
  return [whole, ...parts]
}

/**
 * Is this artist one of the acts credited on the track?
 *
 * Exact match against each credited name, never a substring. iTunes bills "Get
 * Lucky" to "Daft Punk, Pharrell Williams & Nile Rodgers" — Rodgers is credited
 * and it is his most-played track, so requiring the whole billing to match
 * leaves him with nothing. But "Common" must NOT match "Common Sense", and a
 * substring rule cannot tell those two situations apart. Splitting can.
 *
 * The asymmetry is deliberate — the artist must appear in the BILLING, not the
 * track title. Chris Shiflett's guest spot is billed to "HIXTAPE, HARDY &
 * Morgan Wallen" with his name only in the title, so it stays dropped.
 * Appearing on a record is not the same as being credited for it.
 */
function isCredited(wanted: readonly string[], billing: string): boolean {
  const credited = creditedArtists(billing)
  return wanted.some(want => credited.includes(want))
}

/**
 * Keep only the tracks actually billed to the artist we asked for.
 *
 * The failure this catches is silent by construction (#275): a wrong-artist
 * track is well-formed, has a working preview, and clears the quality bar. Its
 * only symptom is an album title that will not match the artist's discography,
 * surfacing two layers downstream as unexplained recall loss.
 *
 * **Per track, not per artist.** An artist-level verdict is not enough, because
 * contamination is not all-or-nothing:
 *
 *   Bad Religion   4 of 5 genuine, 1 Frank Ocean (channel ORANGE)
 *   Chris Shiflett 2 of 5 genuine, 2 Foo Fighters, 1 guest credit on a comp
 *   ABC            1 of 5 genuine, 4 children's alphabet songs
 *
 * A majority rule keeps Bad Religion's Frank Ocean track. A unanimity rule
 * throws away four good Bad Religion tracks to remove one bad one. Filtering
 * per track does neither.
 *
 * **Pinning an artist ID does not remove the need for this.** The Lookup API is
 * exact about the artist but still returns guest credits — Chris Shiflett's
 * top five includes "Goin' Nowhere (feat. Chris Shiflett)", billed to another
 * act on a compilation. A record he appears on is not a record he made, and
 * that distinction is the whole point of the album signal downstream.
 */
export function keepTracksBilledTo(
  expected: string | readonly string[],
  candidates: NormalizedTrack[]
): { kept: NormalizedTrack[]; dropped: NormalizedTrack[]; sawInstead: string | null } {
  const wanted = (typeof expected === 'string' ? [expected] : expected)
    .map(foldArtistName)
    .filter(Boolean)

  const kept: NormalizedTrack[] = []
  const dropped: NormalizedTrack[] = []

  for (const track of candidates) {
    ;(isCredited(wanted, track.artistName) ? kept : dropped).push(track)
  }

  // The most common impostor — what iTunes actually thought we meant, which is
  // the useful thing to print when a whole artist fails.
  const tally = new Map<string, number>()
  for (const t of dropped) tally.set(t.artistName, (tally.get(t.artistName) ?? 0) + 1)
  const sawInstead = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return { kept, dropped, sawInstead }
}

/**
 * Keep only the tracks the PINNED artist actually recorded, by iTunes artist ID.
 *
 * A pin already answers "which act is ours" exactly — that is the entire point
 * of choosing an ID off the worksheet. Re-checking the answer against our
 * marquee spelling then throws away correct results whenever iTunes bills the
 * act differently, which is often, and was rejecting four pinned artists whose
 * pins were right all along (#275):
 *
 *   "The Reflex"                       -> iTunes bills them "Re-Flex"
 *   "The Wonderstuff"                  -> "The Wonder Stuff"
 *   "Trombone Shorty & Orleans Avenue" -> "Trombone Shorty"
 *   "Richard Cheese & Lounge Against the Machine" -> "Richard Cheese"
 *
 * This does NOT weaken the guest-credit filter that `keepTracksBilledTo`
 * exists for — it strengthens it, because a guest spot carries the HOST's
 * artist ID and is dropped on identity rather than on spelling:
 *
 *   "You Shook Me All Night Long (feat. Dr. Sick)"  -> id 1280208739, Solo Sounds
 *   "Big Black Bag (feat. Drag the River)"          -> id 476228, Michelle Malone
 *   "Dizzy" — Vic Reeves & The Wonder Stuff         -> id 14974363
 *
 * Names remain the only tool for UNPINNED artists, where no ID has been
 * established and a loose matcher would bridge acts that are genuinely
 * different — see the note on SEARCH_ALIASES.
 */
export function keepTracksByArtistId(
  artistId: number,
  candidates: NormalizedTrack[]
): { kept: NormalizedTrack[]; dropped: NormalizedTrack[]; sawInstead: string | null } {
  const kept: NormalizedTrack[] = []
  const dropped: NormalizedTrack[] = []

  for (const track of candidates) {
    ;(track.artistId === artistId ? kept : dropped).push(track)
  }

  const tally = new Map<string, number>()
  for (const t of dropped) tally.set(t.artistName, (tally.get(t.artistName) ?? 0) + 1)
  const sawInstead = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return { kept, dropped, sawInstead }
}

/**
 * Can this stored record vouch for whose tracks it holds?
 *
 * `itunesArtistId` has only been written since the billing guard landed
 * (#275), so its absence dates a record to before anything checked the artist
 * — which is exactly the population that can be holding another act's music.
 * A record that carries one was verified when it was written and is trusted.
 *
 * The absence is not merely "old": it is the only evidence available, because
 * the tracks themselves are stored with their artist stripped (see
 * NormalizedTrack), so a wrong band on disk is indistinguishable from a right
 * one by inspection.
 */
export function lacksArtistProvenance(stored?: { itunesArtistId?: number }): boolean {
  return stored !== undefined && stored.itunesArtistId === undefined
}

/**
 * The billing iTunes used most often across an artist's kept tracks.
 *
 * Not simply the first track's: a collaboration can sit at the top of the list
 * and misreport the artist we resolved. Z-Trip's most-played track is billed
 * "Z-Trip & Chester Bennington", which is true of the track and misleading as
 * a record of who we asked for and got.
 */
function commonBilling(tracks: NormalizedTrack[]): string | undefined {
  const tally = new Map<string, number>()
  for (const t of tracks) tally.set(t.artistName, (tally.get(t.artistName) ?? 0) + 1)
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}

/**
 * Strip transient provenance before persisting. See NormalizedTrack.
 */
function forStorage(tracks: NormalizedTrack[]): Omit<NormalizedTrack, 'artistName' | 'artistId'>[] {
  return tracks.map(({ artistName: _a, artistId: _i, ...track }) => track)
}

/**
 * Main enrichment function
 */
export async function enrichTopTracks(
  options: { dryRun?: boolean; force?: boolean; artist?: string; skip?: number; limit?: number } = {}
) {
  const artistFlagIndex = process.argv.indexOf('--artist')
  const numFlag = (name: string): number | undefined => {
    const i = process.argv.indexOf(name)
    if (i < 0) return undefined
    const n = Number(process.argv[i + 1])
    return Number.isFinite(n) && n >= 0 ? n : undefined
  }
  const {
    dryRun = process.argv.includes('--dry-run'),
    force = process.argv.includes('--force'),
    artist = artistFlagIndex >= 0 ? process.argv[artistFlagIndex + 1] : undefined,
    skip = numFlag('--skip'),
    limit = numFlag('--limit')
  } = options

  console.log(`🎵 Enriching artist top tracks...${dryRun ? ' (DRY RUN)' : ''}${force ? ' (FORCE)' : ''}\n`)

  // Load concerts data
  const concertsPath = resolve('public/data/concerts.json')
  const concertsData = JSON.parse(readFileSync(concertsPath, 'utf-8'))
  const concerts: Concert[] = concertsData.concerts || concertsData

  // Get unique artists (headliners + openers)
  const uniqueArtists = new Set<string>()
  concerts.forEach((concert: Concert) => {
    uniqueArtists.add(concert.headliner)
    if (concert.openers) {
      concert.openers.forEach(opener => uniqueArtists.add(opener))
    }
  })

  const allArtists = Array.from(uniqueArtists).sort()

  // ── Chunking (#275) ────────────────────────────────────────────────────────
  // A --force sweep cannot finish in one run. iTunes enforces a request BUDGET,
  // not a rate: two sweeps died at the same artist count despite a 5x cadence
  // difference, so slowing down buys nothing and only burns wall-clock. The
  // working shape is a slice, a pause, then the next slice.
  //
  // The order is a stable alphabetical sort, so `--skip N --limit M` addresses
  // the same artists on every run and a sweep can be resumed exactly where the
  // previous chunk stopped.
  const artists =
    skip !== undefined || limit !== undefined
      ? allArtists.slice(skip ?? 0, limit !== undefined ? (skip ?? 0) + limit : undefined)
      : allArtists

  if (artists.length !== allArtists.length) {
    console.log(
      `Found ${allArtists.length} unique artists — processing ${artists.length} ` +
        `(${skip ?? 0}–${(skip ?? 0) + artists.length - 1} of ${allArtists.length})\n`
    )
  } else {
    console.log(`Found ${artists.length} unique artists\n`)
  }

  // Initialize clients. A full sweep is 257 back-to-back searches and iTunes
  // starts returning 429 partway through at the incremental cadence — measured,
  // not guessed: a --force run throttled after ~90 artists and the retries
  // returned empty, which reads downstream as "artist has no tracks".
  const itunes = new iTunesClient()
  const rateLimiter = new RateLimiter(force ? 3000 : AUDIO_PREVIEW_CONFIG.rateLimitMs)

  const aliasIndex = buildAliasIndex()

  // Load existing cache
  const existingCache = loadExistingCache()
  const results: ArtistTopTracksData = { ...existingCache }

  let enriched = 0
  let skipped = 0
  let failed = 0
  const misresolved: Array<{ artist: string; got: string }> = []
  /** Pre-guard records removed because this run proved them wrong (#275). */
  const evicted: Array<{ artist: string; was: string }> = []
  let blockedAt: string | null = null

  for (const artistName of artists) {
    const normalized = normalizeArtistName(artistName)

    // Targeted re-fetch — apply one ARTIST_ID_OVERRIDES entry without 257 round-trips.
    if (artist && normalized !== artist) {
      skipped++
      continue
    }

    // Skip if already enriched recently (within 30 days)
    if (!force && shouldSkip(normalized, existingCache)) {
      console.log(`⏭️  Skipping ${artistName} (cached)`)
      skipped++
      continue
    }

    console.log(`\nFetching tracks for: ${artistName}`)

    try {
      await rateLimiter.wait()

      // Use artist ID lookup if available (exact, no ambiguity), otherwise name search with alias fallback
      const artistIdOverride = ARTIST_ID_OVERRIDES[artistName]
      const searchName = SEARCH_ALIASES[artistName] ?? artistName

      console.log(`  → Trying iTunes${artistIdOverride ? ` (by artist ID ${artistIdOverride})` : searchName !== artistName ? ` (alias: "${searchName}")` : ''}...`)
      const candidateLimit =
        AUDIO_PREVIEW_CONFIG.trackLimit *
        (artistIdOverride ? PINNED_CANDIDATE_MULTIPLIER : CANDIDATE_MULTIPLIER)
      const candidates = artistIdOverride
        ? await itunes.getTopTracksByArtistId(artistIdOverride, candidateLimit)
        : await itunes.getTopTracks(searchName, candidateLimit)

      // A pinned artist is verified by the ID they were pinned to; everyone
      // else by billing name. Checking a pin against our marquee spelling is
      // what rejected four artists whose pins were correct (#275).
      //
      // Compare against the SEARCH name plus every known billing of the act.
      // Aliases exist precisely to redirect, so "Brian Setzer '68 Comeback
      // Special" resolving to "Brian Setzer" is the alias working, not drift.
      const acceptedNames = [searchName, ...(aliasIndex.get(normalized) ?? [])]
      const { kept, dropped, sawInstead } = artistIdOverride
        ? keepTracksByArtistId(artistIdOverride, candidates)
        : keepTracksBilledTo(acceptedNames, candidates)
      if (dropped.length > 0) {
        console.log(`  🚫 Dropped ${dropped.length} track(s) billed to someone else (e.g. "${sawInstead}")`)
      }

      const iTunesTracks = kept.slice(0, AUDIO_PREVIEW_CONFIG.trackLimit)

      // Too few genuine tracks to work with. Fail closed and say why — storing
      // the impostors is what #275 did, and the wrong album names it left
      // behind are indistinguishable from missing data.
      if (candidates.length > 0 && iTunesTracks.length < AUDIO_PREVIEW_CONFIG.trackLimit) {
        console.log(
          `  ❌ Only ${iTunesTracks.length}/${AUDIO_PREVIEW_CONFIG.trackLimit} tracks billed to "${searchName}"` +
          (sawInstead ? ` — iTunes mostly returned "${sawInstead}".` : '.') +
          (artistIdOverride ? '' : ' Pin an ARTIST_ID_OVERRIDE to fix.')
        )

        // Failing closed protects the NEXT write. It did nothing about the
        // record already on disk, so a wrong band written before this guard
        // existed survived every run that has rejected it since — Kiev shipped
        // five songs merely TITLED "Kiev", by five unrelated acts, for weeks
        // after being "left unpinned" precisely to avoid that (#275).
        //
        // Evicted only when the record predates the guard, i.e. carries no
        // `itunesArtistId` to vouch for it. A provenanced record was verified
        // when it was written and is left alone. And only on this branch:
        // an empty response below is a rate limit, not a verdict, and must
        // never be read as evidence against stored data.
        const stored = results[normalized]
        if (lacksArtistProvenance(stored)) {
          delete results[normalized]
          evicted.push({ artist: artistName, was: sawInstead ?? '(unverifiable)' })
          console.log(
            `  🗑️  Removed the stored record — written before the billing guard, ` +
            `and this run proves the name resolves to someone else. No previews beats a wrong band.`
          )
        }

        misresolved.push({ artist: artistName, got: sawInstead ?? '(too few tracks)' })
        failed++
        continue
      }

      if (iTunesTracks.length === AUDIO_PREVIEW_CONFIG.trackLimit) {
        console.log(`  🔍 Validating ${iTunesTracks.length} iTunes previews...`)
        const validatedTracks = await validateTracks(iTunesTracks)

        if (meetsQualityBar(validatedTracks)) {
          const previewCount = countPreviews(validatedTracks)
          console.log(`  ✅ iTunes: ${previewCount}/${AUDIO_PREVIEW_CONFIG.trackLimit} validated tracks`)

          results[normalized] = {
            name: artistName,
            source: 'itunes',
            fetchedAt: new Date().toISOString(),
            resolvedVia: artistIdOverride ? 'artist-id' : searchName !== artistName ? 'alias' : 'search',
            itunesArtistId: validatedTracks[0]?.artistId,
            itunesArtistName: commonBilling(validatedTracks),
            tracks: forStorage(validatedTracks)
          }
          enriched++
          continue
        } else {
          const previewCount = countPreviews(validatedTracks)
          console.log(`  ⚠️  iTunes: only ${previewCount}/${AUDIO_PREVIEW_CONFIG.trackLimit} validated (below quality bar)`)
        }
      }

      // An empty response is not a quality problem — it is usually a 429 the
      // client already retried into the ground. Say so, or a throttled sweep
      // reads as 150 artists who suddenly have no music.
      if (candidates.length === 0) {
        console.log(`  ⚠️  iTunes returned nothing (rate limit or no match) — existing record left as-is`)
        failed++
        continue
      }

      // iTunes did not meet quality bar — no preview available for this artist
      const previewCount = iTunesTracks ? countPreviews(iTunesTracks) : 0
      console.log(
        `  ❌ Insufficient iTunes preview coverage (${previewCount}/${iTunesTracks?.length || 0} validated)`
      )
      failed++

    } catch (error) {
      // Stop the run. Every remaining artist would fail identically, and the
      // requests that fail are themselves what deepens the block — the first
      // sweep fired ~200 doomed requests after it was already locked out.
      if (error instanceof ITunesBlockedError) {
        blockedAt = artistName
        break
      }

      console.error(`  ❌ Error fetching ${artistName}:`, error)
      failed++
    }
  }

  // Drop records for artists no longer in the archive. Same accumulation as
  // artists-metadata.json (#255): this writes the whole object back with no
  // delete path, so any key ever written survives forever.
  //
  // Skipped under --artist, under --skip/--limit, and after a block: those runs
  // only visited some of the artists, so every record they never reached looks
  // orphaned when it is simply untouched. Pruning on a partial run would delete
  // real data.
  //
  // The chunk flags were added for #275 and initially missed here, which took
  // the cache from 257 records to 38 in three runs before the count was
  // noticed. Any future flag that narrows the artist list MUST be added to this
  // predicate — that is the whole contract of this variable.
  const partialRun =
    Boolean(artist) || blockedAt !== null || artists.length !== allArtists.length
  const liveKeys = new Set(partialRun ? Object.keys(results) : artists.map(normalizeArtistName))
  const orphans = Object.keys(results).filter(key => !liveKeys.has(key))
  for (const key of orphans) {
    delete results[key]
  }
  if (orphans.length > 0) {
    console.log(`\n🧹 Pruned ${orphans.length} record(s) with no artist in concerts.json:`)
    for (const key of orphans) console.log(`   − ${key}`)
  }

  // Save results
  const outputPath = resolve('public/data/artists-top-tracks.json')
  if (dryRun) {
    console.log(`\n🌵 DRY RUN — ${outputPath} not written`)
  } else {
    writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8')
  }

  if (blockedAt) {
    const reached = enriched + failed + misresolved.length
    console.log(`\n🛑 STOPPED — iTunes returned 403 at "${blockedAt}". This is a block, not a rate limit.`)
    console.log(`   Reached ${reached} of ${artists.length} artists. The rest were NOT checked.`)
    console.log(`   The block clears on its own in minutes. Re-run to continue — records`)
    console.log(`   already fetched are kept, and nothing that failed was overwritten.`)
  }

  if (misresolved.length > 0) {
    console.log(`\n⚠️  ${misresolved.length} artist(s) rejected — iTunes returned the wrong act:`)
    for (const m of misresolved) console.log(`   − ${m.artist} → got "${m.got}"`)
    console.log(`   Fix by pinning an ARTIST_ID_OVERRIDE. Rejected, not stored — see #275.`)
  }

  if (evicted.length > 0) {
    console.log(`\n🗑️  ${evicted.length} pre-guard record(s) removed — they were the wrong act:`)
    for (const e of evicted) console.log(`   − ${e.artist} → was really "${e.was}"`)
    console.log(`   These artists now carry NO previews, which is the intended outcome.`)
  }

  console.log(`\n📊 Enrichment Summary:`)
  console.log(`   ✅ Enriched: ${enriched}`)
  console.log(`   🚫 Wrong artist (rejected): ${misresolved.length}`)
  console.log(`   🗑️  Wrong artist (evicted from cache): ${evicted.length}`)
  console.log(`   🧹 Pruned (orphaned): ${orphans.length}`)
  console.log(`   ⏭️  Skipped (cached): ${skipped}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log(`   📁 Total in cache: ${Object.keys(results).length}`)

  const coveragePercent = ((Object.keys(results).length / artists.length) * 100).toFixed(1)
  console.log(`   📈 Coverage: ${coveragePercent}% (${Object.keys(results).length}/${artists.length} artists)`)

  console.log(dryRun ? `\n🎉 Done! (dry run — nothing written)` : `\n🎉 Done! Saved to ${outputPath}`)
}

// Run the enrichment (only when executed directly, not when imported for testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  enrichTopTracks().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}
