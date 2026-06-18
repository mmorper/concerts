// Dev-only harness for the #140 exhibit layer (mounted via ?ask=dev). NOT shipped UI — the real
// containers (Spotlight overlay + /ask canvas) are #141. This exists to exercise the exhibit
// components against the live chat worker before those containers exist.
//
// Session: paste a token from `node workers/ask-chat/scripts/mint-dev-session.mjs "<HMAC>"`
// (Turnstile is #141). Backend base: set VITE_ASK_BASE_URL=http://localhost:8799 for local dev.

import { useEffect, useRef, useState } from 'react'
import { useAskArchive } from '@/hooks/useAskArchive'
import { useArchiveData } from '@/hooks/useArchiveData'
import { getSessionToken, setSessionToken, getStatus } from '@/services/askArchive'
import { AskExhibit } from './AskExhibit'

// One prompt per category — covers every exhibit kind plus the two grounding cases the
// pressure test flagged (Irvine Meadows = tool-skip; Peter = disambiguation never fired).
const BATTERY: { label: string; q: string }[] = [
  { label: 'Artist', q: 'Tell me about Depeche Mode' },
  { label: 'Artist · not in archive', q: 'Tell me about Taylor Swift' },
  { label: 'Venue', q: 'Tell me about Irvine Meadows' },
  { label: 'Venue · one-show', q: 'Tell me about the Greek Theatre' },
  { label: 'List · year', q: 'What shows did you see in 1998?' },
  { label: 'List · genre', q: 'Show me your punk shows' },
  { label: 'On this day', q: 'What concerts happened on June 4?' },
  { label: 'Disambiguation', q: 'I\'m looking for Peter, the band' },
  { label: 'Serendipity', q: 'Surprise me with a show' },
  { label: 'Top songs', q: 'What songs have you heard most often?' },
  { label: 'Off-topic', q: 'Write me a python function' },
]

export function AskDevHarness() {
  const archive = useArchiveData()
  const { exchanges, busy, ask } = useAskArchive()
  const [input, setInput] = useState('')
  const [hasSession, setHasSession] = useState(!!getSessionToken())
  const [mode, setMode] = useState<string>('…')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getStatus().then((s) => setMode(s?.mode ?? 'unreachable'))
  }, [])
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [exchanges])

  const submit = (q: string) => {
    if (!q.trim() || busy) return
    setInput('')
    ask(q)
  }

  // Fire every category prompt in sequence so all card kinds stack for a visual/UX audit.
  const runBattery = async () => {
    if (busy) return
    for (const { q } of BATTERY) {
      await ask(q)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0c0a1f 0%,#1a103a 100%)', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px 140px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: mode === 'on' ? '#34d399' : '#f59e0b' }} />
          <strong style={{ letterSpacing: '0.04em' }}>Ask the Archive</strong>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', marginLeft: 'auto' }}>#140 dev harness · backend: {mode}</span>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 24 }}>
          Exhibit-rendering only. Containers &amp; Turnstile are #141.
        </p>

        {!hasSession && <SessionGate onSet={() => setHasSession(true)} />}

        {hasSession && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <button
                onClick={runBattery}
                disabled={busy}
                style={{ background: busy ? 'rgba(255,255,255,.15)' : 'rgba(52,211,153,.18)', border: '1px solid rgba(52,211,153,.5)', color: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: busy ? 'default' : 'pointer' }}
              >
                ▶ Run full battery ({BATTERY.length})
              </button>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>every category, in order — for the design/UX audit</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {BATTERY.map((b) => (
                <button key={b.label} onClick={() => submit(b.q)} disabled={busy} title={b.q} className="chip" style={{ cursor: busy ? 'default' : 'pointer', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', color: 'rgba(255,255,255,.7)', borderRadius: 999, padding: '6px 13px', fontSize: 12.5 }}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {exchanges.map((ex) => (
          <div key={ex.id}>
            <div className="ask-q">
              <span className="you">You</span>
              <span className="q">&ldquo;{ex.question}&rdquo;</span>
            </div>
            {archive.loading ? <div style={{ opacity: 0.5, marginBottom: 24 }}>loading archive…</div> : <AskExhibit exchange={ex} archive={archive} />}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {hasSession && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: 16, background: 'linear-gradient(to top, #0c0a1f 60%, transparent)' }}>
          <form
            onSubmit={(e) => { e.preventDefault(); submit(input) }}
            style={{ maxWidth: 680, margin: '0 auto', display: 'flex', gap: 8, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 14, padding: 6 }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Ask about a band, a venue, a year… or "surprise me"'
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 15, padding: '8px 12px' }}
            />
            <button type="submit" disabled={busy} style={{ background: busy ? 'rgba(255,255,255,.2)' : '#fff', color: '#111', border: 'none', borderRadius: 10, width: 40, fontSize: 18, cursor: busy ? 'default' : 'pointer' }}>↑</button>
          </form>
        </div>
      )}
    </div>
  )
}

function SessionGate({ onSet }: { onSet: () => void }) {
  const [token, setToken] = useState('')
  return (
    <div style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
      <div style={{ fontSize: 14, marginBottom: 8 }}>Paste a dev session token to begin:</div>
      <code style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', display: 'block', marginBottom: 10 }}>node workers/ask-chat/scripts/mint-dev-session.mjs &quot;&lt;SESSION_HMAC_KEY&gt;&quot;</code>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="paste token…" style={{ flex: 1, background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 8, color: '#fff', padding: '8px 12px', fontSize: 13 }} />
        <button onClick={() => { if (token.trim()) { setSessionToken(token.trim()); onSet() } }} style={{ background: '#fff', color: '#111', border: 'none', borderRadius: 8, padding: '0 16px', cursor: 'pointer' }}>Set</button>
      </div>
    </div>
  )
}
