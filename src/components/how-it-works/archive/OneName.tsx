/**
 * Section 2, "One name, one band": the marquee changes, the person doesn't.
 *
 * Brian Setzer is billed four ways across the archive; public/data/artist-aliases.json (sameAct)
 * folds them into one artist. Stray Cats share a member with him but are a band of their own, so
 * they're kept apart on purpose (sharesMember). Counts and years come from concerts.json, live.
 */
import { useMediaQuery } from '../shared'
import { useAliases, useConcerts } from './data'

const BAND = '#8b5cf6'
const PINK = '#f472b6'

interface Billing {
  slug: string
  name: string
  shows: number
  first: number
  last: number
}

export function OneName() {
  const narrow = useMediaQuery('(max-width: 640px)')
  const concerts = useConcerts()
  const aliases = useAliases()

  if (concerts === null || aliases === null) {
    return (
      <figure className="hiw-figure p-6">
        <p className="hiw-figcaption">The archive’s data didn’t load just now, so this example can’t show. Try reloading the page.</p>
      </figure>
    )
  }

  const group = aliases?.sameAct.find((g) => g.canonical === 'brian-setzer')
  const apart = aliases?.sharesMember.find((s) => s.acts.includes('brian-setzer') && s.acts.includes('stray-cats'))

  const billingOf = (slug: string): Billing | null => {
    const rows = (concerts ?? []).filter((c) => c.headlinerNormalized === slug)
    if (!rows.length) return null
    const years = rows.map((r) => r.year)
    return { slug, name: rows[0].headliner, shows: rows.length, first: Math.min(...years), last: Math.max(...years) }
  }
  const billings = (group?.billings ?? []).map(billingOf).filter((b): b is Billing => !!b).sort((a, b) => a.first - b.first)
  const stray = billingOf('stray-cats')
  const total = billings.reduce((n, b) => n + b.shows, 0)
  const first = Math.min(...billings.map((b) => b.first))
  const last = Math.max(...billings.map((b) => b.last))

  // Geometry: billings on the left, the one artist on the right, Stray Cats below, kept apart.
  const W = 1000
  const rowH = narrow ? 120 : 64
  const top = narrow ? 30 : 30
  const strayH = narrow ? 120 : 62
  const leftX = narrow ? 30 : 40
  const leftW = narrow ? 840 : 380
  const rightX = narrow ? 30 : 620
  const rightW = narrow ? 940 : 340
  const fs = narrow ? 30 : 15
  const midY = top + (billings.length * rowH) / 2
  const oneY = narrow ? top + billings.length * rowH + 70 : midY - 46
  const oneH = narrow ? 170 : 92
  const strayY = narrow ? oneY + oneH + 50 : top + billings.length * rowH + 30
  const H = strayY + strayH + 20
  const bracketX = leftX + leftW + 60

  return (
    <figure className="hiw-figure" aria-labelledby="on-cap">
      <svg className="hiw-svg block w-full" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${billings.map((b) => b.name).join(', ')}: four billings that become one artist, ${group?.name}, ${total} shows from ${first} to ${last}. Stray Cats share a member but are kept as a separate band.`}>
        {billings.map((b, i) => {
          const y = top + i * rowH + rowH / 2
          const x2 = narrow ? W / 2 : rightX
          const y2 = narrow ? oneY : oneY + oneH / 2
          return (
            <g key={b.slug}>
              <path
                d={narrow ? `M${leftX + leftW} ${y} L${bracketX} ${y}` : `M${leftX + leftW} ${y} C${leftX + leftW + 120} ${y}, ${x2 - 120} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={BAND}
                strokeOpacity="0.6"
                strokeWidth={narrow ? 3 : 1.8}
              />
              <rect x={leftX} y={y - rowH / 2 + 8} width={leftW} height={rowH - 16} rx="12" fill="#0a0e26" stroke="rgba(165,180,252,0.3)" />
              <text x={leftX + 18} y={y - (narrow ? 4 : 0) + fs * 0.1} fontSize={fs} fill="#eef0ff" fontWeight="600" dominantBaseline="middle">
                {b.name}
              </text>
              <text
                x={narrow ? leftX + 18 : leftX + leftW - 16}
                y={narrow ? y + fs * 1.1 : y + fs * 0.1}
                fontSize={fs * 0.85}
                fill="#8189b5"
                textAnchor={narrow ? 'start' : 'end'}
                dominantBaseline="middle"
              >
                {b.shows === 1 ? `1 show, ${b.first}` : `${b.shows} shows, ${b.first}–${b.last}`}
              </text>
            </g>
          )
        })}

        {/* On a phone the billings join with a bracket down the right-hand side */}
        {narrow && billings.length > 0 && (
          <path
            d={`M${bracketX} ${top + rowH / 2} L${bracketX} ${oneY}`}
            fill="none"
            stroke={BAND}
            strokeOpacity="0.6"
            strokeWidth="3"
          />
        )}

        {/* The one artist */}
        <rect x={rightX} y={oneY} width={rightW} height={oneH} rx="16" fill="rgba(139,92,246,0.16)" stroke={BAND} strokeWidth="2" />
        <text x={rightX + 22} y={oneY + oneH * 0.42} fontSize={fs * 1.45} fill="#fff" fontWeight="700" className="serif">
          {group?.name ?? '…'}
        </text>
        <text x={rightX + 22} y={oneY + oneH * 0.76} fontSize={fs * 0.95} fill="#c4b5fd">
          {total ? `${total} shows, ${first}–${last}. One artist.` : ''}
        </text>

        {/* Kept apart */}
        {stray && (
          <g>
            <line
              x1={rightX + rightW / 2}
              x2={rightX + rightW / 2}
              y1={oneY + oneH}
              y2={strayY}
              stroke={PINK}
              strokeOpacity="0.7"
              strokeDasharray="5 6"
              strokeWidth={narrow ? 3 : 1.6}
            />
            <rect x={rightX} y={strayY} width={rightW} height={strayH} rx="12" fill="#0a0e26" stroke="rgba(244,114,182,0.5)" strokeDasharray="5 5" />
            <text x={rightX + 18} y={strayY + (narrow ? 48 : 27)} fontSize={fs} fill="#eef0ff" fontWeight="600">
              Stray Cats
            </text>
            <text x={rightX + 18} y={strayY + (narrow ? 92 : 48)} fontSize={fs * 0.85} fill="#f9a8d4">
              Shares a member. A different band.
            </text>
          </g>
        )}
      </svg>
      <figcaption id="on-cap" className="hiw-figcaption px-4 sm:px-6 pb-5 pt-2">
        {group?.note ?? ''} {apart?.note ?? ''}
      </figcaption>
    </figure>
  )
}
