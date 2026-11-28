/**
 * Step 4, "A face for every band": ask the first source; if it has nothing, ask the next; if
 * nobody does, the site draws its own tile. Never a stranger.
 *
 * Order and the exceptions follow scripts/enrich-artists.ts: TheAudioDB first (photo, story,
 * genres), then Deezer (photo only), skipped for the acts in its exception lists (the chapter's
 * prose and Hood panel describe them). Counts are live,
 * from artists-metadata.json against every headliner and opener in concerts.json.
 */
import { normalizeArtistName } from '../../../utils/normalize'
import { useConcerts, useJson, useNearView, type ArtistMeta } from './data'

export function FaceStep() {
  const [ref, near] = useNearView<HTMLElement>()
  const concerts = useConcerts()
  const meta = useJson<Record<string, ArtistMeta>>('/data/artists-metadata.json', near)

  const names = new Map<string, string>()
  for (const c of concerts ?? []) {
    names.set(c.headlinerNormalized, c.headliner)
    for (const o of c.openers) names.set(normalizeArtistName(o), o)
  }
  const tiers = { theaudiodb: [] as string[], deezer: [] as string[], none: [] as string[] }
  for (const slug of names.keys()) {
    const m = meta?.[slug]
    if (!m?.image) tiers.none.push(slug)
    else if (m.source === 'deezer') tiers.deezer.push(slug)
    else tiers.theaudiodb.push(slug)
  }
  const ready = !!meta && !!concerts
  const pick = (list: string[], n: number, prefer: string[] = []) => [...prefer.filter((s) => list.includes(s)), ...list.filter((s) => !prefer.includes(s))].slice(0, n)

  const steps = [
    { key: 'theaudiodb', title: 'TheAudioDB', gives: 'A photo, a short biography and genres', list: tiers.theaudiodb, prefer: ['sting', 'heart'] },
    { key: 'deezer', title: 'Deezer', gives: 'A photo only', list: tiers.deezer, prefer: ['social-distortion', 'depeche-mode', 'royal-blood'] },
    { key: 'none', title: 'The site’s own tile', gives: 'The band’s initials, when no one has a photo', list: tiers.none, prefer: [] },
  ]

  return (
    <figure ref={ref} className="hiw-figure" aria-labelledby="face-cap">
      {meta === null ? (
        <p className="hiw-figcaption p-6">The artist data didn’t load just now. Try reloading the page.</p>
      ) : (
        <ol className="grid gap-3 md:grid-cols-3 px-4 sm:px-6 pt-6" style={{ listStyle: 'none' }}>
          {steps.map((s, i) => (
            <li key={s.key} className="relative">
              <div className="hiw-hood p-4 h-full">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="hiw-step" style={{ fontSize: 11, color: 'var(--hiw-ink-3)' }}>
                    {i < 2 ? `Ask ${i === 0 ? 'first' : 'next'}` : 'Last resort'}
                  </span>
                  <span className="hiw-title" style={{ fontSize: 28, color: i === 1 ? '#fff' : 'var(--hiw-ink-2)' }}>
                    {ready ? s.list.length : '…'}
                  </span>
                </div>
                <div className="font-sans mt-1" style={{ fontSize: 17, fontWeight: 600 }}>
                  {s.title}
                </div>
                <div className="font-sans" style={{ fontSize: 13.5, color: 'var(--hiw-ink-2)' }}>
                  {s.gives}
                </div>
                <div className="flex gap-2 mt-3" aria-hidden="true">
                  {pick(s.list, 3, s.prefer).map((slug) =>
                    meta?.[slug]?.image ? (
                      <img key={slug} src={meta[slug].image} alt="" loading="lazy" className="rounded-lg object-cover" style={{ width: 52, height: 52, border: '1px solid rgba(255,255,255,0.14)' }} />
                    ) : (
                      <Tile key={slug} name={names.get(slug) ?? slug} />
                    ),
                  )}
                </div>
                <div className="font-sans mt-2" style={{ fontSize: 12, color: 'var(--hiw-ink-3)' }}>
                  {pick(s.list, 3, s.prefer)
                    .map((slug) => meta?.[slug]?.name ?? names.get(slug) ?? slug)
                    .join(' · ')}
                </div>
              </div>
              {i < 2 && (
                <span className="hidden md:block absolute top-1/2 -right-3 -translate-y-1/2 font-sans" style={{ color: '#a5b4fc', fontSize: 16 }} aria-hidden="true">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      <figcaption id="face-cap" className="hiw-figcaption px-4 sm:px-6 pb-5 pt-4">
        {ready
          ? `These numbers are live: all ${names.size} bands in the archive, including opening acts.`
          : 'Asking the archive…'}
      </figcaption>
    </figure>
  )
}

function Tile({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  return (
    <span className="grid place-items-center rounded-lg font-sans" style={{ width: 52, height: 52, background: 'linear-gradient(160deg,#312e81,#1e1b4b)', border: '1px solid rgba(255,255,255,0.14)', fontWeight: 700, color: '#c7d2fe' }}>
      {initials}
    </span>
  )
}
