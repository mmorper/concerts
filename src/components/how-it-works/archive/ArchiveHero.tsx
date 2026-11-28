/**
 * The chapter's opening picture: one real row of the spreadsheet, and what each column becomes.
 *
 * The row is concert-176 in public/data/concerts.json, as it sits in the Google Sheet (Date,
 * Headliner, Genre, Venue, City/State; this night had no opener). Streams are coloured by the
 * column that feeds them, in the old cascade's colours: band violet, place indigo, date slate.
 * Which column feeds what follows docs/DATA_PIPELINE.md: venue and city → coordinates (Google
 * Geocoding) and venue photo (Google Places); headliner → photo (TheAudioDB, then
 * Deezer), song previews (Apple Music) and albums (MusicBrainz); headliner, date
 * and venue together → the setlist (setlist.fm).
 */
import { useMediaQuery, useReducedMotion } from '../shared'

const BAND = '#8b5cf6'
const PLACE = '#6366f1'
const DATE = '#94a3b8'

const COLUMNS = [
  { key: 'date', head: 'Date', value: '12/6/2024', x0: 60, x1: 190, color: DATE },
  { key: 'band', head: 'Headliner', value: 'Social Distortion', x0: 190, x1: 410, color: BAND },
  { key: 'genre', head: 'Genre', value: 'Punk', x0: 410, x1: 510, color: '#64748b' },
  { key: 'venue', head: 'Venue', value: 'The Belasco', x0: 510, x1: 690, color: PLACE },
  { key: 'city', head: 'City/State', value: 'Los Angeles, California', x0: 690, x1: 940, color: PLACE },
] as const

type Col = (typeof COLUMNS)[number]['key']

const ARTIFACTS: { label: string; from: Col[]; icon: (c: string) => JSX.Element }[] = [
  {
    label: 'The setlist',
    from: ['date', 'band', 'venue'],
    icon: (c) => (
      <g stroke={c} strokeWidth="2" strokeLinecap="round">
        {[-8, -2, 4, 10].map((y, i) => (
          <line key={y} x1="-9" x2={[9, 5, 8, 3][i]} y1={y - 1} y2={y - 1} />
        ))}
      </g>
    ),
  },
  {
    label: 'Band photo',
    from: ['band'],
    icon: (c) => (
      <g fill="none" stroke={c} strokeWidth="2">
        <circle cx="0" cy="-4" r="5" />
        <path d="M-10 11 C-9 3, 9 3, 10 11" />
      </g>
    ),
  },
  {
    label: 'Song previews',
    from: ['band'],
    icon: (c) => (
      <g fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
        {[-9, -4.5, 0, 4.5, 9].map((x, i) => (
          <line key={x} x1={x} x2={x} y1={-[4, 8, 11, 7, 3][i]} y2={[4, 8, 11, 7, 3][i]} />
        ))}
      </g>
    ),
  },
  {
    label: 'Their albums',
    from: ['band'],
    icon: (c) => (
      <g fill="none" stroke={c} strokeWidth="2">
        <rect x="-11" y="-11" width="18" height="18" rx="2" />
        <circle cx="4" cy="2" r="7.5" strokeOpacity="0.6" />
      </g>
    ),
  },
  {
    label: 'Venue photo',
    from: ['venue'],
    icon: (c) => (
      <g fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round">
        <rect x="-11" y="-9" width="22" height="18" rx="3" />
        <path d="M-11 6 L-3 -1 L3 4 L6 1 L11 6" />
      </g>
    ),
  },
  {
    label: 'A pin on the map',
    from: ['venue', 'city'],
    icon: (c) => (
      <g fill="none" stroke={c} strokeWidth="2">
        <path d="M0 12 C-8 3, -9 -1, -9 -4 A9 9 0 0 1 9 -4 C9 -1, 8 3, 0 12 Z" />
        <circle cx="0" cy="-4" r="3" />
      </g>
    ),
  },
]

export function ArchiveHero() {
  const narrow = useMediaQuery('(max-width: 640px)')
  const reduced = useReducedMotion()
  const col = (k: Col) => COLUMNS.find((c) => c.key === k)!

  if (narrow) {
    // On a phone: the row as a short list, and the six results in a grid, each with dots in the
    // colours of the columns it comes from.
    return (
      <figure className="hiw-figure p-4" aria-label="One row of the spreadsheet, and what it becomes">
        <dl className="rounded-xl p-3 font-sans" style={{ background: '#f8fafc', color: '#0f172a' }}>
          {COLUMNS.map((c) => (
            <div key={c.key} className="flex justify-between gap-3 py-1" style={{ borderBottom: '1px solid #e2e8f0' }}>
              <dt style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{c.head}</dt>
              <dd style={{ fontSize: 15, fontWeight: 600, borderBottom: `2px solid ${c.color}` }}>{c.value}</dd>
            </div>
          ))}
        </dl>
        <ul className="grid grid-cols-3 gap-3 mt-5" style={{ listStyle: 'none' }}>
          {ARTIFACTS.map((a) => (
            <li key={a.label} className="flex flex-col items-center text-center gap-1.5">
              <svg width="52" height="52" viewBox="-26 -26 52 52" aria-hidden="true">
                <circle r="25" fill="#0a0e26" stroke="rgba(165,180,252,0.35)" />
                {a.icon('#eef0ff')}
              </svg>
              <span className="font-sans" style={{ fontSize: 13, color: 'var(--hiw-ink-2)', lineHeight: 1.3 }}>
                {a.label}
              </span>
              <span className="flex gap-1" aria-hidden="true">
                {a.from.map((f) => (
                  <span key={f} style={{ width: 6, height: 6, borderRadius: '50%', background: col(f).color }} />
                ))}
              </span>
            </li>
          ))}
        </ul>
      </figure>
    )
  }

  const W = 1000
  const rowTop = 24
  const rowBottom = 100
  const iconY = 262
  const xs = ARTIFACTS.map((_, i) => 110 + i * ((W - 220) / (ARTIFACTS.length - 1)))
  let n = 0

  return (
    <figure className="hiw-figure" aria-label="One row of the spreadsheet, and what it becomes">
      <svg className="hiw-svg block w-full" viewBox={`0 0 ${W} 340`} role="img" aria-label="A spreadsheet row: 12/6/2024, Social Distortion, Punk, The Belasco, Los Angeles. Its columns flow into a setlist, a band photo, song previews, albums, a venue photo and a pin on the map.">
        {/* The row */}
        <rect x="56" y={rowTop} width="888" height={rowBottom - rowTop} rx="10" fill="#f8fafc" />
        {COLUMNS.map((c, i) => (
          <g key={c.key}>
            {i > 0 && <line x1={c.x0} x2={c.x0} y1={rowTop} y2={rowBottom} stroke="#e2e8f0" />}
            <text x={c.x0 + 14} y={rowTop + 24} fontSize="11" letterSpacing="1.2" fill="#64748b" fontWeight="600">
              {c.head.toUpperCase()}
            </text>
            <text x={c.x0 + 14} y={rowTop + 56} fontSize="17" fill="#0f172a" fontWeight="600">
              {c.value}
            </text>
            <rect x={c.x0 + 14} y={rowBottom - 8} width={Math.min(c.x1 - c.x0 - 28, 60)} height="3" rx="1.5" fill={c.color} />
          </g>
        ))}
        <line x1="56" x2="944" y1={rowTop + 34} y2={rowTop + 34} stroke="#e2e8f0" />

        {/* The streams */}
        {ARTIFACTS.map((a, ai) =>
          a.from.map((f) => {
            const c = col(f)
            const sx = (c.x0 + c.x1) / 2
            const tx = xs[ai]
            const d = `M${sx} ${rowBottom + 4} C${sx} ${rowBottom + 90}, ${tx} ${iconY - 110}, ${tx} ${iconY - 30}`
            const k = n++
            return (
              <path
                key={`${a.label}-${f}`}
                d={d}
                fill="none"
                stroke={c.color}
                strokeWidth="2"
                strokeOpacity="0.75"
                pathLength={1}
                style={reduced ? undefined : { strokeDasharray: 1, strokeDashoffset: 1, animation: `hiw-draw 1.1s cubic-bezier(0.4,0,0.2,1) ${0.3 + k * 0.08}s forwards` }}
              />
            )
          }),
        )}

        {/* What they become */}
        {ARTIFACTS.map((a, i) => (
          <g key={a.label} style={reduced ? undefined : { animation: `hiw-pop 0.5s ease ${1.1 + i * 0.08}s both` }}>
            <circle cx={xs[i]} cy={iconY} r="28" fill="#0a0e26" stroke="rgba(165,180,252,0.4)" />
            <g transform={`translate(${xs[i]} ${iconY})`}>{a.icon('#eef0ff')}</g>
            <text x={xs[i]} y={iconY + 52} fontSize="14" textAnchor="middle" fill="#b9c0e8">
              {a.label}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  )
}
