/**
 * Section 1, "A row in a spreadsheet": pick a concert and see its real row, then what the build
 * works out from it with no outside help (the day, the decade, the plain-text names).
 *
 * Columns follow scripts/utils/google-sheets-client.ts (Date, Headliner, Genre, Opener, Venue,
 * City/State); the derived values are the fields fetch-google-sheet.ts adds to concerts.json.
 */
import { useState } from 'react'
import { analytics } from '../../../services/analytics'
import { sheetDate, useConcerts, type ConcertRow } from './data'

const BAND = '#8b5cf6'
const PLACE = '#6366f1'
const DATE = '#94a3b8'

/** Four rows: the one the chapter follows (shown first), then the first show, a club night, a festival. */
export const PICKS = [
  { date: '2024-12-06', label: 'The one above', sub: 'Social Distortion, 2024' },
  { date: '1984-04-27', label: 'My first show', sub: '1984' },
  { date: '2015-06-10', label: 'A club night', sub: '2015' },
  { date: '2003-09-20', label: 'A festival', sub: '2003' },
]

export function ThreeWords() {
  const concerts = useConcerts()
  const [sel, setSel] = useState(0)

  if (concerts === null) {
    return (
      <figure className="hiw-figure p-6">
        <p className="hiw-figcaption">The archive’s data didn’t load just now, so this example can’t show. Try reloading the page.</p>
      </figure>
    )
  }

  const row: ConcertRow | undefined = concerts?.find((c) => c.date === PICKS[sel].date)
  const openers = row?.openers ?? []
  const openerText = openers.length === 0 ? '—' : openers.length <= 2 ? openers.join(', ') : `${openers.slice(0, 2).join(', ')} +${openers.length - 2} more`

  const cells = row
    ? [
        { head: 'Date', value: sheetDate(row.date), color: DATE },
        { head: 'Headliner', value: row.headliner, color: BAND },
        { head: 'Genre', value: row.genre ?? '—', color: '#64748b' },
        { head: 'Opener', value: openerText, color: BAND },
        { head: 'Venue', value: row.venue, color: PLACE },
        { head: 'City/State', value: row.cityState, color: PLACE },
      ]
    : []

  const derived = row
    ? [
        { label: 'Day of the week', value: row.dayOfWeek ?? '' },
        { label: 'Decade', value: row.decade ?? '' },
        { label: 'Band, as a simple name', value: row.headlinerNormalized, mono: true },
        { label: 'Venue, as a simple name', value: row.venueNormalized ?? '', mono: true },
      ]
    : []

  return (
    <figure className="hiw-figure" aria-labelledby="tw-cap">
      <div className="px-4 sm:px-6 pt-5">
        <div className="hiw-step mb-3" style={{ color: 'var(--hiw-ink-3)' }}>
          Pick a concert
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="Example concerts">
          {PICKS.map((p, i) => {
            const c = concerts?.find((x) => x.date === p.date)
            return (
              <button
                key={p.date}
                type="button"
                className="hiw-chip"
                aria-pressed={sel === i}
                onClick={() => {
                  setSel(i)
                  analytics.trackEvent('how_it_works_example_selected', { chapter: 'the-archive', example: p.label, surface: 'chip' })
                }}
              >
                {p.label}
                <small>{c ? `${c.headliner}, ${p.sub}` : p.sub}</small>
              </button>
            )
          })}
        </div>
      </div>

      {/* The row, as a spreadsheet would show it */}
      <div className="px-4 sm:px-6 pt-6">
        <div className="rounded-xl overflow-hidden font-sans" style={{ background: '#f8fafc', color: '#0f172a' }}>
          <div className="grid grid-cols-2 sm:grid-cols-6" key={sel} style={{ animation: 'hiw-pop 0.35s ease both' }}>
            {cells.map((c) => (
              <div key={c.head} className="px-3 py-2.5" style={{ borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>{c.head}</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2, lineHeight: 1.3 }}>{c.value}</div>
                <div style={{ width: 28, height: 3, borderRadius: 2, background: c.color, marginTop: 8 }} aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* What the build works out from the row alone */}
      <div className="px-4 sm:px-6 pt-5">
        <div className="hiw-step mb-3" style={{ color: 'var(--hiw-ink-3)' }}>
          Worked out from the row, with no outside help
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {derived.map((d) => (
            <div key={d.label} className="hiw-hood" style={{ padding: '10px 12px' }}>
              <dt className="font-sans" style={{ fontSize: 12, color: 'var(--hiw-ink-3)' }}>
                {d.label}
              </dt>
              <dd
                className="font-sans mt-1"
                style={{
                  fontSize: d.mono ? 13 : 15,
                  color: 'var(--hiw-ink)',
                  fontWeight: d.mono ? 500 : 600,
                  fontFamily: d.mono ? "'JetBrains Mono', ui-monospace, monospace" : undefined,
                  overflowWrap: 'anywhere',
                }}
              >
                {d.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <figcaption id="tw-cap" className="hiw-figcaption px-4 sm:px-6 pb-5 pt-4">
        {row && openers.length > 2
          ? `One row, ${openers.length + 1} bands: the headliner and every opening act that day.`
          : 'The coloured lines show which columns the later steps use: violet for the band, indigo for the place, and grey for the date.'}
      </figcaption>
    </figure>
  )
}
