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

const SUGGESTIONS = [
  'Tell me about Depeche Mode',
  'What shows did you see in 1998?',
  'Tell me about Irvine Meadows',
  'Surprise me with a show',
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

        {exchanges.length === 0 && hasSession && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => submit(s)} className="chip" style={{ cursor: 'pointer', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.16)', color: 'rgba(255,255,255,.82)', borderRadius: 999, padding: '8px 15px', fontSize: 13 }}>
                {s}
              </button>
            ))}
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
