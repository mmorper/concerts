/**
 * Build a worksheet of the artists iTunes resolves to the WRONG act (#275).
 *
 * The billing guard rejects these rather than storing them, so nothing is
 * corrupted — but each needs a human to say which iTunes artist is ours, and
 * that is a judgement the data cannot make. This script does the legwork:
 * for every rejected artist it lists the iTunes candidates with their IDs,
 * alongside the albums OUR discography already holds for that act, so the
 * decision is a comparison rather than research.
 *
 * Deliberately NOT automated: where two acts share a name, picking by genre or
 * popularity is a guess, and a wrong pin puts the wrong songs on the site under
 * a first-person archive. `Kiev` is the standing example — all four candidates
 * are hip-hop acts, ours is an LA indie band, and no correct answer exists to
 * pin, so it carries no previews on purpose.
 *
 * Usage: npx tsx scripts/build-artist-pin-worksheet.ts
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

/** Rejected by the billing guard during the full sweep of 2026-08-09. */
const REJECTED: Array<{ artist: string; got: string }> = [
  { artist: 'Against Me!', got: 'Jx.Zero' },
  { artist: 'Dr Sick', got: 'Solo Sounds' },
  { artist: 'Drag The River', got: 'Pere Ubu' },
  { artist: 'EarthGang', got: 'Sinéad Harnett' },
  { artist: 'Fear', got: 'Current Joys' },
  { artist: 'Hot Rod Lincoln', got: 'Asleep At The Wheel' },
  { artist: 'James', got: 'Laufey' },
  { artist: 'Kiev', got: 'FRONDE' },
  { artist: 'Me Not You', got: 'Pere Navarro & Kiko Navarro' },
  { artist: 'Midnight Oil', got: 'Elley Duhé & Whethan' },
  { artist: 'Pennywise', got: 'Angerfist' },
  { artist: 'Prophets of Rage', got: 'Public Enemy' },
  { artist: 'Rebuilder', got: 'Carrollton' },
  { artist: 'Richard Cheese & Lounge Against the Machine', got: 'Richard Cheese' },
  { artist: 'Royal Blood', got: 'RICHLIN' },
  { artist: 'Sleigh Bells', got: 'Gene Autry' },
  { artist: 'Smoke & Mirrors Sound System', got: 'Agnes Obel' },
  { artist: 'Snuff', got: 'Slipknot' },
  { artist: 'Squeeze', got: 'Fifth Harmony' },
  { artist: 'Team Band', got: 'Chiquito Team Band' },
  { artist: 'The Alarm', got: 'Buckcherry' },
  { artist: 'The Bronx', got: 'Kurtis Blow' },
  { artist: 'The Reflex', got: 'Duran Duran' },
  { artist: 'The Untouchables', got: 'Ennio Morricone' },
  { artist: 'The Wonderstuff', got: 'The Wonder Stuff' },
  { artist: 'Torres', got: 'Noel Torres' },
  { artist: 'Trombone Shorty & Orleans Avenue', got: 'Trombone Shorty' },
  { artist: 'Vandals', got: 'CuBox' },
  { artist: 'When In Rome', got: 'ROZZZQWEEN' },
  { artist: 'Wire', got: 'U2' },
  { artist: 'X', got: 'Nicky Jam & J Balvin' },
]

const slugOf = (n: string) =>
  n.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

interface Candidate {
  artistId: number
  artistName: string
  genre: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function candidatesFor(name: string): Promise<Candidate[]> {
  const url =
    `https://itunes.apple.com/search?term=${encodeURIComponent(name)}` +
    `&entity=musicArtist&limit=6&country=US`
  const res = await fetch(url, { headers: { 'User-Agent': 'morperhaus-concerts/1.0' } })
  if (res.status === 403) throw new Error('iTunes returned 403 — blocked. Re-run later.')
  if (!res.ok) return []
  const body = (await res.json()) as { results?: Array<Record<string, unknown>> }
  return (body.results ?? []).map((r) => ({
    artistId: Number(r.artistId),
    artistName: String(r.artistName ?? ''),
    genre: String(r.primaryGenreName ?? ''),
  }))
}

/** Albums we already hold — the strongest signal for which candidate is ours. */
function ourAlbums(artist: string): string[] {
  try {
    const disc = JSON.parse(readFileSync(resolve('public/data/discography.json'), 'utf-8'))
    const rec = (disc.artists ?? disc)[slugOf(artist)]
    return (rec?.albums ?? [])
      .filter((a: { primaryType?: string }) => a?.primaryType === 'Album')
      .slice(0, 4)
      .map((a: { title: string; releaseDate?: string }) =>
        `${a.title}${a.releaseDate ? ` (${a.releaseDate.slice(0, 4)})` : ''}`
      )
  } catch {
    return []
  }
}

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`

async function main() {
  const rows: string[] = [
    [
      'artist_in_archive',
      'itunes_returned_WRONG',
      'albums_we_hold',
      'itunes_candidates (id — name — genre)',
      'CORRECT_ARTIST_ID',
      'action',
      'notes',
    ].map(csvCell).join(','),
  ]

  for (const { artist, got } of REJECTED) {
    await sleep(3000) // Same cadence the sweep uses.
    let cands: Candidate[] = []
    try {
      cands = await candidatesFor(artist)
    } catch (err) {
      console.error(`STOPPED at ${artist}: ${(err as Error).message}`)
      break
    }
    const albums = ourAlbums(artist)
    rows.push(
      [
        artist,
        got,
        albums.length ? albums.join(' | ') : '(no discography held)',
        cands.map((c) => `${c.artistId} — ${c.artistName} — ${c.genre}`).join(' | ') || '(no candidates)',
        '',
        '',
        '',
      ].map(csvCell).join(',')
    )
    console.log(`${artist}: ${cands.length} candidate(s), ${albums.length} album(s) held`)
  }

  const out = resolve('artist-pins-TODO.csv')
  writeFileSync(out, rows.join('\n') + '\n')
  console.log(`\nWrote ${rows.length - 1} rows to ${out}`)
}

main()
