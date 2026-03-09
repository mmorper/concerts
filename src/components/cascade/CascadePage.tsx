import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CascadeLanes } from './CascadeLanes'
import { CascadeAtom } from './CascadeAtom'
import { CascadeApiEngine, ServiceGatewayPeer, CodeTransform, FlowArrow, DataTypeIcon, API_BRANDS } from './CascadeApiEngine'
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
  padding: '48px 16px',
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

function CumulativeCounter({ count, color }: { count: string; color: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        top: 48,
        ...MONO,
        fontSize: 11,
        opacity: 0.35,
        textAlign: 'right',
        color,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 500, display: 'block' }}>{count}</span>
      <span style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' }}>data points</span>
    </div>
  )
}

function DormantThread({ type }: { type: 'date' | 'venue' | 'artist' }) {
  const colors = { date: '#64748b', venue: '#6366f1', artist: '#8b5cf6' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
      <div style={{ width: 2, minHeight: 60, borderRadius: 1, background: colors[type] }} />
      <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.1em', marginTop: 8, color: colors[type], opacity: 0.8 }}>
        {type}
      </div>
    </div>
  )
}

function FieldTag({ label, value, derived = false }: { label: string; value: string; derived?: boolean }) {
  return (
    <div
      style={{
        padding: '5px 10px',
        borderRadius: 4,
        background: derived ? '#1a1f2e' : '#1e2028',
        border: `1px solid ${derived ? '#475569' : '#2d3040'}`,
        marginBottom: 4,
      }}
    >
      <span style={{ ...MONO, fontSize: 8, letterSpacing: '0.05em', color: derived ? '#64748b' : '#4b5563', display: 'block' }}>
        {label}
      </span>
      <span style={{ ...MONO, fontSize: 12, color: derived ? '#cbd5e1' : '#64748b' }}>{value}</span>
    </div>
  )
}

function tierDimStyle(isRelevant: boolean): React.CSSProperties {
  return isRelevant ? {} : { opacity: 0.12, filter: 'grayscale(0.5)' }
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function CascadePage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { focusedAtom, focusAtom, resetFocus, isTierRelevant } = useCascadeFocus()

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

          <CascadeAtom type="date" value={DEMO.date} focusedAtom={focusedAtom} onFocus={focusAtom} />
          <CascadeAtom type="venue" value={DEMO.venue} focusedAtom={focusedAtom} onFocus={focusAtom} />
          <CascadeAtom type="artist" value={DEMO.artist} focusedAtom={focusedAtom} onFocus={focusAtom} />

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

          {/* Date lane */}
          <div>
            <CodeTransform fn="parse(date)" description="extract temporal fields" />
            <FieldTag label="year" value="2023" derived />
            <FieldTag label="month" value="3" derived />
            <FieldTag label="day" value="28" derived />
            <FieldTag label="dayOfWeek" value='"Tuesday"' derived />
            <FieldTag label="decade" value='"2020s"' derived />
          </div>

          {/* Venue lane */}
          <div>
            <CodeTransform fn="normalize(venue)" description="slug + location lookup" />
            <FieldTag label="venueNormalized" value='"kia-forum"' derived />
            <FieldTag label="city" value='"Inglewood"' derived />
            <FieldTag label="state" value='"California"' derived />
            <FieldTag label="cityState" value='"Inglewood, CA"' derived />
          </div>

          {/* Artist lane */}
          <div>
            <CodeTransform fn="derive(artist)" description="normalize + assign ID" />
            <FieldTag label="headlinerNormalized" value='"depeche-mode"' derived />
            <FieldTag label="id" value='"concert-158"' />
            <FieldTag label="openers" value='["Kelly Lee Owens"]' />
          </div>

          <div style={TIER_FOOTER_STYLE}>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ ...PLAYFAIR, fontWeight: 700, fontSize: 32, lineHeight: 1, color: '#94a3b8' }}>19</span>
              <span style={{ ...SANS, fontSize: 13, fontWeight: 300, color: '#64748b' }}>fields per concert</span>
            </div>
          </div>
          <CumulativeCounter count="3,600" color="#64748b" />
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

          <DormantThread type="date" />

          <CascadeApiEngine
            tierColor="#6366f1"
            inputs={[{ key: 'venue + city + state', value: '"Kia Forum" · "Inglewood" · "California"' }]}
            services={[{ name: 'Google Places', type: 'Geocoding + Photos' }]}
            outputs={[
              { key: 'lat', value: '33.9581' },
              { key: 'lng', value: '-118.3421' },
              { key: 'formattedAddress', value: '3900 W Manchester Blvd' },
              { key: 'placeId', value: 'ChIJO...', icon: 'id' },
              { key: 'confirmedName', value: '"Kia Forum"' },
              { key: 'types', value: '"stadium"' },
              { key: 'website', value: 'kiaforum.com', icon: 'link' },
              { key: 'photos', value: '3 sizes', icon: 'image' },
            ]}
            scaleLabel="× 77 venues · 35 cities · 10 regions"
          />

          <DormantThread type="artist" />

          <CumulativeCounter count="3,985" color="#818cf8" />
        </motion.div>

        {/* ── TIER 3 — ARTIST IDENTITY (artist lane wide) ── */}
        <motion.div
          id="cascade-tier-3"
          {...fadeUp(1.9)}
          style={{
            ...TIER_ROW_STYLE,
            display: 'grid',
            gridTemplateColumns: '0.6fr 0.6fr 2.4fr',
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

          <DormantThread type="date" />
          <DormantThread type="venue" />

          <CascadeApiEngine
            tierColor="#8b5cf6"
            inputs={[{ key: 'headliner', value: '"Depeche Mode"' }]}
            services={[
              { name: 'TheAudioDB', type: 'Images + Bios' },
              { name: 'Last.fm', type: 'Tags + Listeners', isFallback: true },
              { name: 'MusicBrainz', type: 'Canonical IDs', isFallback: true },
            ]}
            outputs={[
              { key: 'image', value: 'artist photo', icon: 'image', source: 'TheAudioDB' },
              { key: 'bio', value: 'biography', source: 'TheAudioDB' },
              { key: 'formed', value: '"1980"', source: 'TheAudioDB' },
              { key: 'country', value: '"England"', source: 'TheAudioDB' },
              { key: 'style', value: '"Synth-pop"', source: 'TheAudioDB' },
              { key: 'genres', value: '["New Wave"]', source: 'Last.fm' },
              { key: 'listeners', value: '3.2M', source: 'Last.fm' },
              { key: 'mbid', value: 'canonical ID', icon: 'id', source: 'MusicBrainz' },
            ]}
            scaleLabel="× 255 artists enriched"
          />

          <CumulativeCounter count="5,515" color="#a78bfa" />
        </motion.div>

        {/* ── TIER 4 — AUDIO (artist lane wide) ── */}
        <motion.div
          id="cascade-tier-4"
          {...fadeUp(2.3)}
          style={{
            ...TIER_ROW_STYLE,
            display: 'grid',
            gridTemplateColumns: '0.6fr 0.6fr 2.4fr',
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

          <DormantThread type="date" />
          <DormantThread type="venue" />

          <CascadeApiEngine
            tierColor="#a855f7"
            inputs={[{ key: 'artist', value: '"Depeche Mode"' }]}
            services={[{ name: 'Apple Music', type: 'Search API' }]}
            outputs={[
              { key: 'trackName', value: '"Enjoy the Silence"' },
              { key: 'albumName', value: '"Violator (Deluxe)"' },
              { key: 'albumArt', value: '250px artwork', icon: 'image' },
              { key: 'previewUrl', value: '30s M4A preview', icon: 'audio' },
              { key: 'streamingUrl', value: 'Apple Music link', icon: 'link' },
              { key: 'releaseDate', value: '"1990"' },
              { key: 'genre', value: '"Alternative"' },
            ]}
            scaleLabel="× 255 artists · up to 1,275 tracks"
          >
            {/* Mini track list */}
            <div style={{ marginTop: 12, borderTop: '1px solid rgba(168,85,247,0.15)', paddingTop: 12 }}>
              {DEMO.topTracks.slice(0, 3).map((t, i) => (
                <div
                  key={i}
                  style={{ display: 'flex', gap: 8, padding: '3px 0', ...MONO, fontSize: 10, color: '#d8b4fe' }}
                >
                  <span style={{ color: '#7c3aed', width: 14, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ flexGrow: 1 }}>{t.name}</span>
                  <span style={{ color: '#6b21a8', fontSize: 9 }}>{t.album}</span>
                </div>
              ))}
              <div style={{ color: '#4b5563', fontStyle: 'italic', textAlign: 'center', fontSize: 9, padding: '3px 0', ...MONO }}>
                · · · 2 more tracks · · ·
              </div>
            </div>
          </CascadeApiEngine>

          <CumulativeCounter count="13,165" color="#c084fc" />
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
            <div style={{ marginTop: 12 }}>
              <span
                style={{
                  ...MONO,
                  fontSize: 9,
                  letterSpacing: '0.1em',
                  color: '#7c3aed',
                  padding: '6px 12px',
                  border: '1px dashed rgba(124,58,237,0.3)',
                  borderRadius: 5,
                  display: 'inline-block',
                }}
              >
                all three atoms required
              </span>
            </div>
          </div>

          {/* Spans all 3 columns */}
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ maxWidth: 540, margin: '0 auto' }}>
              {/* Inputs — all three atoms */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 8 }}>
                {[
                  { key: 'artist', value: '"Depeche Mode"' },
                  { key: 'venue', value: '"Kia Forum"' },
                  { key: 'date', value: '"2023-03-28"' },
                ].map(tag => (
                  <div
                    key={tag.key}
                    style={{
                      ...MONO,
                      fontSize: 10,
                      padding: '4px 10px',
                      borderRadius: 4,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#6b7280',
                      textAlign: 'center',
                    }}
                  >
                    <span style={{ color: '#4b5563', fontSize: 8, display: 'block', letterSpacing: '0.04em' }}>{tag.key}</span>
                    <span style={{ color: '#94a3b8' }}>{tag.value}</span>
                  </div>
                ))}
              </div>

              <FlowArrow label="query" />

              {/* Side-by-side peer gateways */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <ServiceGatewayPeer svc={{ name: 'setlist.fm', type: 'Historical setlists' }} />
                <ServiceGatewayPeer svc={{ name: 'Ticketmaster', type: 'Tour dates' }} />
              </div>

              <FlowArrow label="response" />

              {/* Per-service output chips */}
              {(() => {
                const slColor = API_BRANDS['setlist.fm'].primary
                const tmColor = API_BRANDS['Ticketmaster'].primary
                const chipStyle = (color: string): React.CSSProperties => ({
                  ...MONO, fontSize: 10, padding: '4px 8px', borderRadius: 3,
                  background: `${color}0e`, border: `1px solid ${color}2a`,
                })
                const keyStyle = (color: string): React.CSSProperties => ({
                  fontSize: 7, display: 'block', color: `${color}80`, letterSpacing: '0.04em', marginBottom: 1,
                })
                const valStyle: React.CSSProperties = { color: '#f0f0ff', display: 'inline-flex', alignItems: 'center', gap: 3 }

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                    {/* setlist.fm outputs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {[
                        { key: 'tourName', val: `"${DEMO.tour}"`, icon: null },
                        { key: 'songs', val: `${DEMO.setlist.length} tracks`, icon: null },
                        { key: 'setStructure', val: 'Set 1 + Encore', icon: null },
                        { key: 'setBreaks', val: 'positions noted', icon: null },
                      ].map(f => (
                        <div key={f.key} style={chipStyle(slColor)}>
                          <span style={keyStyle(slColor)}>{f.key}</span>
                          <span style={valStyle}>{f.val}</span>
                        </div>
                      ))}
                    </div>
                    {/* Ticketmaster outputs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {[
                        { key: 'opener', val: `"${DEMO.opener}"`, icon: null },
                        { key: 'tour', val: `"${DEMO.tour} Tour"`, icon: null },
                        { key: 'eventId', val: 'TM canonical ID', icon: 'id' as const },
                        { key: 'eventUrl', val: 'ticketmaster.com/…', icon: 'link' as const },
                      ].map(f => (
                        <div key={f.key} style={chipStyle(tmColor)}>
                          <span style={keyStyle(tmColor)}>{f.key}</span>
                          <span style={valStyle}>
                            {f.icon && <DataTypeIcon type={f.icon} />}
                            {f.val}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>

          <div style={TIER_FOOTER_STYLE}>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ ...PLAYFAIR, fontWeight: 700, fontSize: 32, lineHeight: 1, color: '#e9d5ff' }}>~3,240</span>
              <span style={{ ...SANS, fontSize: 13, fontWeight: 300, color: '#d8b4fe' }}>songs across 180 concerts</span>
            </div>
          </div>
          <CumulativeCounter count="23,000+" color="#e9d5ff" />
        </motion.div>

        {/* ── TIER 6 — THE OUTPUT ── */}
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
            <TierTitle color="#ffffff">Five Scenes. 42 Years.</TierTitle>
            <TierSubtitle color="#c4b5fd">Here's what three words actually built.</TierSubtitle>
          </div>

          {/* App schematic with callout lines */}
          <div
            style={{
              maxWidth: 600,
              margin: '0 auto',
              background: 'linear-gradient(135deg, rgba(30,27,75,0.6), rgba(88,28,135,0.3))',
              border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: 12,
              padding: 32,
              position: 'relative',
            }}
          >
            {/* Scene grid schematic */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { name: 'Timeline', source: 'Tier 1 — parsed dates', color: '#64748b', icon: '━━━' },
                { name: 'Map', source: 'Tier 2 — Google Places', color: '#6366f1', icon: '◉' },
                { name: 'Genres', source: 'Tier 3 — classifications', color: '#8b5cf6', icon: '◔' },
                { name: 'Venues', source: 'Tier 1+2 — normalized', color: '#6366f1', icon: '⬡' },
              ].map(scene => (
                <div
                  key={scene.name}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${scene.color}33`,
                    borderRadius: 8,
                    padding: '12px 16px',
                  }}
                >
                  <div style={{ ...MONO, fontSize: 9, color: scene.color, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
                    {scene.icon} {scene.name}
                  </div>
                  <div style={{ ...SANS, fontSize: 10, color: '#6b7280', fontWeight: 300 }}>← {scene.source}</div>
                </div>
              ))}
            </div>

            {/* Artists scene — full width, most data-rich */}
            <div
              style={{
                background: 'rgba(139,92,246,0.08)',
                border: '1px solid rgba(139,92,246,0.25)',
                borderRadius: 8,
                padding: '16px 20px',
              }}
            >
              <div style={{ ...MONO, fontSize: 9, color: '#8b5cf6', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
                ♪ Artists
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[
                  { label: 'Photos', source: 'Tier 3 — TheAudioDB', color: '#8b5cf6' },
                  { label: 'Audio previews', source: 'Tier 4 — iTunes', color: '#a855f7' },
                  { label: 'Setlists', source: 'Tier 5 — setlist.fm', color: '#c084fc' },
                ].map(item => (
                  <div key={item.label} style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ ...MONO, fontSize: 10, color: item.color }}>{item.label}</div>
                    <div style={{ ...SANS, fontSize: 10, color: '#6b7280', fontWeight: 300 }}>← {item.source}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

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
            7 APIs. 5 scenes. 42 years.<br />Three words started it all.
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
