/**
 * "Facts you can ask about": once each night is a set of labelled facts, they can be asked about.
 * Ask the Archive (workers/ask-chat) and the Claude connector (workers/mcp-server) both read the
 * same published files the weekly update writes, so the answers come from these facts.
 *
 * Each card shows a question, the fact that answers it (looked up here, live, from the same
 * files), and a button that asks Ask the Archive for real.
 */
import { analytics } from '../../../services/analytics'
import { useAsk } from '../../ask/AskProvider'
import type { Ledger } from './facts'
import { useJson, useNearView } from './data'

interface MostPlayed {
  songs: { name: string; count: number; artists: string[] }[]
}

export function AskStep({ ledger }: { ledger?: Ledger }) {
  const [ref, near] = useNearView<HTMLElement>()
  const most = useJson<MostPlayed>('/data/most-played-songs.json', near)
  const { openSpotlight } = useAsk()

  const c = ledger?.concert
  const band = c?.headliner ?? 'Social Distortion'
  const nights = ledger?.seen
  const top = most?.songs?.[0]
  const tied = top ? most!.songs.filter((x) => x.count === top.count) : []
  const mostLine = !top ? '…' : tied.length === 1 ? `“${top.name}”, ${top.count} times` : tied.length === 2 ? `“${tied[0].name}” and “${tied[1].name}”, ${top.count} times each` : `“${tied[0].name}”, “${tied[1].name}” and ${tied.length - 2} more, ${top.count} times each`
  const mostBy = [...new Set(tied.flatMap((x) => x.artists))].join(', ')

  const cards = [
    {
      id: 'opener',
      q: `What did ${band} open with at ${c?.venue ?? 'The Belasco'} in ${c?.year ?? 2024}?`,
      a: ledger?.firstSong ? `“${ledger.firstSong}”` : '…',
      from: ledger ? `Step 6 · the setlist, song 1 of ${ledger.songs}` : 'Step 6 · the setlist',
    },
    {
      id: 'times-seen',
      q: `How many times have you seen ${band}?`,
      a: nights === undefined ? '…' : `${nights} ${nights === 1 ? 'night' : 'nights'}`,
      from: 'Step 2 · every row linked to one band page',
    },
    {
      id: 'most-heard',
      q: 'Which songs have you heard live the most?',
      a: mostLine,
      from: top ? `Step 6 · every setlist, counted · ${mostBy}` : 'Step 6 · every setlist, counted',
    },
  ]

  return (
    <figure ref={ref} className="hiw-figure" aria-labelledby="ask-cap">
      <ul className="grid gap-3 md:grid-cols-3 p-4 sm:p-6" style={{ listStyle: 'none' }}>
        {cards.map((k) => (
          <li key={k.id} className="hiw-hood p-4 flex flex-col gap-3">
            <p className="font-sans" style={{ fontSize: 16, color: 'var(--hiw-ink)', fontWeight: 600, lineHeight: 1.4 }}>
              {k.q}
            </p>
            <div className="mt-auto">
              <div className="hiw-step" style={{ fontSize: 10.5, color: 'var(--hiw-ink-3)' }}>
                The fact that answers it
              </div>
              <div className="font-sans mt-1" style={{ fontSize: 17, color: 'var(--hiw-dot)', fontWeight: 600 }}>
                {k.a}
              </div>
              <div className="font-sans mt-0.5" style={{ fontSize: 13, color: 'var(--hiw-ink-3)' }}>
                {k.from}
              </div>
            </div>
            <button
              type="button"
              className="hiw-chip self-start"
              onClick={() => {
                analytics.trackEvent('how_it_works_example_selected', { chapter: 'the-archive', example: k.id, surface: 'ask' })
                openSpotlight('how_it_works', k.q)
              }}
            >
              Ask it for real →
            </button>
          </li>
        ))}
      </ul>
      <figcaption id="ask-cap" className="hiw-figcaption px-4 sm:px-6 pb-5">
        The answers on the cards are looked up live from the archive’s files. “Ask it for real” sends the question to Ask
        the Archive.
      </figcaption>
    </figure>
  )
}
