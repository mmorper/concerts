import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CascadeLanes } from './CascadeLanes'
import { CascadeAtom } from './CascadeAtom'
import { ServiceGatewayPeer, CodeTransform, FlowArrow, API_BRANDS, PillGrid } from './CascadeApiEngine'
import { useCascadeFocus } from './useCascadeFocus'

// ─── Hardcoded demo data: Depeche Mode / Kia Forum / 2023-03-28 (concert-158) ──

const DEMO = {
  date: '2023-03-28',
  venue: 'Kia Forum',
  artist: 'Depeche Mode',
  year: 2023,
  month: 3,
  day: 28,
  dayOfWeek: 'Tuesday',
  decade: '2020s',
  venueNormalized: 'kia-forum',
  headlinerNormalized: 'depeche-mode',
  city: 'Inglewood',
  state: 'California',
  cityState: 'Inglewood, California',
  concertId: 'concert-158',
  lat: 33.9580853,
  lng: -118.3420621,
  tour: 'Memento Mori',
  opener: 'Kelly Lee Owens',
  setlist: [
    'My Cosmos Is Mine',
    'Wagging Tongue',
    'Walking in My Shoes',
    "It's No Good",
    'Policy of Truth',
    'In Your Room',
    'Everything Counts',
    'Precious',
    'My Favourite Stranger',
    'Home',
    'Dressed in Black',
    'Ghosts Again',
    'I Feel You',
    'A Pain That I\'m Used To',
    'World in My Eyes',
    'Black Celebration',
    'Stripped',
    'John the Revelator',
    'Enjoy the Silence',
    'Condemnation',
    'Just Can\'t Get Enough',
    'Never Let Me Down Again',
    'Personal Jesus',
  ],
  topTracks: [
    { name: 'Enjoy the Silence', album: 'Violator (Deluxe)' },
    { name: 'Personal Jesus', album: 'Violator (Deluxe)' },
    { name: 'Policy of Truth', album: 'Violator (Deluxe)' },
    { name: "Just Can't Get Enough", album: 'Speak and Spell (Deluxe)' },
    { name: 'Universal Soldier', album: 'HELP(2)' },
  ],
}

// ─── Tier color palette ──────────────────────────────────────────────────────

const TIER_COLORS = {
  t0: { label: '#4b5563', title: '#9ca3af', sub: '#6b7280' },
  t1: { label: '#64748b', title: '#cbd5e1', sub: '#94a3b8', accent: '#64748b' },
  t2: { label: '#6366f1', title: '#e0e7ff', sub: '#a5b4fc', accent: '#6366f1' },
  t3: { label: '#8b5cf6', title: '#ede9fe', sub: '#c4b5fd', accent: '#8b5cf6' },
  t4: { label: '#a855f7', title: '#faf5ff', sub: '#d8b4fe', accent: '#a855f7' },
  t5: { label: '#c084fc', title: '#ffffff', sub: '#e9d5ff', accent: '#c084fc' },
}

// ─── Shared styles ───────────────────────────────────────────────────────────

const TIER_ROW_STYLE: React.CSSProperties = {
  position: 'relative',
  zIndex: 2,
  padding: '80px 24px 48px',
  transition: 'opacity 0.5s ease, filter 0.5s ease',
}

const TIER_HEADER_STYLE: React.CSSProperties = {
  gridColumn: '1 / -1',
  textAlign: 'center',
  marginBottom: 20,
}

const TIER_FOOTER_STYLE: React.CSSProperties = {
  gridColumn: '1 / -1',
  textAlign: 'center',
  marginTop: 20,
}

const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" }
const PLAYFAIR: React.CSSProperties = { fontFamily: "'Playfair Display', serif" }
const SANS: React.CSSProperties = { fontFamily: "'Source Sans 3', sans-serif" }

function TierLabel({ color, text }: { color: string; text: string }) {
  return (
    <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color, marginBottom: 8 }}>
      {text}
    </div>
  )
}

function TierTitle({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ ...PLAYFAIR, fontSize: 26, fontWeight: 700, color, lineHeight: 1.2, marginBottom: 4 }}>
      {children}
    </div>
  )
}

function TierSubtitle({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ ...SANS, fontSize: 14, fontWeight: 300, color, lineHeight: 1.5 }}>
      {children}
    </div>
  )
}


function tierDimStyle(isRelevant: boolean): React.CSSProperties {
  return isRelevant ? {} : { opacity: 0.12, filter: 'grayscale(0.5)' }
}

// ─── Tier signature helpers ───────────────────────────────────────────────────

function TierBand({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: `${color}0d`,
      border: `1px solid ${color}28`,
      borderRadius: 8,
      padding: '14px 12px',
    }}>
      {children}
    </div>
  )
}

function ApiBadge({ name, domain, color }: { name: string; domain: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
        width={14} height={14}
        style={{ borderRadius: 2 }}
        alt=""
      />
      <span style={{ ...MONO, fontSize: 9, color, letterSpacing: '0.05em' }}>{name}</span>
    </div>
  )
}

function CorpusScale({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ ...MONO, fontSize: 9, color: `${color}55`, textAlign: 'center', marginTop: 10, letterSpacing: '0.05em' }}>
      {children}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function CascadePage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { focusedAtom, focusAtom, resetFocus, isTierRelevant } = useCascadeFocus()
  const [activeScene, setActiveScene] = useState<string | null>(null)

  // Global CSS sets body { overflow: hidden } for the snap-scroll main app.
  // Restore scrollability for this standalone page, and set matching background.
  useEffect(() => {
    document.body.style.overflow = 'auto'
    document.body.style.background = '#0a0a0f'
    return () => {
      document.body.style.overflow = 'hidden'
      document.body.style.background = ''
    }
  }, [])

  const fadeUp = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: 'easeOut', delay },
  })

  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh', color: '#fff' }}>
      <div
        ref={containerRef}
        style={{ maxWidth: 900, margin: '0 auto', position: 'relative' }}
      >
        {/* SVG fluid lanes */}
        <CascadeLanes
          containerRef={containerRef as React.RefObject<HTMLElement | null>}
          focusedAtom={focusedAtom}
        />

        {/* ── HEADER ── */}
        <motion.header
          {...fadeUp(0.2)}
          style={{ textAlign: 'center', padding: '80px 40px 40px', position: 'relative', zIndex: 2 }}
        >
          <div style={{ ...MONO, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 24 }}>
            Morperhaus Concert Archives
          </div>
          <h1 style={{ ...PLAYFAIR, fontSize: 48, fontWeight: 900, lineHeight: 1.1, marginBottom: 20 }}>
            The Data<br />
            <span
              style={{
                background: 'linear-gradient(135deg, #c084fc, #6366f1)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Enrichment Cascade
            </span>
          </h1>
          <p style={{ ...SANS, fontSize: 18, color: '#94a3b8', fontWeight: 300, maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
            How three words in a spreadsheet become a living archive of four decades of live music
          </p>
        </motion.header>

        {/* ── TIER 0 — THREE ATOMS ── */}
        <motion.div
          id="cascade-tier-0"
          {...fadeUp(0.8)}
          style={{
            ...TIER_ROW_STYLE,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16,
            alignItems: 'start',
            ...tierDimStyle(isTierRelevant(0)),
          }}
        >
          <div style={TIER_HEADER_STYLE}>
            <TierLabel color={TIER_COLORS.t0.label} text="Tier 0 · The Source" />
            <TierTitle color={TIER_COLORS.t0.title}>Three Atoms</TierTitle>
            <TierSubtitle color={TIER_COLORS.t0.sub}>One row in a spreadsheet. That's the whole input.</TierSubtitle>
          </div>

          <CascadeAtom type="artist" value={DEMO.artist} focusedAtom={focusedAtom} onFocus={focusAtom} />
          <CascadeAtom type="venue" value={DEMO.venue} focusedAtom={focusedAtom} onFocus={focusAtom} />
          <CascadeAtom type="date" value={DEMO.date} focusedAtom={focusedAtom} onFocus={focusAtom} />

          <div
            style={{
              gridColumn: '1 / -1',
              ...MONO,
              fontSize: 9,
              color: '#374151',
              textAlign: 'center',
              marginTop: 8,
              letterSpacing: '0.1em',
              transition: 'opacity 0.4s ease',
              opacity: focusedAtom ? 0 : 1,
            }}
          >
            click an atom to trace its journey ↓
          </div>
          <div style={{ gridColumn: '1 / -1', ...MONO, fontSize: 12, color: '#4b5563', textAlign: 'center' }}>
            180 concerts × 3 fields ={' '}
            <span style={{ color: '#6b7280' }}>540 total inputs</span>
          </div>
        </motion.div>

        {/* ── TIER 1 — BUILD PIPELINE ── */}
        <motion.div
          id="cascade-tier-1"
          {...fadeUp(1.1)}
          style={{
            ...TIER_ROW_STYLE,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16,
            alignItems: 'start',
            ...tierDimStyle(isTierRelevant(1)),
          }}
        >
          <div style={TIER_HEADER_STYLE}>
            <TierLabel color={TIER_COLORS.t1.label} text="Tier 1 · Structural Enrichment" />
            <TierTitle color={TIER_COLORS.t1.title}>The Build Pipeline</TierTitle>
            <TierSubtitle color={TIER_COLORS.t1.sub}>Parse, normalize, derive. No APIs — just code.</TierSubtitle>
          </div>

          {/* Artist lane */}
          <div>
            <CodeTransform fn="derive(artist)" description="normalize + assign ID" />
            <PillGrid tierColor="#8b5cf6" items={[
              { key: 'headlinerNormalized', value: '"depeche-mode"' },
              { key: 'id', value: '"concert-158"' },
              { key: 'openers', value: '["Kelly Lee Owens"]' },
            ]} />
          </div>

          {/* Venue lane */}
          <div>
            <CodeTransform fn="normalize(venue)" description="slug + location lookup" />
            <PillGrid tierColor="#6366f1" items={[
              { key: 'venueNormalized', value: '"kia-forum"' },
              { key: 'city', value: '"Inglewood"' },
              { key: 'state', value: '"California"' },
              { key: 'cityState', value: '"Inglewood, CA"' },
            ]} />
          </div>

          {/* Date lane */}
          <div>
            <CodeTransform fn="parse(date)" description="extract temporal fields" />
            <PillGrid tierColor="#64748b" items={[
              { key: 'year', value: '2023' },
              { key: 'month', value: '3' },
              { key: 'day', value: '28' },
              { key: 'dayOfWeek', value: '"Tuesday"' },
              { key: 'decade', value: '"2020s"' },
            ]} />
          </div>

          <div style={TIER_FOOTER_STYLE}>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ ...PLAYFAIR, fontWeight: 700, fontSize: 32, lineHeight: 1, color: '#94a3b8' }}>19</span>
              <span style={{ ...SANS, fontSize: 13, fontWeight: 300, color: '#64748b' }}>fields per concert</span>
            </div>
          </div>
        </motion.div>

        {/* ── TIER 2 — GEOGRAPHIC (venue lane wide) ── */}
        <motion.div
          id="cascade-tier-2"
          {...fadeUp(1.5)}
          style={{
            ...TIER_ROW_STYLE,
            display: 'grid',
            gridTemplateColumns: '0.6fr 2.4fr 0.6fr',
            gap: 12,
            alignItems: 'start',
            ...tierDimStyle(isTierRelevant(2)),
          }}
        >
          <div style={TIER_HEADER_STYLE}>
            <TierLabel color={TIER_COLORS.t2.label} text="Tier 2 · Geographic Enrichment" />
            <TierTitle color={TIER_COLORS.t2.title}>Every Venue, Precisely Placed</TierTitle>
            <TierSubtitle color={TIER_COLORS.t2.sub}>Structural data becomes geographic intelligence.</TierSubtitle>
          </div>

          {/* Artist — dormant */}
          <div style={{ minHeight: 60 }} />

          {/* Venue — active */}
          <TierBand color="#6366f1">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <ApiBadge name="Google Places" domain="google.com" color="#4285F4" />
            </div>
            {/* Venue photo placeholder */}
            <div style={{
              width: '100%', height: 56,
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 10, fontSize: 24,
            }}>
              📍
            </div>
            {/* Coordinate pill */}
            <div style={{
              ...MONO, fontSize: 9, textAlign: 'center', color: '#a5b4fc',
              marginBottom: 10, background: 'rgba(99,102,241,0.1)',
              padding: '4px 8px', borderRadius: 3, letterSpacing: '0.02em',
            }}>
              {DEMO.lat.toFixed(4)}° N · {Math.abs(DEMO.lng).toFixed(4)}° W
            </div>
            <PillGrid tierColor="#6366f1" items={[
              { key: 'formattedAddress', value: '3900 W Manchester Blvd' },
              { key: 'placeId', value: 'ChIJO...', icon: 'id' },
              { key: 'confirmedName', value: '"Kia Forum"' },
              { key: 'types', value: '"stadium"' },
              { key: 'website', value: 'kiaforum.com', icon: 'link' },
              { key: 'photos', value: '3 sizes', icon: 'image' },
            ]} />
            <CorpusScale color="#6366f1">× 77 venues · 35 cities</CorpusScale>
          </TierBand>

          {/* Date — dormant */}
          <div style={{ minHeight: 60 }} />
        </motion.div>

        {/* ── TIER 3 — ARTIST IDENTITY (artist lane wide) ── */}
        <motion.div
          id="cascade-tier-3"
          {...fadeUp(1.9)}
          style={{
            ...TIER_ROW_STYLE,
            display: 'grid',
            gridTemplateColumns: '2.4fr 0.6fr 0.6fr',
            gap: 12,
            alignItems: 'start',
            ...tierDimStyle(isTierRelevant(3)),
          }}
        >
          <div style={TIER_HEADER_STYLE}>
            <TierLabel color={TIER_COLORS.t3.label} text="Tier 3 · Artist Enrichment" />
            <TierTitle color={TIER_COLORS.t3.title}>A Face and a Story</TierTitle>
            <TierSubtitle color={TIER_COLORS.t3.sub}>A name becomes a profile. Three services, one identity.</TierSubtitle>
          </div>

          {/* Artist — active */}
          <TierBand color="#8b5cf6">
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              <ApiBadge name="TheAudioDB" domain="theaudiodb.com" color="#1DA0C3" />
              <ApiBadge name="Last.fm" domain="last.fm" color="#D51007" />
              <ApiBadge name="MusicBrainz" domain="musicbrainz.org" color="#BA478F" />
            </div>
            {/* Artist avatar */}
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: 'rgba(139,92,246,0.18)',
              border: '1px solid rgba(139,92,246,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 10px',
              ...MONO, fontSize: 15, color: '#c4b5fd', letterSpacing: '0.05em',
            }}>
              DM
            </div>
            {/* Genre chips */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 }}>
              {['synth-pop', 'electronic', 'new wave'].map(g => (
                <span key={g} style={{
                  ...MONO, fontSize: 7, padding: '2px 6px', borderRadius: 2,
                  background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
                  color: '#c4b5fd', letterSpacing: '0.04em',
                }}>{g}</span>
              ))}
            </div>
            <div style={{ ...MONO, fontSize: 8, color: '#8b5cf680', textAlign: 'center', marginBottom: 8, lineHeight: 1.6 }}>
              Formed 1980 · Basildon, UK · 12.4M listeners
            </div>
            <div style={{ ...SANS, fontSize: 9, color: '#94a3b8', lineHeight: 1.5, textAlign: 'center', maxHeight: 42, overflow: 'hidden' }}>
              Electronic pioneers known for dark synthesizer-driven sound and iconic global live performances.
            </div>
            <PillGrid tierColor="#8b5cf6" items={[
              { key: 'image', value: 'artist photo', icon: 'image', source: 'TheAudioDB' },
              { key: 'formed', value: '"1980"', source: 'TheAudioDB' },
              { key: 'country', value: '"England"', source: 'TheAudioDB' },
              { key: 'style', value: '"Synth-pop"', source: 'TheAudioDB' },
              { key: 'genres', value: '["New Wave"]', source: 'Last.fm' },
              { key: 'listeners', value: '3.2M', source: 'Last.fm' },
              { key: 'mbid', value: 'canonical ID', icon: 'id', source: 'MusicBrainz' },
            ]} />
            <CorpusScale color="#8b5cf6">× 255 artists enriched</CorpusScale>
          </TierBand>

          {/* Venue — dormant */}
          <div style={{ minHeight: 60 }} />
          {/* Date — dormant */}
          <div style={{ minHeight: 60 }} />
        </motion.div>

        {/* ── TIER 4 — AUDIO (artist lane wide) ── */}
        <motion.div
          id="cascade-tier-4"
          {...fadeUp(2.3)}
          style={{
            ...TIER_ROW_STYLE,
            display: 'grid',
            gridTemplateColumns: '2.4fr 0.6fr 0.6fr',
            gap: 12,
            alignItems: 'start',
            ...tierDimStyle(isTierRelevant(4)),
          }}
        >
          <div style={TIER_HEADER_STYLE}>
            <TierLabel color={TIER_COLORS.t4.label} text="Tier 4 · Audio Enrichment" />
            <TierTitle color={TIER_COLORS.t4.title}>Hear Every Artist</TierTitle>
            <TierSubtitle color={TIER_COLORS.t4.sub}>The archive gets a soundtrack.</TierSubtitle>
          </div>

          {/* Artist — active */}
          <TierBand color="#a855f7">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <ApiBadge name="Apple Music" domain="music.apple.com" color="#FC3C44" />
            </div>
            {/* Album art + label */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 6,
                background: 'rgba(168,85,247,0.18)',
                border: '1px solid rgba(168,85,247,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, flexShrink: 0,
              }}>🎵</div>
              <div>
                <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: '#d8b4fe', lineHeight: 1.2 }}>Top tracks</div>
                <div style={{ ...SANS, fontSize: 8, fontWeight: 300, color: '#a855f770', lineHeight: 1.4 }}>
                  Violator · Ultra · Music for the Masses
                </div>
              </div>
            </div>
            {/* Track list */}
            <div>
              {DEMO.topTracks.slice(0, 3).map((t, i) => (
                <div key={t.name} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
                  borderBottom: '1px solid rgba(168,85,247,0.1)',
                }}>
                  <span style={{ ...MONO, fontSize: 8, color: '#a855f740', width: 16, textAlign: 'right', flexShrink: 0 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ ...MONO, fontSize: 9, color: '#d8b4fe', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.name}
                  </span>
                </div>
              ))}
            </div>
            <CorpusScale color="#a855f7">× 255 artists · 1,275 tracks</CorpusScale>
          </TierBand>

          {/* Venue — dormant */}
          <div style={{ minHeight: 60 }} />
          {/* Date — dormant */}
          <div style={{ minHeight: 60 }} />
        </motion.div>

        {/* ── TIER 5 — PERFORMANCE (all lanes reconverge) ── */}
        <motion.div
          id="cascade-tier-5"
          {...fadeUp(2.7)}
          style={{
            ...TIER_ROW_STYLE,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16,
            alignItems: 'start',
            ...tierDimStyle(isTierRelevant(5)),
          }}
        >
          <div style={TIER_HEADER_STYLE}>
            <TierLabel color={TIER_COLORS.t5.label} text="Tier 5 · Performance Enrichment" />
            <TierTitle color={TIER_COLORS.t5.title}>Song by Song, Night by Night</TierTitle>
            <TierSubtitle color={TIER_COLORS.t5.sub}>All three atoms reconverge to find one specific night.</TierSubtitle>
            {/* Thread convergence visual */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
              <svg width="220" height="56" viewBox="0 0 220 56" fill="none">
                <line x1="55" y1="0" x2="110" y2="44" stroke="#8b5cf6" strokeWidth="1.5" />
                <line x1="110" y1="0" x2="110" y2="44" stroke="#6366f1" strokeWidth="1.5" />
                <line x1="165" y1="0" x2="110" y2="44" stroke="#64748b" strokeWidth="1.5" />
                <text x="55" y="10" textAnchor="middle" fill="#8b5cf6" fontSize="8" fontFamily="'JetBrains Mono', monospace" letterSpacing="0.1em">artist</text>
                <text x="110" y="10" textAnchor="middle" fill="#6366f1" fontSize="8" fontFamily="'JetBrains Mono', monospace" letterSpacing="0.1em">venue</text>
                <text x="165" y="10" textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="'JetBrains Mono', monospace" letterSpacing="0.1em">date</text>
                <circle cx="110" cy="48" r="5" fill="#7c3aed" opacity="0.9" />
                <circle cx="110" cy="48" r="9" stroke="#7c3aed" strokeWidth="1" opacity="0.25" />
              </svg>
            </div>
          </div>

          {/* Spans all 3 columns */}
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ maxWidth: 540, margin: '0 auto' }}>
              {/* Equation header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                {[
                  { label: 'artist', value: DEMO.artist, color: '#8b5cf6' },
                  { label: '+', value: '', color: '#4b5563' },
                  { label: 'venue', value: DEMO.venue, color: '#6366f1' },
                  { label: '+', value: '', color: '#4b5563' },
                  { label: 'date', value: DEMO.date, color: '#64748b' },
                  { label: '=', value: '', color: '#4b5563' },
                  { label: '', value: 'one specific night', color: '#c084fc' },
                ].map((item, i) => (
                  item.label === '+' || item.label === '=' ? (
                    <span key={i} style={{ ...MONO, fontSize: 12, color: item.color }}>{item.label}</span>
                  ) : (
                    <div key={i} style={{
                      ...MONO,
                      fontSize: item.label === '' ? 11 : 10,
                      fontWeight: item.label === '' ? 700 : 400,
                      padding: '4px 10px',
                      borderRadius: 4,
                      background: `${item.color}12`,
                      border: `1px solid ${item.color}35`,
                      color: item.color,
                      textAlign: 'center',
                    }}>
                      {item.label && <span style={{ fontSize: 7, display: 'block', opacity: 0.5, letterSpacing: '0.1em', marginBottom: 1 }}>{item.label}</span>}
                      {item.value}
                    </div>
                  )
                ))}
              </div>

              <FlowArrow label="query" />

              {/* Side-by-side peer gateways */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <ServiceGatewayPeer svc={{ name: 'setlist.fm', type: 'Historical setlists' }} />
                <ServiceGatewayPeer svc={{ name: 'Ticketmaster', type: 'Tour dates' }} />
              </div>

              <FlowArrow label="response" />

              {/* Per-service outputs — metadata pills */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                <PillGrid
                  tierColor={API_BRANDS['setlist.fm'].primary}
                  items={[
                    { key: 'tourName', value: `"${DEMO.tour}"` },
                    { key: 'songs', value: `${DEMO.setlist.length} tracks` },
                    { key: 'setStructure', value: 'Set 1 + Encore' },
                    { key: 'setBreaks', value: 'positions noted' },
                  ]}
                />
                <PillGrid
                  tierColor={API_BRANDS['Ticketmaster'].primary}
                  items={[
                    { key: 'opener', value: `"${DEMO.opener}"` },
                    { key: 'tour', value: `"${DEMO.tour} Tour"` },
                    { key: 'eventId', value: 'TM canonical ID', icon: 'id' },
                    { key: 'eventUrl', value: 'ticketmaster.com/…', icon: 'link' },
                  ]}
                />
              </div>

              {/* Numbered setlist */}
              <div style={{ marginTop: 16 }}>
                <div style={{ ...MONO, fontSize: 8, letterSpacing: '0.15em', color: '#7c3aed', marginBottom: 8, textAlign: 'center' }}>
                  SETLIST — {DEMO.date}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
                  {DEMO.setlist.map((song, i) => (
                    <div key={song} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '3px 0', borderBottom: '1px solid rgba(124,58,237,0.08)' }}>
                      <span style={{ ...MONO, fontSize: 8, color: '#7c3aed55', width: 18, textAlign: 'right', flexShrink: 0 }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span style={{ ...MONO, fontSize: 9, color: '#c4b5fd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {song}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={TIER_FOOTER_STYLE}>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ ...PLAYFAIR, fontWeight: 700, fontSize: 32, lineHeight: 1, color: '#e9d5ff' }}>~3,240</span>
              <span style={{ ...SANS, fontSize: 13, fontWeight: 300, color: '#d8b4fe' }}>songs across 180 concerts</span>
            </div>
          </div>
        </motion.div>

        {/* ── ASSEMBLY BRIDGE ── */}
        <motion.div
          {...fadeUp(2.9)}
          style={{ textAlign: 'center', padding: '8px 16px 0', position: 'relative', zIndex: 2 }}
        >
          {/* Tier accumulation row */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            {[
              { label: 'T1', count: '3,600', color: '#64748b' },
              { label: 'T2', count: '385', color: '#6366f1' },
              { label: 'T3', count: '1,530', color: '#8b5cf6' },
              { label: 'T4', count: '7,650', color: '#a855f7' },
              { label: 'T5', count: '10,000+', color: '#c084fc' },
            ].map((t, i) => (
              <div key={t.label} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {i > 0 && <span style={{ ...MONO, fontSize: 11, color: '#374151' }}>+</span>}
                <div
                  style={{
                    ...MONO,
                    fontSize: 9,
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: `${t.color}12`,
                    border: `1px solid ${t.color}30`,
                    color: t.color,
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ fontSize: 7, letterSpacing: '0.1em', opacity: 0.7, display: 'block' }}>{t.label}</span>
                  {t.count}
                </div>
              </div>
            ))}
            <span style={{ ...MONO, fontSize: 11, color: '#374151' }}>=</span>
            <div
              style={{
                ...PLAYFAIR,
                fontSize: 22,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #c084fc, #6366f1)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              23,000+
            </div>
          </div>
          <div style={{ ...SANS, fontSize: 11, color: '#374151', marginBottom: 10, fontWeight: 300 }}>
            data points assembled into
          </div>
          {/* Downward arrow into T6 */}
          <svg width="2" height="24" viewBox="0 0 2 24" style={{ display: 'block', margin: '0 auto' }}>
            <line x1="1" y1="0" x2="1" y2="20" stroke="rgba(139,92,246,0.3)" strokeWidth="1.5" />
            <path d="M-3 16 L1 22 L5 16" stroke="rgba(139,92,246,0.4)" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>

        {/* ── TIER 6 — THE OUTPUT ── */}
        {(() => {
          const SCENES = [
            {
              id: 'timeline',
              name: 'Timeline',
              subtitle: '42 years, one axis',
              bg: '#ffffff',
              labelColor: '#1e293b',
              subtitleColor: '#64748b',
              borderColor: 'rgba(0,0,0,0.1)',
              activeBorderColor: 'rgba(99,102,241,0.5)',
              tiers: [
                { label: 'T1', name: 'Structural', color: '#94a3b8', desc: 'parsed dates, computed decade & day-of-week' },
              ],
              icon: (
                <svg width="80" height="40" viewBox="0 0 80 40" fill="none">
                  <line x1="6" y1="20" x2="74" y2="20" stroke="#94a3b8" strokeWidth="1.5" />
                  {[12, 24, 36, 48, 60, 68].map((x, i) => (
                    <circle key={i} cx={x} cy={20} r={i === 3 ? 5 : 3}
                      fill={i === 3 ? '#6366f1' : '#c7d2fe'}
                      stroke={i === 3 ? '#4f46e5' : 'none'} strokeWidth="1.5" />
                  ))}
                </svg>
              ),
            },
            {
              id: 'map',
              name: 'Map',
              subtitle: '77 venues, precisely placed',
              bg: '#111827',
              labelColor: '#f9fafb',
              subtitleColor: '#9ca3af',
              borderColor: 'rgba(99,102,241,0.2)',
              activeBorderColor: 'rgba(99,102,241,0.6)',
              tiers: [
                { label: 'T2', name: 'Geographic', color: '#6366f1', desc: 'lat/lng, address, venue photos from Google Places' },
              ],
              icon: (
                <svg width="80" height="40" viewBox="0 0 80 40" fill="none">
                  {([[20,28],[45,14],[58,22],[32,10],[65,30]] as [number,number][]).map(([x,y], i) => (
                    <g key={i}>
                      <circle cx={x} cy={y} r={i === 1 ? 5 : 3.5}
                        fill={i === 1 ? '#6366f1' : '#4f46e5'} opacity={i === 1 ? 1 : 0.6} />
                      {i === 1 && <circle cx={x} cy={y} r={8} stroke="#6366f1" strokeWidth="1" opacity={0.3} />}
                    </g>
                  ))}
                </svg>
              ),
            },
            {
              id: 'artists',
              name: 'Artists',
              subtitle: '255 artists, fully enriched',
              bg: 'linear-gradient(135deg, #1e1b4b, #581c87)',
              labelColor: '#f5f3ff',
              subtitleColor: '#c4b5fd',
              borderColor: 'rgba(139,92,246,0.25)',
              activeBorderColor: 'rgba(167,139,250,0.7)',
              tiers: [
                { label: 'T1', name: 'Structural', color: '#94a3b8', desc: 'normalized slugs for routing' },
                { label: 'T3', name: 'Artist Identity', color: '#8b5cf6', desc: 'photos, bios, genre tags — TheAudioDB / Last.fm' },
                { label: 'T4', name: 'Audio', color: '#a855f7', desc: '30-sec previews, album art — Deezer / Apple Music' },
                { label: 'T5', name: 'Performance', color: '#ec4899', desc: 'setlists, covers, tour dates — setlist.fm / Ticketmaster' },
              ],
              icon: (
                <svg width="80" height="40" viewBox="0 0 80 40" fill="none">
                  {([[8,6],[30,6],[52,6],[8,22],[30,22],[52,22]] as [number,number][]).map(([x,y], i) => (
                    <rect key={i} x={x} y={y} width="18" height="12" rx="2"
                      fill={(['#7c3aed','#8b5cf6','#a855f7','#6366f1','#7c3aed','#8b5cf6'] as string[])[i]}
                      opacity={0.7 + i * 0.04} />
                  ))}
                </svg>
              ),
            },
            {
              id: 'network',
              name: 'Network',
              subtitle: 'venues & artists, connected',
              bg: 'linear-gradient(135deg, #1e1b4b, #0f172a)',
              labelColor: '#f5f3ff',
              subtitleColor: '#a5b4fc',
              borderColor: 'rgba(99,102,241,0.2)',
              activeBorderColor: 'rgba(99,102,241,0.6)',
              tiers: [
                { label: 'T1', name: 'Structural', color: '#94a3b8', desc: 'venue & artist slugs define graph edges' },
                { label: 'T2', name: 'Geographic', color: '#6366f1', desc: 'lat/lng positions influence node layout' },
              ],
              icon: (
                <svg width="80" height="40" viewBox="0 0 80 40" fill="none">
                  <line x1="20" y1="20" x2="45" y2="10" stroke="#6366f1" strokeWidth="1" opacity="0.5" />
                  <line x1="20" y1="20" x2="55" y2="28" stroke="#6366f1" strokeWidth="1" opacity="0.5" />
                  <line x1="45" y1="10" x2="62" y2="18" stroke="#6366f1" strokeWidth="1" opacity="0.4" />
                  <line x1="55" y1="28" x2="62" y2="18" stroke="#6366f1" strokeWidth="1" opacity="0.4" />
                  <line x1="45" y1="10" x2="55" y2="28" stroke="#ec4899" strokeWidth="1" opacity="0.5" strokeDasharray="3 2" />
                  <circle cx={20} cy={20} r={5} fill="#6366f1" />
                  <circle cx={45} cy={10} r={3.5} fill="#818cf8" />
                  <circle cx={55} cy={28} r={3.5} fill="#818cf8" />
                  <circle cx={62} cy={18} r={2.5} fill="#a5b4fc" />
                </svg>
              ),
            },
          ]

          return (
            <motion.div
              id="cascade-tier-6"
              {...fadeUp(3.1)}
              style={{
                ...TIER_ROW_STYLE,
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 16,
                ...tierDimStyle(isTierRelevant(6)),
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <TierLabel color="#7c3aed" text="Tier 6 · The Living Archive" />
                <TierTitle color="#ffffff">Four Scenes. 42 Years.</TierTitle>
                <TierSubtitle color="#c4b5fd">Here's what three words actually built.</TierSubtitle>
              </div>

              <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {SCENES.map(scene => {
                    const isActive = activeScene === scene.id
                    return (
                      <div key={scene.id}>
                        <button
                          onClick={() => setActiveScene(isActive ? null : scene.id)}
                          style={{
                            width: '100%',
                            background: scene.bg,
                            border: `1.5px solid ${isActive ? scene.activeBorderColor : scene.borderColor}`,
                            borderRadius: 10,
                            padding: '14px 12px 10px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                            outline: 'none',
                            boxShadow: isActive ? '0 0 0 2px rgba(139,92,246,0.25)' : 'none',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 44 }}>
                            {scene.icon}
                          </div>
                          <div>
                            <div style={{ ...SANS, fontSize: 12, fontWeight: 600, color: scene.labelColor, lineHeight: 1.2 }}>
                              {scene.name}
                            </div>
                            <div style={{ ...SANS, fontSize: 10, fontWeight: 300, color: scene.subtitleColor, marginTop: 2 }}>
                              {scene.subtitle}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                            {scene.tiers.map(t => (
                              <span
                                key={t.label}
                                style={{
                                  ...MONO,
                                  fontSize: 8,
                                  padding: '2px 5px',
                                  borderRadius: 3,
                                  background: `${t.color}20`,
                                  border: `1px solid ${t.color}44`,
                                  color: t.color,
                                  letterSpacing: '0.05em',
                                }}
                              >
                                {t.label}
                              </span>
                            ))}
                          </div>
                        </button>

                        <AnimatePresence>
                          {isActive && (
                            <motion.div
                              key="panel"
                              initial={{ opacity: 0, height: 0, marginTop: 0 }}
                              animate={{ opacity: 1, height: 'auto', marginTop: 6 }}
                              exit={{ opacity: 0, height: 0, marginTop: 0 }}
                              transition={{ duration: 0.22, ease: 'easeOut' }}
                              style={{ overflow: 'hidden' }}
                            >
                              <div
                                style={{
                                  background: 'rgba(15,18,30,0.95)',
                                  border: '1px solid rgba(139,92,246,0.25)',
                                  borderRadius: 8,
                                  padding: '12px 14px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 8,
                                }}
                              >
                                <div style={{ ...MONO, fontSize: 8, letterSpacing: '0.12em', color: '#6b7280', textTransform: 'uppercase' }}>
                                  Powered by
                                </div>
                                {scene.tiers.map(t => (
                                  <div key={t.label} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                    <span
                                      style={{
                                        ...MONO,
                                        fontSize: 9,
                                        padding: '2px 6px',
                                        borderRadius: 3,
                                        background: `${t.color}20`,
                                        border: `1px solid ${t.color}55`,
                                        color: t.color,
                                        flexShrink: 0,
                                        letterSpacing: '0.04em',
                                      }}
                                    >
                                      {t.label}
                                    </span>
                                    <div>
                                      <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.2 }}>{t.name}</div>
                                      <div style={{ ...SANS, fontSize: 9, fontWeight: 300, color: '#6b7280', lineHeight: 1.4 }}>{t.desc}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>

                <div style={{ ...SANS, fontSize: 10, color: '#4b5563', textAlign: 'center', marginTop: 14, fontWeight: 300 }}>
                  tap any scene to see which cascade tiers power it
                </div>
              </div>
            </motion.div>
          )
        })()}

        {/* ── FOOTER ── */}
        <motion.footer
          {...fadeUp(3.5)}
          style={{
            textAlign: 'center',
            padding: '80px 40px 100px',
            position: 'relative',
            zIndex: 2,
          }}
        >
          {/* Radial glow */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse 600px 300px at 50% 30%, rgba(139,92,246,0.08), transparent)',
              pointerEvents: 'none',
            }}
          />

          {/* Punchline stats */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 40, flexWrap: 'wrap', position: 'relative' }}>
            {[
              { num: '540', label: 'inputs' },
              { num: '→', label: '' },
              { num: '23,000+', label: 'data points' },
              { num: '=', label: '' },
              { num: '42×', label: 'enrichment' },
            ].map((stat, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    ...PLAYFAIR,
                    fontSize: stat.num === '→' || stat.num === '=' ? 36 : 56,
                    fontWeight: 900,
                    lineHeight: 1,
                    background: 'linear-gradient(135deg, #c084fc, #6366f1, #ec4899)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    display: 'flex',
                    alignItems: 'center',
                    height: stat.num === '→' || stat.num === '=' ? 56 : undefined,
                  }}
                >
                  {stat.num}
                </div>
                {stat.label && (
                  <div style={{ ...SANS, fontSize: 14, color: '#6b7280', marginTop: 4, fontWeight: 300 }}>
                    {stat.label}
                  </div>
                )}
              </div>
            ))}
          </div>

          <p
            style={{
              ...PLAYFAIR,
              fontSize: 24,
              fontWeight: 400,
              fontStyle: 'italic',
              color: '#c4b5fd',
              marginBottom: 36,
              lineHeight: 1.4,
              position: 'relative',
            }}
          >
            7 APIs. 4 scenes. 42 years.<br />Three words started it all.
          </p>

          {/* API logo row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 40, position: 'relative' }}>
            {['Google Places', 'TheAudioDB', 'Last.fm', 'MusicBrainz', 'Apple Music', 'setlist.fm', 'Ticketmaster'].map(api => (
              <span
                key={api}
                style={{
                  ...MONO,
                  fontSize: 11,
                  color: '#4b5563',
                  padding: '6px 14px',
                  border: '1px solid #1e2028',
                  borderRadius: 100,
                }}
              >
                {api}
              </span>
            ))}
          </div>

          {/* CTA */}
          <a
            href="https://concerts.morperhaus.org"
            style={{
              ...MONO,
              fontSize: 16,
              color: '#6366f1',
              textDecoration: 'none',
              padding: '12px 28px',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 8,
              display: 'inline-block',
              position: 'relative',
            }}
          >
            concerts.morperhaus.org
          </a>
        </motion.footer>

        {/* ── FOCUS RESET PILL ── */}
        {focusedAtom && (
          <motion.button
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            onClick={resetFocus}
            style={{
              position: 'fixed',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              ...MONO,
              fontSize: 12,
              color: '#e2e8f0',
              background: 'rgba(30,27,75,0.9)',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: 100,
              padding: '10px 24px',
              cursor: 'pointer',
              backdropFilter: 'blur(12px)',
              zIndex: 100,
            }}
          >
            Show All
          </motion.button>
        )}
      </div>
    </div>
  )
}
