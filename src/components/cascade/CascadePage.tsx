import { useRef, useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CascadeLanes } from './CascadeLanes'
import { CascadeAtom } from './CascadeAtom'
import { ServiceGatewayPeer, CodeTransform, FlowArrow, API_BRANDS, PillGrid } from './CascadeApiEngine'
import { useCascadeFocus } from './useCascadeFocus'
import { AnimatedConnector } from './AnimatedConnector'
type SeedType = 'artist' | 'venue' | 'date'

const SEED_GLOW: Record<SeedType, string> = {
  artist: '#8b5cf6',
  venue:  '#6366f1',
  date:   '#64748b',
}
const dominantSeedColor = (seeds: SeedType[]): string => {
  if (seeds.includes('artist')) return SEED_GLOW.artist
  if (seeds.includes('venue'))  return SEED_GLOW.venue
  return SEED_GLOW.date
}

// ─── Data types ───────────────────────────────────────────────────────────────

interface Concert {
  id: string
  date: string
  headliner: string
  headlinerNormalized: string
  openers: string[]
  venue: string
  venueNormalized: string
  city: string
  state: string
  cityState: string
  year: number
  month: number
  day: number
  dayOfWeek: string
  decade: string
  location: { lat: number; lng: number }
}

interface ArtistMeta {
  name?: string
  image?: string
  bio?: string
  genres?: string[]
  formed?: string
  country?: string
}

interface VenueMeta {
  name: string
  normalizedName: string
  city: string
  state: string
  cityState: string
  location: { lat: number; lng: number }
  photoUrls?: { thumbnail?: string; medium?: string }
  places?: { id?: string; formattedAddress?: string; websiteUri?: string }[]
}

interface Track {
  name: string
  albumName?: string
  albumArt?: string
  durationMs?: number
}

type FlowPhase =
  | 'idle'
  | 'artist-hydrating'
  | 'venue-pending'
  | 'venue-hydrating'
  | 'date-pending'
  | 'convergence'
  | 'cascade-pending'
  | 'complete'

// ─── Tier color palette ───────────────────────────────────────────────────────

const TIER_COLORS = {
  t0: { label: '#4b5563', title: '#9ca3af', sub: '#6b7280' },
  t1: { label: '#64748b', title: '#cbd5e1', sub: '#94a3b8', accent: '#64748b' },
  t2: { label: '#6366f1', title: '#e0e7ff', sub: '#a5b4fc', accent: '#6366f1' },
  t3: { label: '#8b5cf6', title: '#ede9fe', sub: '#c4b5fd', accent: '#8b5cf6' },
  t4: { label: '#a855f7', title: '#faf5ff', sub: '#d8b4fe', accent: '#a855f7' },
  t5: { label: '#c084fc', title: '#ffffff', sub: '#e9d5ff', accent: '#c084fc' },
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const TIER_ROW_STYLE: React.CSSProperties = {
  position: 'relative',
  zIndex: 2,
  padding: '14px 24px 8px',
}

const TIER_HEADER_STYLE: React.CSSProperties = {
  gridColumn: '1 / -1',
  textAlign: 'center',
  marginBottom: 6,
}

const TIER_FOOTER_STYLE: React.CSSProperties = {
  gridColumn: '1 / -1',
  textAlign: 'center',
  marginTop: 8,
}

const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" }
const PLAYFAIR: React.CSSProperties = { fontFamily: "'Playfair Display', serif" }
const SANS: React.CSSProperties = { fontFamily: "'Source Sans 3', sans-serif" }

// ─── Helper components ────────────────────────────────────────────────────────

function TierLabel({ color, text }: { color: string; text: string }) {
  return (
    <div style={{ ...MONO, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color, marginBottom: 5 }}>
      {text}
    </div>
  )
}

function TierTitle({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ ...PLAYFAIR, fontSize: 26, fontWeight: 700, color, lineHeight: 1.15, marginBottom: 4 }}>
      {children}
    </div>
  )
}

function TierSubtitle({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ ...SANS, fontSize: 15, fontWeight: 300, color, lineHeight: 1.5 }}>
      {children}
    </div>
  )
}


function ContinueButton({ tierColor, onContinue }: { tierColor: string; onContinue: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay: 0.2 }}
      style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', paddingTop: 20, paddingBottom: 4 }}
    >
      <button
        onClick={onContinue}
        style={{
          ...MONO,
          fontSize: 12,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: tierColor,
          background: 'none',
          border: `1px solid ${tierColor}40`,
          borderRadius: 4,
          padding: '10px 32px',
          cursor: 'pointer',
        }}
      >
        continue ↓
      </button>
    </motion.div>
  )
}

function tierDimStyle(isRelevant: boolean): React.CSSProperties {
  return isRelevant ? {} : { opacity: 0.12, filter: 'grayscale(0.5)' }
}

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

function ApiBadge({ name, domain, color, pulsing }: { name: string; domain: string; color: string; pulsing?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
        width={14} height={14}
        style={{ borderRadius: 2, animation: pulsing ? 'favPulse 0.6s ease-in-out infinite' : 'none' }}
        alt=""
      />
      <span style={{ ...MONO, fontSize: 9, color, letterSpacing: '0.05em' }}>{name}</span>
    </div>
  )
}


function TierSummaryCard({
  color, label, domains, iconText, summary, onClick,
}: {
  color: string; label: string
  domains?: string[]; iconText?: string; summary: string; onClick: () => void
}) {
  return (
    <motion.div
      key="summary"
      initial={{ opacity: 0, scaleY: 0.88 }}
      animate={{ opacity: 1, scaleY: 1 }}
      exit={{ opacity: 0, scaleY: 0.88 }}
      transition={{ duration: 0.42, ease: [0.4, 0, 0.2, 1] }}
      onClick={onClick}
      style={{
        cursor: 'pointer', padding: '14px 24px',
        display: 'flex', alignItems: 'center', gap: 10,
        background: `${color}08`, border: `1px solid ${color}22`,
        borderRadius: 6, userSelect: 'none', position: 'relative', zIndex: 2,
        transformOrigin: 'top center',
      }}
    >
      <div style={{ ...MONO, fontSize: 12, letterSpacing: '0.06em', color, flex: 1, fontWeight: 500 }}>
        {label}
      </div>
      {iconText && (
        <div style={{ ...MONO, fontSize: 10, color: `${color}80`, flexShrink: 0 }}>{iconText}</div>
      )}
      {domains?.map(domain => (
        <img key={domain} src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
          width={16} height={16} style={{ borderRadius: 2, opacity: 0.8, flexShrink: 0 }} alt="" />
      ))}
      <div style={{
        ...MONO, fontSize: 10, color: `${color}80`,
        background: `${color}12`, border: `1px solid ${color}25`,
        borderRadius: 10, padding: '3px 10px', flexShrink: 0,
      }}>
        {summary}
      </div>
      <div style={{ ...MONO, fontSize: 11, color: `${color}35`, flexShrink: 0 }}>↕</div>
    </motion.div>
  )
}

// ─── T0 sub-components (picker + pending) ─────────────────────────────────────

const PICKER_BTN: React.CSSProperties = {
  ...MONO,
  fontSize: 10,
  background: 'none',
  border: 'none',
  padding: '5px 8px',
  cursor: 'pointer',
  textAlign: 'left',
  borderRadius: 3,
  width: '100%',
  letterSpacing: '0.02em',
  transition: 'background 0.1s',
}

function ArtistTypeahead({
  artists,
  value,
  onValueChange,
  onSelect,
  glowing,
}: {
  artists: { norm: string; display: string }[]
  value: string
  onValueChange: (v: string) => void
  onSelect: (norm: string, display: string) => void
  glowing?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const ARTIST_COLOR = '#8b5cf6'

  const firstMatch = useMemo(() => {
    if (!inputValue.trim()) return null
    const q = inputValue.toLowerCase()
    return artists.find(a => a.display.toLowerCase().startsWith(q)) ?? null
  }, [artists, inputValue])

  const ghostCompletion = firstMatch ? firstMatch.display.slice(inputValue.length) : ''

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setEditing(false)
        setInputValue('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleActivate = () => {
    setInputValue('')
    setEditing(true)
  }

  const confirmMatch = () => {
    if (firstMatch) {
      onValueChange(firstMatch.display)
      onSelect(firstMatch.norm, firstMatch.display)
      setEditing(false)
      setInputValue('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'Enter') && firstMatch) {
      e.preventDefault()
      confirmMatch()
    } else if (e.key === 'Escape') {
      setEditing(false)
      setInputValue('')
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div
        style={{
          background: '#1e2028',
          border: `1px solid ${(editing || glowing) ? ARTIST_COLOR : '#2d3040'}`,
          borderRadius: 6,
          padding: '20px',
          fontFamily: "'JetBrains Mono', monospace",
          cursor: editing ? 'default' : 'text',
          textAlign: 'center',
          width: '100%',
          boxShadow: glowing ? `0 0 28px ${ARTIST_COLOR}70, 0 0 10px ${ARTIST_COLOR}40` : editing ? `0 0 24px ${ARTIST_COLOR}40` : 'none',
          transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
          boxSizing: 'border-box',
          position: 'relative',
        }}
        onClick={!editing ? handleActivate : undefined}
      >
        <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#4b5563', marginBottom: 8 }}>
          artist
        </div>
        {editing ? (
          <div style={{ position: 'relative', height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Ghost text display layer */}
            <div
              aria-hidden
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 17,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {inputValue ? (
                <>
                  <span style={{ color: '#e2e8f0' }}>{inputValue}</span>
                  <span style={{ color: '#3d2a5c' }}>{ghostCompletion}</span>
                </>
              ) : (
                <span style={{ color: '#2d3040' }}>search…</span>
              )}
            </div>
            {/* Transparent input captures keyboard; caret shows position */}
            <input
              autoFocus
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 17,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'transparent',
                caretColor: ARTIST_COLOR,
                textAlign: 'center',
                padding: 0,
                position: 'relative',
                zIndex: 1,
              }}
            />
          </div>
        ) : (
          <div style={{ fontSize: 17, color: '#9ca3af' }}>{value || '—'}</div>
        )}
      </div>
    </div>
  )
}

function VenuePicker({
  options,
  onSelect,
}: {
  options: { norm: string; display: string }[]
  onSelect: (norm: string) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const VENUE_COLOR = '#6366f1'

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          background: '#1e2028',
          border: `1px solid ${open ? VENUE_COLOR : '#2d3040'}`,
          ...(open && { borderBottom: '1px solid #252836' }),
          borderRadius: open ? '6px 6px 0 0' : 6,
          padding: '20px',
          fontFamily: "'JetBrains Mono', monospace",
          cursor: 'pointer',
          textAlign: 'center',
          width: '100%',
          boxShadow: open ? `0 0 24px ${VENUE_COLOR}40` : 'none',
          transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#4b5563', marginBottom: 8 }}>
          venue
        </div>
        <div style={{ fontSize: 17, color: '#3a3f5c', fontStyle: 'italic' }}>
          select venue…
        </div>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: '#1e2028',
          border: `1px solid ${VENUE_COLOR}`,
          borderTop: 'none',
          borderRadius: '0 0 6px 6px',
          overflow: 'hidden',
        }}>
          {options.map((o, i) => (
            <button
              key={o.norm}
              onMouseDown={e => { e.preventDefault(); onSelect(o.norm); setOpen(false) }}
              style={{
                display: 'block',
                width: '100%',
                background: 'none',
                border: 'none',
                borderTop: i > 0 ? '1px solid #1a1d28' : 'none',
                padding: '14px 20px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 17,
                color: '#9ca3af',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#141620'; e.currentTarget.style.color = '#c4b5fd' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#9ca3af' }}
            >
              {o.display}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DatePicker({
  options,
  onSelect,
}: {
  options: Concert[]
  onSelect: (concert: Concert) => void
}) {
  return (
    <div>
      <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#4b5563', marginBottom: 8, textAlign: 'center' }}>
        date
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {options.map(c => (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            style={{ ...PICKER_BTN, color: '#94a3b8' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1a1e2a')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            {c.date}
          </button>
        ))}
      </div>
    </div>
  )
}

function PendingAtom({ type }: { type: string }) {
  return (
    <div style={{
      border: '1px dashed #1e2028',
      borderRadius: 6,
      padding: '12px 10px',
      textAlign: 'center',
      opacity: 0.45,
    }}>
      <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#374151', marginBottom: 5 }}>
        {type}
      </div>
      <div style={{ ...MONO, fontSize: 8, color: '#2d3040', letterSpacing: '0.12em' }}>awaiting…</div>
    </div>
  )
}


// ─── Main Page ────────────────────────────────────────────────────────────────

export function CascadePage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { focusedAtom, focusAtom, focusedScene, focusScene, resetFocus, isTierRelevant } = useCascadeFocus()

  // ── Data loading ──────────────────────────────────────────────────────────
  const [concerts, setConcerts] = useState<Concert[]>([])
  const artistsMetaRef = useRef<Record<string, ArtistMeta>>({})
  const venuesMetaRef = useRef<Record<string, VenueMeta>>({})
  const topTracksRef = useRef<Record<string, { tracks: Track[] }>>({})
  // Keyed by concertId, but holding *every* cached entry for that date — a
  // festival has one concertId and many setlists (Huntington State Beach 2018
  // has 15, including Rancid, Bad Religion and The Offspring). The previous
  // shape was Record<string, entry> built with last-write-wins, so the page
  // could show another band's setlist under the selected artist's name.
  const setlistsByConcertId = useRef<Record<string, any[]>>({})

  // Promises for the four large files, so the selection handlers can await the
  // one dataset they need instead of the page waiting for all five (#114).
  const loadersRef = useRef<{
    artistsMeta: Promise<Record<string, ArtistMeta>>
    venuesMeta: Promise<Record<string, VenueMeta>>
    topTracks: Promise<Record<string, { tracks: Track[] }>>
    setlists: Promise<Record<string, any>>
  } | null>(null)

  // Gate for the featured demo below: it walks the whole cascade unattended, so
  // it should not start until the data that walk ends in has arrived.
  const [demoDataReady, setDemoDataReady] = useState(false)

  useEffect(() => {
    // These five were behind a single Promise.all, which meant first paint waited
    // on 2.7 MB — and the slowest fetch gated everything, including the 125 KB
    // file that is the only one the page needs to become structurally real (#114).
    //
    // They still all start at once; what changed is that nothing waits for the
    // set. concerts.json lands first by size and renders the archive; the other
    // four settle into refs as they arrive.
    const json = <T,>(url: string): Promise<T> => fetch(url).then(r => r.json())

    const concertsP = json<{ concerts?: Concert[] }>('/data/concerts.json')
    const artistsMetaP = json<Record<string, ArtistMeta>>('/data/artists-metadata.json')
    const venuesMetaP = json<Record<string, VenueMeta>>('/data/venues-metadata.json')
    const topTracksP = json<Record<string, { tracks: Track[] }>>('/data/artists-top-tracks.json')
    const setlistsP = json<{ entries?: Record<string, any> }>('/data/setlists-cache.json')
      .then(sl => {
        const slMap: Record<string, any[]> = {}
        Object.values(sl.entries ?? {}).forEach((entry: any) => {
          if (!entry?.concertId) return
          ;(slMap[entry.concertId] ||= []).push(entry)
        })
        return slMap
      })

    // Handlers read the refs synchronously once populated; the promises above are
    // what they await when a click lands before the file does.
    artistsMetaP.then(am => { artistsMetaRef.current = am })
    venuesMetaP.then(vm => { venuesMetaRef.current = vm })
    topTracksP.then(tt => { topTracksRef.current = tt })
    setlistsP.then(sl => { setlistsByConcertId.current = sl })

    loadersRef.current = {
      artistsMeta: artistsMetaP,
      venuesMeta: venuesMetaP,
      topTracks: topTracksP,
      setlists: setlistsP,
    }

    concertsP.then(c => setConcerts(c.concerts ?? []))

    Promise.all([topTracksP, setlistsP]).then(() => setDemoDataReady(true))
  }, [])

  // ── Data graph ────────────────────────────────────────────────────────────
  const { artistToVenues, artistVenueToConcerts, artistList } = useMemo(() => {
    const artistToVenues = new Map<string, Set<string>>()
    const artistVenueToConcerts = new Map<string, Concert[]>()
    const seen = new Set<string>()
    const artistList: { norm: string; display: string }[] = []

    concerts.forEach(c => {
      if (!artistToVenues.has(c.headlinerNormalized))
        artistToVenues.set(c.headlinerNormalized, new Set())
      artistToVenues.get(c.headlinerNormalized)!.add(c.venueNormalized)

      const key = `${c.headlinerNormalized}::${c.venueNormalized}`
      if (!artistVenueToConcerts.has(key)) artistVenueToConcerts.set(key, [])
      artistVenueToConcerts.get(key)!.push(c)

      if (!seen.has(c.headlinerNormalized)) {
        seen.add(c.headlinerNormalized)
        artistList.push({ norm: c.headlinerNormalized, display: c.headliner })
      }
    })

    artistList.sort((a, b) => a.display.localeCompare(b.display))
    return { artistToVenues, artistVenueToConcerts, artistList }
  }, [concerts])

  // ── Corpus stats (derived from loaded data) ───────────────────────────────
  const corpusStats = useMemo(() => {
    if (concerts.length === 0) return { totalShows: 0, yearSpan: 0, uniqueArtists: 0, uniqueCities: 0 }
    const allArtists = new Set<string>()
    concerts.forEach(c => {
      allArtists.add(c.headliner)
      c.openers.forEach(o => allArtists.add(o))
    })
    const years = concerts.map(c => c.year)
    return {
      totalShows: concerts.length,
      yearSpan: Math.max(...years) - Math.min(...years) + 1,
      uniqueArtists: allArtists.size,
      uniqueCities: new Set(concerts.map(c => c.city)).size,
    }
  }, [concerts])

  // ── Flow state ────────────────────────────────────────────────────────────
  const [flowPhase, setFlowPhase] = useState<FlowPhase>('idle')
  const [selectedArtistNorm, setSelectedArtistNorm] = useState<string | null>(null)
  const [selectedArtistDisplay, setSelectedArtistDisplay] = useState<string | null>(null)
  const [selectedVenueNorm, setSelectedVenueNorm] = useState<string | null>(null)
  const [selectedVenueDisplay, setSelectedVenueDisplay] = useState<string | null>(null)
  const [selectedConcert, setSelectedConcert] = useState<Concert | null>(null)
  const [venueOptions, setVenueOptions] = useState<{ norm: string; display: string }[]>([])
  const [dateOptions, setDateOptions] = useState<Concert[]>([])
  const [artistSearch, setArtistSearch] = useState('')

  // ── Rich data state ───────────────────────────────────────────────────────
  const [artistMeta, setArtistMeta] = useState<ArtistMeta | null>(null)
  const [venueMeta, setVenueMeta] = useState<VenueMeta | null>(null)
  const [artistTracks, setArtistTracks] = useState<Track[]>([])
  const [setlistSongs, setSetlistSongs] = useState<string[]>([])
  const [tourName, setTourName] = useState<string | null>(null)

  // ── Seed glow state ───────────────────────────────────────────────────────
  const [glowingSeeds, setGlowingSeeds] = useState<Set<SeedType>>(new Set())
  const [glowingTiers, setGlowingTiers] = useState<Map<number, string>>(new Map())

  const countSetlistDataPoints = (entry: any): number => {
    const sl = entry?.setlist
    if (!sl) return 0
    const { sets: _sets, ...meta } = sl
    const countLeaves = (obj: any): number => {
      if (obj == null) return 0
      if (typeof obj !== 'object') return 1
      if (Array.isArray(obj)) return obj.reduce((n, v) => n + countLeaves(v), 0)
      return Object.values(obj).reduce((n: number, v) => n + countLeaves(v), 0)
    }
    const metaCount = countLeaves(meta)
    const songs = (sl.sets?.set ?? []).flatMap((s: any) => s.song ?? [])
    return metaCount + songs.length
  }

  const glowSeeds = (seeds: SeedType[]) => setGlowingSeeds(new Set(seeds))
  const glowTier = (seeds: SeedType[], tierId: number) =>
    setGlowingTiers(prev => new Map([...prev, [tierId, dominantSeedColor(seeds)]]))
  const clearTierGlow = (tierId: number) => {
    setGlowingTiers(prev => { const next = new Map(prev); next.delete(tierId); return next })
  }
  const clearAtomGlow = () => setGlowingSeeds(new Set())

  // ── Animation state ───────────────────────────────────────────────────────
  const genRef = useRef(0)
  const [tiersVisible, setTiersVisible] = useState<Set<number>>(new Set([0]))
  const [connectorPhase, setConnectorPhase] = useState(0)
  const [loadingTier, setLoadingTier] = useState<number | null>(null)
  const [pillCounts, setPillCounts] = useState<Partial<Record<string, number>>>({})
  const [setlistLines, setSetlistLines] = useState(0)
  const [scenesUnlocked, setScenesUnlocked] = useState(0)
  const [t1ColStep, setT1ColStep] = useState(0)   // 0=none, 1=artist, 2=+venue, 3=+date
  const [t1FieldCount, setT1FieldCount] = useState(0) // 0=hidden, 1-19=counter visible
  const [t2FieldCount, setT2FieldCount] = useState(0)
  const [t3FieldCount, setT3FieldCount] = useState(0)
  const [t4FieldCount, setT4FieldCount] = useState(0)
  const [t5FieldCount, setT5FieldCount] = useState(0)
  const [t2RevealStep, setT2RevealStep] = useState(0) // 0=nothing, 2=image visible
  const [collapsedTiers, setCollapsedTiers] = useState<Set<number>>(new Set())
  const [expandedTier, setExpandedTier] = useState<number | null>(null)
  const [cascadePending, setCascadePending] = useState(false)
  const pendingCascadeRef = useRef<{ gen: number; songCount: number; dataPoints: number } | null>(null)
  const [tierAwaitingContinue, setTierAwaitingContinue] = useState<number | null>(null)
  const continueResolverRef = useRef<(() => void) | null>(null)

  const waitForContinue = (tier: number) => {
    setTierAwaitingContinue(tier)
    return new Promise<void>(resolve => { continueResolverRef.current = resolve })
  }
  const handleContinue = () => {
    setTierAwaitingContinue(null)
    continueResolverRef.current?.()
    continueResolverRef.current = null
  }

  const handleStartCascade = () => {
    setCascadePending(false)
    const pending = pendingCascadeRef.current
    if (pending) {
      pendingCascadeRef.current = null
      setFlowPhase('convergence')
      runFullCascade(pending.gen, pending.songCount, pending.dataPoints)
    }
  }

  const revealTier = (n: number) => setTiersVisible(prev => new Set([...prev, n]))
  const collapseTier = (n: number) => setCollapsedTiers(prev => new Set([...prev, n]))
  const toggleExpand = (n: number) => setExpandedTier(prev => prev === n ? null : n)

  // ── Full cascade animation — runs after T0 is fully resolved ─────────────

  const runFullCascade = async (gen: number, songCount: number, dataPoints: number) => {
    const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
    const alive = () => genRef.current === gen

    setLoadingTier(null); setPillCounts({ t1a: 0, t1v: 0, t1d: 0, t2: 0, t3: 0, t4: 0, t5s: 0, t5t: 0 }); setSetlistLines(0); setScenesUnlocked(0)
    setT1ColStep(0); setT1FieldCount(0); setT2FieldCount(0); setT3FieldCount(0); setT4FieldCount(0); setT5FieldCount(0); setT2RevealStep(0)
    setGlowingSeeds(new Set()); setGlowingTiers(new Map())
    await delay(100); if (!alive()) return

    // T0→T1 connector
    setConnectorPhase(1)
    await delay(1100); if (!alive()) return
    revealTier(1)
    await delay(650); if (!alive()) return  // tier header settles

    // T1: columns reveal sequentially
    setT1ColStep(1)
    await delay(350); if (!alive()) return
    setT1ColStep(2)
    await delay(350); if (!alive()) return
    setT1ColStep(3)
    await delay(500); if (!alive()) return  // pause — viewer reads all three

    // T1 pills build
    for (let i = 1; i <= 3; i++) {
      await delay(120); if (!alive()) return
      setPillCounts(prev => ({ ...prev, t1a: i }))
    }
    await delay(3 * 120); if (!alive()) return
    for (let i = 1; i <= 4; i++) {
      await delay(120); if (!alive()) return
      setPillCounts(prev => ({ ...prev, t1v: i }))
    }
    await delay(4 * 120); if (!alive()) return
    for (let i = 1; i <= 5; i++) {
      await delay(120); if (!alive()) return
      setPillCounts(prev => ({ ...prev, t1d: i }))
    }

    // Field counter: 1 → 19
    for (let i = 1; i <= 19; i++) {
      await delay(35); if (!alive()) return
      setT1FieldCount(i)
    }
    await delay(200); if (!alive()) return

    // Post-build glow: seeds light up sequentially, then tier box joins, then both fade
    glowSeeds(['artist'])
    await delay(350); if (!alive()) return
    glowSeeds(['artist', 'venue'])
    await delay(350); if (!alive()) return
    glowSeeds(['artist', 'venue', 'date'])
    await delay(400); if (!alive()) return
    glowTier(['artist', 'venue', 'date'], 1)
    await delay(3000); if (!alive()) return
    clearTierGlow(1)
    clearAtomGlow()
    await delay(300); if (!alive()) return

    // T1 complete — wait for user, then collapse
    await waitForContinue(1); if (!alive()) return
    collapseTier(1)
    await delay(400); if (!alive()) return

    // T1→T2 connector
    setConnectorPhase(2)
    await delay(1100); if (!alive()) return
    revealTier(2)
    setLoadingTier(2)
    await delay(400); if (!alive()) return
    await delay(450); if (!alive()) return
    setT2RevealStep(2)
    setLoadingTier(null)
    await delay(500); if (!alive()) return
    for (let i = 1; i <= 6; i++) {
      await delay(120); if (!alive()) return
      setPillCounts(prev => ({ ...prev, t2: i }))
    }
    for (let i = 1; i <= 28; i++) {
      await delay(22); if (!alive()) return
      setT2FieldCount(i)
    }
    await delay(300); if (!alive()) return

    // Post-build glow
    glowSeeds(['venue'])
    await delay(400); if (!alive()) return
    glowTier(['venue'], 2)
    await delay(3000); if (!alive()) return
    clearTierGlow(2)
    clearAtomGlow()
    await delay(300); if (!alive()) return

    // T2 complete — wait for user, then collapse
    await waitForContinue(2); if (!alive()) return
    collapseTier(2)
    await delay(400); if (!alive()) return

    // T2→T3 connector
    setConnectorPhase(3)
    await delay(1100); if (!alive()) return
    setLoadingTier(3); revealTier(3)
    await delay(400); if (!alive()) return
    await delay(450); if (!alive()) return
    setLoadingTier(null)
    for (let i = 1; i <= 7; i++) {
      await delay(120); if (!alive()) return
      setPillCounts(prev => ({ ...prev, t3: i }))
    }
    for (let i = 1; i <= 43; i++) {
      await delay(18); if (!alive()) return
      setT3FieldCount(i)
    }
    await delay(300); if (!alive()) return

    // Post-build glow
    glowSeeds(['artist'])
    await delay(400); if (!alive()) return
    glowTier(['artist'], 3)
    await delay(3000); if (!alive()) return
    clearTierGlow(3)
    clearAtomGlow()
    await delay(300); if (!alive()) return

    // T3 complete — wait for user, then collapse
    await waitForContinue(3); if (!alive()) return
    collapseTier(3)
    await delay(400); if (!alive()) return

    // T3→T4 connector
    setConnectorPhase(4)
    await delay(1100); if (!alive()) return
    setLoadingTier(4); revealTier(4)
    await delay(400); if (!alive()) return
    await delay(450); if (!alive()) return
    setLoadingTier(null)
    for (let i = 1; i <= 3; i++) {
      await delay(120); if (!alive()) return
      setPillCounts(prev => ({ ...prev, t4: i }))
    }
    const trackCount = artistTracks.length || 5
    for (let i = 1; i <= trackCount; i++) {
      await delay(30); if (!alive()) return
      setT4FieldCount(i)
    }
    await delay(300); if (!alive()) return

    // Post-build glow
    glowSeeds(['artist'])
    await delay(400); if (!alive()) return
    glowTier(['artist'], 4)
    await delay(3000); if (!alive()) return
    clearTierGlow(4)
    clearAtomGlow()
    await delay(300); if (!alive()) return

    // T4 complete — wait for user, then collapse
    await waitForContinue(4); if (!alive()) return
    collapseTier(4)
    await delay(400); if (!alive()) return

    // T4→T5 connector
    setConnectorPhase(5)
    await delay(1100); if (!alive()) return
    setLoadingTier(5); revealTier(5)
    await delay(400); if (!alive()) return
    await delay(450); if (!alive()) return
    setLoadingTier(null)
    for (let i = 1; i <= 4; i++) {
      await delay(120); if (!alive()) return
      setPillCounts(prev => ({ ...prev, t5s: i, t5t: i }))
    }
    await delay(300); if (!alive()) return
    for (let i = 1; i <= songCount; i++) {
      await delay(80); if (!alive()) return
      setSetlistLines(i)
    }
    for (let i = 1; i <= dataPoints; i++) {
      await delay(25); if (!alive()) return
      setT5FieldCount(i)
    }
    await delay(300); if (!alive()) return

    // Post-build glow — artist + venue both seed this tier
    glowSeeds(['artist', 'venue'])
    await delay(400); if (!alive()) return
    glowTier(['artist', 'venue'], 5)
    await delay(3000); if (!alive()) return
    clearTierGlow(5)
    clearAtomGlow()
    await delay(300); if (!alive()) return

    // T5 complete — wait for user, then collapse
    await waitForContinue(5); if (!alive()) return
    collapseTier(5)
    await delay(400); if (!alive()) return

    // T6 — scenes unlock, then all three seeds
    revealTier(6)
    for (let i = 1; i <= 4; i++) {
      await delay(80); if (!alive()) return
      setScenesUnlocked(i)
    }
    await delay(300); if (!alive()) return

    // Post-build glow — all three seeds
    glowSeeds(['artist', 'venue', 'date'])
    await delay(400); if (!alive()) return
    glowTier(['artist', 'venue', 'date'], 6)
    await delay(3000); if (!alive()) return
    clearTierGlow(6)
    clearAtomGlow()
    setFlowPhase('complete')
  }

  // ── Selection handlers ────────────────────────────────────────────────────

  const doDateSelect = async (concert: Concert, gen: number, autoRun = true) => {
    setSelectedConcert(concert)
    setDateOptions([])

    // setlists-cache.json is the largest of the five (831 KB) and therefore the
    // most likely to still be arriving when the cascade reaches this tier (#114).
    if (loadersRef.current) {
      await loadersRef.current.setlists
      if (gen !== genRef.current) return
    }

    let songs: string[] = []
    let tour: string | null = null
    // Pick this concert's headliner out of the entries for that date, rather
    // than whichever one happened to be stored last. Falling back to any entry
    // that has songs keeps single-act shows working when the cached artistName
    // is spelled differently from the headliner in concerts.json.
    const candidates = setlistsByConcertId.current[concert.id] ?? []
    const headliner = concert.headliner?.toLowerCase().trim()
    const hasSongs = (e: any) =>
      ((e?.setlist?.sets?.set ?? []) as any[]).some(set => (set.song ?? []).length > 0)
    const entry =
      candidates.find(e => e?.artistName?.toLowerCase().trim() === headliner && hasSongs(e)) ??
      candidates.find(e => e?.artistName?.toLowerCase().trim() === headliner) ??
      candidates.find(hasSongs) ??
      candidates[0]
    if (entry?.setlist?.sets) {
      songs = (entry.setlist.sets.set as any[])
        .flatMap((s: any) => s.song as any[])
        .filter((s: any) => !s.tape)
        .map((s: any) => s.name as string)
      tour = entry.setlist.tour?.name ?? null
    }
    setSetlistSongs(songs)
    setTourName(tour)

    const dataPoints = countSetlistDataPoints(entry)

    if (autoRun) {
      setFlowPhase('convergence')
      runFullCascade(gen, songs.length, dataPoints)
    } else {
      setFlowPhase('cascade-pending')
      pendingCascadeRef.current = { gen, songCount: songs.length, dataPoints }
      setCascadePending(true)
    }
  }

  const doVenueSelect = async (venueNorm: string, artistNorm: string, gen: number, autoRun = true, preferConcertId?: string) => {
    // See handleArtistSelect: the file may still be in flight now that the page
    // no longer waits for all five before rendering (#114).
    if (loadersRef.current) {
      await loadersRef.current.venuesMeta
      if (gen !== genRef.current) return
    }
    const vm = venuesMetaRef.current[venueNorm] ?? null
    setSelectedVenueNorm(venueNorm)
    setSelectedVenueDisplay(vm?.name ?? venueNorm)
    setVenueOptions([])
    setVenueMeta(vm)
    setFlowPhase('venue-hydrating')

    const key = `${artistNorm}::${venueNorm}`
    const available = (artistVenueToConcerts.get(key) ?? []).sort((a, b) =>
      a.date.localeCompare(b.date)
    )
    // `preferConcertId` is only ever set by the featured demo, which pins one
    // specific show rather than depending on an artist happening to have played
    // exactly one venue on exactly one night.
    const preferred = preferConcertId
      ? available.find(c => c.id === preferConcertId)
      : undefined
    if (preferred) {
      doDateSelect(preferred, gen, autoRun)
    } else if (available.length === 1) {
      doDateSelect(available[0], gen, autoRun)
    } else {
      setDateOptions(available)
      setFlowPhase('date-pending')
    }
  }

  const handleArtistSelect = async (artistNorm: string, artistDisplay: string, isPreview = false, preferConcertId?: string) => {
    if (!isPreview) setCascadePending(false)
    const gen = ++genRef.current

    setSelectedArtistNorm(artistNorm)
    setSelectedArtistDisplay(artistDisplay)
    setSelectedVenueNorm(null)
    setSelectedVenueDisplay(null)
    setSelectedConcert(null)
    setVenueOptions([])
    setDateOptions([])
    setVenueMeta(null)
    setSetlistSongs([])
    setTourName(null)
    setTiersVisible(new Set([0])); setConnectorPhase(0)
    setFlowPhase('artist-hydrating')

    // Everything above is local state and paints immediately. The two datasets
    // below may still be in flight — before #114 they could not be, because the
    // page did not render until all five files had landed. Awaiting them here is
    // what keeps that guarantee while letting the page paint early: a click that
    // beats the data waits for it rather than rendering an empty artist.
    const loaders = loadersRef.current
    if (loaders) {
      const [artistsMeta, topTracks] = await Promise.all([loaders.artistsMeta, loaders.topTracks])
      // A reset (or another selection) during the await bumps the generation.
      // Without this the stale flow would overwrite whatever the user did next.
      if (gen !== genRef.current) return
      setArtistMeta(artistsMeta[artistNorm] ?? null)
      setArtistTracks(topTracks[artistNorm]?.tracks?.slice(0, 5) ?? [])
    }

    const venues = [...(artistToVenues.get(artistNorm) ?? [])]
    // A pinned show names its own venue, so the picker is skipped even for an
    // artist seen at seven different venues.
    const preferredVenue = preferConcertId
      ? concerts.find(c => c.id === preferConcertId)?.venueNormalized
      : undefined
    if (preferredVenue) {
      doVenueSelect(preferredVenue, artistNorm, gen, !isPreview, preferConcertId)
    } else if (venues.length === 1) {
      doVenueSelect(venues[0], artistNorm, gen, !isPreview)
    } else {
      const venuesMeta = loaders ? await loaders.venuesMeta : venuesMetaRef.current
      if (gen !== genRef.current) return
      const opts = venues
        .map(vn => ({ norm: vn, display: venuesMeta[vn]?.name ?? vn }))
        .sort((a, b) => a.display.localeCompare(b.display))
      setVenueOptions(opts)
      setFlowPhase('venue-pending')
    }
  }

  const handleReset = () => {
    genRef.current++
    setFlowPhase('idle')
    setTiersVisible(new Set([0])); setConnectorPhase(0)
    setLoadingTier(null); setPillCounts({ t1a: 0, t1v: 0, t1d: 0, t2: 0, t3: 0, t4: 0, t5s: 0, t5t: 0 }); setSetlistLines(0); setScenesUnlocked(0); setT1ColStep(0); setT1FieldCount(0); setT2FieldCount(0); setT3FieldCount(0); setT4FieldCount(0); setT5FieldCount(0); setT2RevealStep(0); setCollapsedTiers(new Set()); setExpandedTier(null)
    setSelectedArtistNorm(null); setSelectedArtistDisplay(null)
    setSelectedVenueNorm(null); setSelectedVenueDisplay(null)
    setSelectedConcert(null)
    setVenueOptions([]); setDateOptions([])
    setArtistMeta(null); setVenueMeta(null)
    setArtistTracks([]); setSetlistSongs([]); setTourName(null)
    resetFocus(); setArtistSearch('')
    setCascadePending(false); pendingCascadeRef.current = null
    setTierAwaitingContinue(null); continueResolverRef.current = null
    setGlowingSeeds(new Set()); setGlowingTiers(new Map())
  }

  // ── Body style ────────────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    document.body.style.background = '#0a0a0f'
    return () => {
      document.body.style.overflow = 'hidden'
      document.body.style.background = ''
    }
  }, [])

  // ── Featured demo ─────────────────────────────────────────────────────────
  // Pinned to one specific show rather than to an artist. The previous featured
  // artist was Sting, whose only show — Pacific Amphitheatre, 1991 — has **zero
  // songs** on setlist.fm, so the tiers that exist to demonstrate setlists and
  // song→album attribution rendered empty on the page whose entire job is to
  // explain them. That is not a Sting problem: setlist.fm is crowd-sourced and
  // its coverage of 1980s and early-90s shows is thin (52% for 1985-89, 22% for
  // 1995-99, against 88% for 2020-24), so most early headliners would do the same.
  //
  // The Belasco, 2024-12-05: 18 songs, 15 of them attributed to albums spanning
  // Mommy's Little Monster (1983) to Born to Kill — forty years of catalogue in
  // one night, which is exactly what the attribution feature is for.
  //
  // Pinning the show, not the artist, also matters because Social Distortion has
  // been seen at seven venues; without `preferConcertId` the demo would stall on
  // a venue picker and the landing state would sit half-empty.
  const FEATURED_CONCERT_ID = 'concert-176'

  // Waits on `demoDataReady`, not just on the artist list. Before #114 the two
  // were the same moment — nothing rendered until all five files had landed, so
  // an artist list implied a full dataset. Now concerts.json arrives well ahead
  // of the rest, and starting the demo on that alone would walk the cascade
  // against tracks and setlists that had not arrived, ending in an empty tier
  // with nothing to say it was still loading.
  useEffect(() => {
    if (artistList.length === 0 || !demoDataReady) return
    const show = concerts.find(c => c.id === FEATURED_CONCERT_ID)
    if (!show) return
    const featured = artistList.find(a => a.norm === show.headlinerNormalized)
    if (!featured) return
    const timer = setTimeout(() => {
      setArtistSearch(featured.display)
      handleArtistSelect(featured.norm, featured.display, true, FEATURED_CONCERT_ID)
    }, 400)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistList.length, demoDataReady])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const tierEntrance = (relevant: boolean) => ({
    initial: { opacity: 0, y: 6 },
    animate: { opacity: relevant ? 1 : 0.12, y: 0 },
    transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] as const },
  })

  // Derived display values
  const venuePlace = venueMeta?.places?.[0] ?? null
  const artistGenres = artistMeta?.genres ?? []
  const artistFormed = artistMeta?.formed ?? null
  const artistBio = artistMeta?.bio?.slice(0, 200) ?? null
  const artistImage = artistMeta?.image ?? null
  const albumArt = artistTracks[0]?.albumArt ?? null
  const artistInitials = selectedArtistDisplay
    ? selectedArtistDisplay.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '??'

  const filteredArtistList = useMemo(() => {
    if (!artistSearch.trim()) return artistList
    const q = artistSearch.toLowerCase()
    return artistList.filter(a => a.display.toLowerCase().includes(q))
  }, [artistList, artistSearch])

  // T2 derived pills
  const t2Pills = [
    { key: 'formattedAddress', value: venuePlace?.formattedAddress ?? '—' },
    { key: 'placeId', value: venuePlace?.id ? 'Google Place ID' : '—', icon: 'id' as const },
    { key: 'confirmedName', value: venueMeta?.name ?? '—' },
    { key: 'city', value: venueMeta?.city ?? '—' },
    { key: 'website', value: venuePlace?.websiteUri ? new URL(venuePlace.websiteUri).hostname : '—', icon: 'link' as const },
    { key: 'photos', value: venueMeta?.photoUrls?.thumbnail ? '3 sizes' : '—', icon: 'image' as const },
  ]

  // T3 derived pills
  const t3Pills = [
    { key: 'image', value: artistImage ? 'artist photo' : '—', icon: 'image' as const, source: 'TheAudioDB' },
    { key: 'formed', value: artistFormed ? `"${artistFormed}"` : '—', source: 'TheAudioDB' },
    { key: 'country', value: artistMeta?.country ? `"${artistMeta.country}"` : '—', source: 'TheAudioDB' },
    { key: 'style', value: artistGenres[0] ? `"${artistGenres[0]}"` : '—', source: 'TheAudioDB' },
    { key: 'genres', value: artistGenres.length > 1 ? `["${artistGenres[1]}"]` : '—', source: 'Last.fm' },
    { key: 'listeners', value: '—', source: 'Last.fm' },
    { key: 'mbid', value: 'canonical ID', icon: 'id' as const, source: 'MusicBrainz' },
  ]

  return (
    <div style={{ background: '#0a0a0f', height: '100vh', overflow: 'hidden', color: '#fff' }}>
      <style>{`
        @keyframes favPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.25; transform: scale(0.85); }
        }
        @keyframes countTick {
          0%   { opacity: 0; transform: translateY(-6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .count-tick { animation: countTick 0.07s ease-out forwards; }
      `}</style>
      <div style={{ height: '100vh', overflowY: 'auto' }}>
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
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
          style={{ textAlign: 'center', padding: '24px 40px 20px', position: 'relative', zIndex: 2 }}
        >
          <div style={{ ...MONO, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 24 }}>
            Morperhaus Concert Archives
          </div>
          <h1 style={{ ...PLAYFAIR, fontSize: 48, fontWeight: 700, lineHeight: 1.1, marginBottom: 16 }}>
            The Data<br />
            <span style={{
              background: 'linear-gradient(135deg, #c084fc, #6366f1)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Enrichment Cascade
            </span>
          </h1>
          <p style={{ ...SANS, fontSize: 15, color: '#94a3b8', fontWeight: 300, maxWidth: 580, margin: '0 auto', lineHeight: 1.6 }}>
            How three words in a spreadsheet become a living archive of four decades of live music
          </p>
        </motion.header>

        {/* ── TIER 0 — SEED ROW (interactive) ── */}
        <div
          id="cascade-tier-0"
          style={{
            ...TIER_ROW_STYLE,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16,
            alignItems: 'start',
            ...tierDimStyle(isTierRelevant(0)),
          }}
        >
          {/* Artist column */}
          <div>
            {flowPhase === 'idle' || flowPhase === 'cascade-pending' || flowPhase === 'complete' ? (
              <ArtistTypeahead
                artists={filteredArtistList}
                value={artistSearch}
                onValueChange={setArtistSearch}
                onSelect={handleArtistSelect}
                glowing={glowingSeeds.has('artist')}
              />
            ) : (
              <CascadeAtom type="artist" value={selectedArtistDisplay ?? ''} focusedAtom={focusedAtom} onFocus={focusAtom} glowing={glowingSeeds.has('artist')} />
            )}
          </div>

          {/* Venue column */}
          <div>
            {flowPhase === 'venue-pending' ? (
              <VenuePicker options={venueOptions} onSelect={v => { const gen = ++genRef.current; doVenueSelect(v, selectedArtistNorm!, gen) }} />
            ) : selectedVenueDisplay ? (
              <CascadeAtom type="venue" value={selectedVenueDisplay} focusedAtom={focusedAtom} onFocus={focusAtom} glowing={glowingSeeds.has('venue')} />
            ) : (
              <PendingAtom type="venue" />
            )}
          </div>

          {/* Date column */}
          <div>
            {flowPhase === 'date-pending' ? (
              <DatePicker options={dateOptions} onSelect={c => { const gen = ++genRef.current; doDateSelect(c, gen) }} />
            ) : selectedConcert ? (
              <CascadeAtom type="date" value={selectedConcert.date} focusedAtom={focusedAtom} onFocus={focusAtom} glowing={glowingSeeds.has('date')} />
            ) : (
              <PendingAtom type="date" />
            )}
          </div>

        </div>

        {/* ── CASCADE CONTINUE BLOCK (Option B) ── */}
        <AnimatePresence>
          {cascadePending && (
            <motion.div
              key="cascade-continue"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.25 } }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.3 }}
              style={{
                textAlign: 'center',
                padding: '32px 48px',
                position: 'relative',
                zIndex: 2,
              }}
            >
              <div style={{
                ...PLAYFAIR,
                fontSize: 22,
                fontWeight: 700,
                color: '#e2e8f0',
                marginBottom: 12,
                lineHeight: 1.2,
              }}>
                Watch what happens next.
              </div>
              <p style={{
                ...SANS,
                fontSize: 15,
                color: '#6b7280',
                fontWeight: 300,
                maxWidth: 520,
                margin: '0 auto 24px',
                lineHeight: 1.65,
              }}>
                Artist, venue, date — the raw ingredients. The cascade will normalize them, then call seven APIs across six tiers to build everything you see on concerts.morperhaus.org.
              </p>
              <button
                onClick={handleStartCascade}
                style={{
                  ...MONO,
                  fontSize: 12,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: '#a5b4fc',
                  background: 'none',
                  border: '1px solid #a5b4fc40',
                  borderRadius: 4,
                  padding: '12px 36px',
                  cursor: 'pointer',
                }}
              >
                Start the cascade →
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {connectorPhase >= 1 && (
          <AnimatedConnector toColor={TIER_COLORS.t1.accent!} duration={800} />
        )}

        {/* ── TIER 1 — BUILD PIPELINE ── */}
        {tiersVisible.has(1) && (
          <AnimatePresence mode="sync">
          {collapsedTiers.has(1) && expandedTier !== 1 ? (
            <TierSummaryCard key="summary"
              color={TIER_COLORS.t1.accent!} label="Tier 1 · Structural Enrichment"
              iconText="</>" summary="19 fields derived" onClick={() => toggleExpand(1)}
            />
          ) : (
          <motion.div
            key="full"
            id="cascade-tier-1"
            {...tierEntrance(isTierRelevant(1))}
            exit={{ opacity: 0, scaleY: 0.88, transition: { duration: 0.38, ease: 'easeInOut' } }}
            style={{
              ...TIER_ROW_STYLE,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 16,
              alignItems: 'start',
              transformOrigin: 'top center',
              ...(isTierRelevant(1) ? {} : { filter: 'grayscale(0.5)' }),
              ...(glowingTiers.has(1) ? { boxShadow: `0 0 0 1px ${glowingTiers.get(1)}40, 0 0 32px ${glowingTiers.get(1)}20`, transition: 'box-shadow 0.4s ease' } : { transition: 'box-shadow 0.4s ease' }),
            }}
          >
          <div style={TIER_HEADER_STYLE}>
            <TierLabel color={TIER_COLORS.t1.label} text="Tier 1 · Structural Enrichment" />
            <TierTitle color={TIER_COLORS.t1.title}>The Build Pipeline</TierTitle>
            <TierSubtitle color={TIER_COLORS.t1.sub}>Parse, normalize, derive. No APIs — just code.</TierSubtitle>
          </div>

          {/* Artist lane — appears at t1ColStep >= 1 */}
          {t1ColStep >= 1 ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <CodeTransform fn="derive(artist)" description="normalize + assign ID" />
              <PillGrid tierColor="#8b5cf6" visibleCount={pillCounts.t1a} items={[
                { key: 'headlinerNormalized', value: selectedArtistNorm ? `"${selectedArtistNorm}"` : '—' },
                { key: 'concertId', value: selectedConcert ? `"${selectedConcert.id}"` : '…' },
                { key: 'openers', value: selectedConcert?.openers?.length ? `["${selectedConcert.openers[0]}"]` : '[]' },
              ]} />
            </motion.div>
          ) : <div />}

          {/* Venue lane — appears at t1ColStep >= 2 */}
          {t1ColStep >= 2 ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <CodeTransform fn="normalize(venue)" description="slug + location lookup" />
              <PillGrid tierColor="#6366f1" visibleCount={pillCounts.t1v} items={[
                { key: 'venueNormalized', value: selectedVenueNorm ? `"${selectedVenueNorm}"` : '—' },
                { key: 'city', value: venueMeta?.city ? `"${venueMeta.city}"` : '—' },
                { key: 'state', value: venueMeta?.state ? `"${venueMeta.state}"` : '—' },
                { key: 'cityState', value: venueMeta?.cityState ? `"${venueMeta.cityState}"` : '—' },
              ]} />
            </motion.div>
          ) : <div />}

          {/* Date lane — appears at t1ColStep >= 3 */}
          {t1ColStep >= 3 ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <CodeTransform fn="parse(date)" description="extract temporal fields" />
              <PillGrid tierColor="#64748b" visibleCount={pillCounts.t1d} items={[
                { key: 'year', value: selectedConcert ? String(selectedConcert.year) : '—' },
                { key: 'month', value: selectedConcert ? String(selectedConcert.month) : '—' },
                { key: 'day', value: selectedConcert ? String(selectedConcert.day) : '—' },
                { key: 'dayOfWeek', value: selectedConcert?.dayOfWeek ? `"${selectedConcert.dayOfWeek}"` : '—' },
                { key: 'decade', value: selectedConcert?.decade ? `"${selectedConcert.decade}"` : '—' },
              ]} />
            </motion.div>
          ) : <div />}

          {t1FieldCount > 0 && (
            <motion.div style={TIER_FOOTER_STYLE} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
                <span key={t1FieldCount} className="count-tick" style={{ ...PLAYFAIR, fontWeight: 700, fontSize: 22, lineHeight: 1, color: '#94a3b8' }}>{t1FieldCount}</span>
                <span style={{ ...SANS, fontSize: 13, fontWeight: 300, color: '#64748b' }}>fields per concert</span>
              </div>
            </motion.div>
          )}
          {tierAwaitingContinue === 1 && (
            <ContinueButton tierColor={TIER_COLORS.t1.accent!} onContinue={handleContinue} />
          )}
          </motion.div>
          )}
          </AnimatePresence>
        )}

        {connectorPhase >= 2 && (
          <AnimatedConnector toColor={TIER_COLORS.t2.accent!} duration={800} />
        )}

        {/* ── TIER 2 — GEOGRAPHIC (venue lane wide) ── */}
        {tiersVisible.has(2) && (
          <AnimatePresence mode="sync">
          {collapsedTiers.has(2) && expandedTier !== 2 ? (
            <TierSummaryCard key="summary"
              color={TIER_COLORS.t2.accent!} label="Tier 2 · Geographic Enrichment"
              domains={['google.com']} summary={venueMeta?.name ?? selectedVenueDisplay ?? '…'} onClick={() => toggleExpand(2)}
            />
          ) : (
          <motion.div
            key="full"
            id="cascade-tier-2"
            {...tierEntrance(isTierRelevant(2))}
            exit={{ opacity: 0, scaleY: 0.88, transition: { duration: 0.38, ease: 'easeInOut' } }}
            style={{
              ...TIER_ROW_STYLE,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 12,
              alignItems: 'start',
              transformOrigin: 'top center',
              ...(isTierRelevant(2) ? {} : { filter: 'grayscale(0.5)' }),
              ...(glowingTiers.has(2) ? { boxShadow: `0 0 0 1px ${glowingTiers.get(2)}40, 0 0 32px ${glowingTiers.get(2)}20`, transition: 'box-shadow 0.4s ease' } : { transition: 'box-shadow 0.4s ease' }),
            }}
          >
          <div style={TIER_HEADER_STYLE}>
            <TierLabel color={TIER_COLORS.t2.label} text="Tier 2 · Geographic Enrichment" />
            <TierTitle color={TIER_COLORS.t2.title}>Every Venue, Precisely Placed</TierTitle>
            <TierSubtitle color={TIER_COLORS.t2.sub}>Structural data becomes geographic intelligence.</TierSubtitle>
          </div>

          {/* Venue — centered */}
          {venueMeta && (
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 360 }}>
            <TierBand color="#6366f1">
              {/* Badge — appears immediately with tier */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
                style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}
              >
                <ApiBadge name="Google Places" domain="google.com" color="#4285F4" pulsing={loadingTier === 2} />
              </motion.div>
              {/* Venue photo — fades in after badge pause */}
              {t2RevealStep >= 2 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
                  {venueMeta.photoUrls?.thumbnail ? (
                    <img
                      src={venueMeta.photoUrls.thumbnail}
                      alt={venueMeta.name}
                      style={{ width: '100%', height: 40, objectFit: 'cover', borderRadius: 4, marginBottom: 10 }}
                    />
                  ) : (
                    <div style={{
                      width: '100%', height: 40,
                      background: 'rgba(99,102,241,0.1)',
                      border: '1px solid rgba(99,102,241,0.2)',
                      borderRadius: 4,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 10, fontSize: 24,
                    }}>
                      📍
                    </div>
                  )}
                  {/* Coordinate pill appears with image */}
                  <div style={{
                    ...MONO, fontSize: 9, textAlign: 'center', color: '#a5b4fc',
                    marginBottom: 10, background: 'rgba(99,102,241,0.1)',
                    padding: '4px 8px', borderRadius: 3, letterSpacing: '0.02em',
                  }}>
                    {venueMeta.location.lat.toFixed(4)}° N · {Math.abs(venueMeta.location.lng).toFixed(4)}° W
                  </div>
                </motion.div>
              )}
              <PillGrid tierColor="#6366f1" visibleCount={pillCounts.t2} items={t2Pills} />
            </TierBand>
            </div>
            </div>
          )}
          {t2FieldCount > 0 && (
            <motion.div style={TIER_FOOTER_STYLE} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
                <span key={t2FieldCount} className="count-tick" style={{ ...PLAYFAIR, fontWeight: 700, fontSize: 22, lineHeight: 1, color: '#a5b4fc' }}>{t2FieldCount}</span>
                <span style={{ ...SANS, fontSize: 13, fontWeight: 300, color: '#6366f1' }}>fields returned</span>
              </div>
            </motion.div>
          )}
          {tierAwaitingContinue === 2 && (
            <ContinueButton tierColor={TIER_COLORS.t2.accent!} onContinue={handleContinue} />
          )}
          </motion.div>
          )}
          </AnimatePresence>
        )}

        {connectorPhase >= 3 && (
          <AnimatedConnector toColor={TIER_COLORS.t3.accent!} duration={800} />
        )}

        {/* ── TIER 3 — ARTIST IDENTITY (artist lane wide) ── */}
        {tiersVisible.has(3) && (
          <AnimatePresence mode="sync">
          {collapsedTiers.has(3) && expandedTier !== 3 ? (
            <TierSummaryCard key="summary"
              color={TIER_COLORS.t3.accent!} label="Tier 3 · Artist Enrichment"
              domains={['theaudiodb.com', 'last.fm', 'musicbrainz.org']} summary={selectedArtistDisplay ?? '…'} onClick={() => toggleExpand(3)}
            />
          ) : (
          <motion.div
            key="full"
            id="cascade-tier-3"
            {...tierEntrance(isTierRelevant(3))}
            exit={{ opacity: 0, scaleY: 0.88, transition: { duration: 0.38, ease: 'easeInOut' } }}
            style={{
              ...TIER_ROW_STYLE,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 12,
              alignItems: 'start',
              transformOrigin: 'top center',
              ...(isTierRelevant(3) ? {} : { filter: 'grayscale(0.5)' }),
              ...(glowingTiers.has(3) ? { boxShadow: `0 0 0 1px ${glowingTiers.get(3)}40, 0 0 32px ${glowingTiers.get(3)}20`, transition: 'box-shadow 0.4s ease' } : { transition: 'box-shadow 0.4s ease' }),
            }}
          >
          <div style={TIER_HEADER_STYLE}>
            <TierLabel color={TIER_COLORS.t3.label} text="Tier 3 · Artist Enrichment" />
            <TierTitle color={TIER_COLORS.t3.title}>A Face and a Story</TierTitle>
            <TierSubtitle color={TIER_COLORS.t3.sub}>A name becomes a profile. Three services, one identity.</TierSubtitle>
          </div>

          {/* Artist — centered */}
          {selectedArtistDisplay && (
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 360 }}>
          <TierBand color="#8b5cf6">
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              <ApiBadge name="TheAudioDB" domain="theaudiodb.com" color="#1DA0C3" pulsing={loadingTier === 3} />
              <ApiBadge name="Last.fm" domain="last.fm" color="#D51007" pulsing={loadingTier === 3} />
              <ApiBadge name="MusicBrainz" domain="musicbrainz.org" color="#BA478F" pulsing={loadingTier === 3} />
            </div>
            {/* Artist photo or initials avatar */}
            {artistImage ? (
              <img
                src={artistImage}
                alt={selectedArtistDisplay ?? ''}
                style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', display: 'block', margin: '0 auto 10px', border: '1px solid rgba(139,92,246,0.45)' }}
              />
            ) : (
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(139,92,246,0.18)',
                border: '1px solid rgba(139,92,246,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 10px',
                ...MONO, fontSize: 15, color: '#c4b5fd', letterSpacing: '0.05em',
              }}>
                {artistInitials}
              </div>
            )}
            {/* Genre chips */}
            {artistGenres.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 }}>
                {artistGenres.slice(0, 4).map(g => (
                  <span key={g} style={{
                    ...MONO, fontSize: 7, padding: '2px 6px', borderRadius: 2,
                    background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
                    color: '#c4b5fd', letterSpacing: '0.04em',
                  }}>{g.toLowerCase()}</span>
                ))}
              </div>
            )}
            <div style={{ ...MONO, fontSize: 8, color: '#8b5cf680', textAlign: 'center', marginBottom: 8, lineHeight: 1.6 }}>
              {artistFormed ? `Formed ${artistFormed}` : ''}
            </div>
            {artistBio && (
              <div style={{ ...SANS, fontSize: 9, color: '#94a3b8', lineHeight: 1.5, textAlign: 'center', maxHeight: 42, overflow: 'hidden' }}>
                {artistBio}
              </div>
            )}
            <PillGrid tierColor="#8b5cf6" visibleCount={pillCounts.t3} items={t3Pills} />
          </TierBand>
          </div>
          </div>
          )}
          {t3FieldCount > 0 && (
            <motion.div style={TIER_FOOTER_STYLE} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
                <span key={t3FieldCount} className="count-tick" style={{ ...PLAYFAIR, fontWeight: 700, fontSize: 22, lineHeight: 1, color: '#c4b5fd' }}>{t3FieldCount}</span>
                <span style={{ ...SANS, fontSize: 13, fontWeight: 300, color: '#8b5cf6' }}>fields returned</span>
              </div>
            </motion.div>
          )}
          {tierAwaitingContinue === 3 && (
            <ContinueButton tierColor={TIER_COLORS.t3.accent!} onContinue={handleContinue} />
          )}
          </motion.div>
          )}
          </AnimatePresence>
        )}

        {connectorPhase >= 4 && (
          <AnimatedConnector toColor={TIER_COLORS.t4.accent!} duration={800} />
        )}

        {/* ── TIER 4 — AUDIO (artist lane wide) ── */}
        {tiersVisible.has(4) && (
          <AnimatePresence mode="sync">
          {collapsedTiers.has(4) && expandedTier !== 4 ? (
            <TierSummaryCard key="summary"
              color={TIER_COLORS.t4.accent!} label="Tier 4 · Audio Enrichment"
              domains={['music.apple.com']} summary={artistTracks.length > 0 ? `${artistTracks.length} tracks` : 'audio enriched'} onClick={() => toggleExpand(4)}
            />
          ) : (
          <motion.div
            key="full"
            id="cascade-tier-4"
            {...tierEntrance(isTierRelevant(4))}
            exit={{ opacity: 0, scaleY: 0.88, transition: { duration: 0.38, ease: 'easeInOut' } }}
            style={{
              ...TIER_ROW_STYLE,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 12,
              alignItems: 'start',
              transformOrigin: 'top center',
              ...(isTierRelevant(4) ? {} : { filter: 'grayscale(0.5)' }),
              ...(glowingTiers.has(4) ? { boxShadow: `0 0 0 1px ${glowingTiers.get(4)}40, 0 0 32px ${glowingTiers.get(4)}20`, transition: 'box-shadow 0.4s ease' } : { transition: 'box-shadow 0.4s ease' }),
            }}
          >
          {/* Full-width header */}
          <div style={TIER_HEADER_STYLE}>
            <TierLabel color={TIER_COLORS.t4.label} text="Tier 4 · Audio Enrichment" />
            <TierTitle color={TIER_COLORS.t4.title}>Hear Every Artist</TierTitle>
            <TierSubtitle color={TIER_COLORS.t4.sub}>The archive gets a soundtrack.</TierSubtitle>
          </div>

          {/* Apple Music — centered */}
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 360 }}>
            {selectedArtistDisplay && (
            <TierBand color="#a855f7">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <ApiBadge name="Apple Music" domain="music.apple.com" color="#FC3C44" pulsing={loadingTier === 4} />
              </div>
              {/* Album art + label */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                {albumArt ? (
                  <img src={albumArt} alt="album" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 36, height: 36, borderRadius: 6,
                    background: 'rgba(168,85,247,0.18)',
                    border: '1px solid rgba(168,85,247,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, flexShrink: 0,
                  }}>🎵</div>
                )}
                <div>
                  <div style={{ ...SANS, fontSize: 10, fontWeight: 600, color: '#d8b4fe', lineHeight: 1.2 }}>Top tracks</div>
                  <div style={{ ...SANS, fontSize: 8, fontWeight: 300, color: '#a855f770', lineHeight: 1.4 }}>
                    {artistTracks[0]?.albumName ?? '—'}
                  </div>
                </div>
              </div>
              {/* Track list */}
              <div>
                {artistTracks.slice(0, pillCounts.t4 ?? 0).map((t, i) => (
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
              {artistTracks.length === 0 && (
                <div style={{ ...MONO, fontSize: 9, color: '#a855f740', textAlign: 'center', padding: '8px 0' }}>
                  no audio data
                </div>
              )}
            </TierBand>
            )}
          </div>
          </div>
          {t4FieldCount > 0 && (
            <motion.div style={TIER_FOOTER_STYLE} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
                <span key={t4FieldCount} className="count-tick" style={{ ...PLAYFAIR, fontWeight: 700, fontSize: 22, lineHeight: 1, color: '#d8b4fe' }}>{t4FieldCount}</span>
                <span style={{ ...SANS, fontSize: 13, fontWeight: 300, color: '#a855f7' }}>tracks indexed</span>
              </div>
            </motion.div>
          )}
          {tierAwaitingContinue === 4 && (
            <ContinueButton tierColor={TIER_COLORS.t4.accent!} onContinue={handleContinue} />
          )}
          </motion.div>
          )}
          </AnimatePresence>
        )}

        {connectorPhase >= 5 && (
          <AnimatedConnector toColor={TIER_COLORS.t5.accent!} duration={800} />
        )}

        {/* ── TIER 5 — PERFORMANCE (all lanes reconverge) ── */}
        {tiersVisible.has(5) && (
          <AnimatePresence mode="sync">
          {collapsedTiers.has(5) && expandedTier !== 5 ? (
            <TierSummaryCard key="summary"
              color={TIER_COLORS.t5.accent!} label="Tier 5 · Performance Enrichment"
              domains={['setlist.fm', 'ticketmaster.com']} summary={setlistSongs.length > 0 ? `${setlistSongs.length} songs` : 'performance enriched'} onClick={() => toggleExpand(5)}
            />
          ) : (
          <motion.div
            key="full"
            id="cascade-tier-5"
            {...tierEntrance(isTierRelevant(5))}
            exit={{ opacity: 0, scaleY: 0.88, transition: { duration: 0.38, ease: 'easeInOut' } }}
            style={{
              ...TIER_ROW_STYLE,
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 16,
              alignItems: 'start',
              transformOrigin: 'top center',
              ...(isTierRelevant(5) ? {} : { filter: 'grayscale(0.5)' }),
              ...(glowingTiers.has(5) ? { boxShadow: `0 0 0 1px ${glowingTiers.get(5)}40, 0 0 32px ${glowingTiers.get(5)}20`, transition: 'box-shadow 0.4s ease' } : { transition: 'box-shadow 0.4s ease' }),
            }}
          >
          {/* Full-width header */}
          <div style={TIER_HEADER_STYLE}>
            <TierLabel color={TIER_COLORS.t5.label} text="Tier 5 · Performance Enrichment" />
            <TierTitle color={TIER_COLORS.t5.title}>Song by Song, Night by Night</TierTitle>
            <TierSubtitle color={TIER_COLORS.t5.sub}>All three atoms reconverge to find one specific night.</TierSubtitle>
          </div>

          {/* Content — centered */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 560, margin: '0 auto', width: '100%' }}>
          <div>
              <FlowArrow label="query" />

              {/* Side-by-side peer gateways */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <ServiceGatewayPeer svc={{ name: 'setlist.fm', type: 'Historical setlists' }} pulsing={loadingTier === 5} />
                <ServiceGatewayPeer svc={{ name: 'Ticketmaster', type: 'Tour dates' }} pulsing={loadingTier === 5} />
              </div>

              <FlowArrow label="response" />

              {/* Per-service outputs — metadata pills */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                <PillGrid
                  tierColor={API_BRANDS['setlist.fm'].primary}
                  visibleCount={pillCounts.t5s}
                  items={[
                    { key: 'tourName', value: tourName ? `"${tourName}"` : '—' },
                    { key: 'songs', value: setlistSongs.length ? `${setlistSongs.length} tracks` : '—' },
                    { key: 'setStructure', value: 'Set 1 + Encore' },
                    { key: 'setBreaks', value: 'positions noted' },
                  ]}
                />
                <PillGrid
                  tierColor={API_BRANDS['Ticketmaster'].primary}
                  visibleCount={pillCounts.t5t}
                  items={[
                    { key: 'opener', value: selectedConcert?.openers?.[0] ? `"${selectedConcert.openers[0]}"` : '—' },
                    { key: 'tour', value: tourName ? `"${tourName} Tour"` : '—' },
                    { key: 'eventId', value: 'TM canonical ID', icon: 'id' as const },
                    { key: 'eventUrl', value: 'ticketmaster.com/…', icon: 'link' as const },
                  ]}
                />
              </div>

              {/* Numbered setlist */}
              {setlistSongs.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
                  {setlistSongs.slice(0, setlistLines).map((song, i) => (
                    <div key={song + i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '3px 0', borderBottom: '1px solid rgba(124,58,237,0.08)' }}>
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
              )}
          </div>

          {t5FieldCount > 0 && (
            <motion.div style={TIER_FOOTER_STYLE} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
                <span key={t5FieldCount} className="count-tick" style={{ ...PLAYFAIR, fontWeight: 700, fontSize: 22, lineHeight: 1, color: '#e9d5ff' }}>{t5FieldCount}</span>
                <span style={{ ...SANS, fontSize: 13, fontWeight: 300, color: '#c084fc' }}>data points enriched</span>
              </div>
            </motion.div>
          )}
          </div>
          {tierAwaitingContinue === 5 && (
            <ContinueButton tierColor={TIER_COLORS.t5.accent!} onContinue={handleContinue} />
          )}
          </motion.div>
          )}
          </AnimatePresence>
        )}

        {/* ── TIER 6 — THE OUTPUT ── */}
        {tiersVisible.has(6) && (() => {
          const SCENES = [
            {
              id: 'timeline',
              name: 'Concert Archive',
              subtitle: `${corpusStats.totalShows} shows across ${corpusStats.yearSpan} years`,
              bg: '#ffffff',
              labelColor: '#1e293b',
              subtitleColor: '#64748b',
              borderColor: 'rgba(0,0,0,0.1)',
              activeBorderColor: 'rgba(99,102,241,0.5)',
              tiers: [
                { label: 'T1', name: 'Structural', color: '#94a3b8', desc: 'parsed dates, computed decade & day-of-week' },
              ],
              icon: (
                <svg width="128" height="64" viewBox="0 0 140 70" fill="none">
                  {/* decade tick marks */}
                  {[16, 38, 60, 82, 104, 122].map((x, i) => (
                    <line key={`tick-${i}`} x1={x} y1={28} x2={x} y2={36} stroke="#475569" strokeWidth="1" />
                  ))}
                  {/* decade labels */}
                  {[["'84",16],["'90",38],["'96",60],["'02",82],["'10",104],["'20",122]].map(([label, x], i) => (
                    <text key={`lbl-${i}`} x={Number(x)} y={46} textAnchor="middle" fontSize="7" fill="#475569" fontFamily="monospace">{label}</text>
                  ))}
                  {/* axis */}
                  <line x1="8" y1="32" x2="132" y2="32" stroke="#94a3b8" strokeWidth="1.5" />
                  {/* concert dots */}
                  {([
                    [16, 32, 3, false], [22, 32, 3, false], [38, 32, 3, false], [44, 32, 3, false],
                    [52, 32, 3, false], [60, 32, 3, false], [68, 32, 7, true], [78, 32, 3, false],
                    [82, 32, 3, false], [90, 32, 3, false], [104, 32, 3, false], [116, 32, 3, false], [122, 32, 3, false],
                  ] as [number,number,number,boolean][]).map(([x, y, r, active], i) => (
                    <g key={i}>
                      {active && <circle cx={x} cy={y} r={12} stroke="#6366f1" strokeWidth="1" opacity={0.2} />}
                      {active && <circle cx={x} cy={y} r={9} stroke="#6366f1" strokeWidth="1" opacity={0.15} />}
                      <circle cx={x} cy={y} r={r}
                        fill={active ? '#6366f1' : '#c7d2fe'}
                        stroke={active ? '#4f46e5' : 'none'} strokeWidth="1.5"
                        opacity={active ? 1 : 0.7} />
                    </g>
                  ))}
                </svg>
              ),
            },
            {
              id: 'map',
              name: 'The Geography',
              subtitle: `${corpusStats.uniqueCities} cities across the map`,
              bg: '#111827',
              labelColor: '#f9fafb',
              subtitleColor: '#9ca3af',
              borderColor: 'rgba(99,102,241,0.2)',
              activeBorderColor: 'rgba(99,102,241,0.6)',
              tiers: [
                { label: 'T2', name: 'Geographic', color: '#6366f1', desc: 'lat/lng, address, venue photos from Google Places' },
              ],
              icon: (
                <svg width="128" height="64" viewBox="0 0 140 70" fill="none">
                  {/* dark map tile background */}
                  <rect width="140" height="70" fill="#111827" rx="3" />
                  {/* organic road lines — CartoDB dark style */}
                  <path d="M 0 42 C 18 40 28 35 45 33 C 62 31 70 35 90 32 C 110 29 125 30 140 28" stroke="#1e293b" strokeWidth="1.5" fill="none" />
                  <path d="M 0 28 C 15 27 30 22 48 24 C 66 26 75 30 95 28 C 115 26 128 24 140 22" stroke="#1e293b" strokeWidth="1" fill="none" />
                  <path d="M 52 0 C 50 12 48 22 50 35 C 52 48 55 58 54 70" stroke="#1e293b" strokeWidth="1" fill="none" />
                  <path d="M 88 0 C 86 10 85 20 87 33 C 89 46 90 58 89 70" stroke="#1e293b" strokeWidth="0.75" fill="none" />
                  <path d="M 20 0 C 22 15 24 28 22 42 C 20 56 18 64 20 70" stroke="#1e293b" strokeWidth="0.75" fill="none" />
                  {/* venue markers — circles sized by concert count */}
                  {([
                    [52, 33, 9, true],   // large — busy venue
                    [88, 28, 6, false],
                    [22, 42, 5, false],
                    [115, 38, 4, false],
                    [36, 20, 4, false],
                    [72, 52, 3.5, false],
                    [105, 18, 3, false],
                    [130, 48, 3, false],
                  ] as [number,number,number,boolean][]).map(([x,y,r,featured], i) => (
                    <g key={i}>
                      {featured && <circle cx={x} cy={y} r={r + 8} fill="#6366f1" opacity={0.1} />}
                      {featured && <circle cx={x} cy={y} r={r + 4} fill="#6366f1" opacity={0.15} />}
                      <circle cx={x} cy={y} r={r} fill="#6366f1" stroke="#818cf8" strokeWidth={featured ? 1.5 : 0.75} opacity={featured ? 1 : 0.75} />
                    </g>
                  ))}
                </svg>
              ),
            },
            {
              id: 'artists',
              name: 'The Artists',
              subtitle: `${corpusStats.uniqueArtists} artists · ${corpusStats.totalShows} concerts`,
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
                <svg width="128" height="64" viewBox="0 0 140 70" fill="none">
                  {/* artist cards — 3 columns × 2 rows */}
                  {([[10,8],[52,8],[94,8],[10,40],[52,40],[94,40]] as [number,number][]).map(([x,y], i) => {
                    const colors = ['#7c3aed','#8b5cf6','#a855f7','#6366f1','#7c3aed','#8b5cf6']
                    const c = colors[i]
                    return (
                      <g key={i}>
                        <rect x={x} y={y} width="34" height="24" rx="3" fill={`${c}22`} stroke={`${c}55`} strokeWidth="0.75" />
                        {/* avatar circle */}
                        <circle cx={x + 10} cy={y + 10} r={6} fill={`${c}55`} stroke={`${c}88`} strokeWidth="0.75" />
                        {/* name lines */}
                        <rect x={x + 20} y={y + 7} width="10" height="2.5" rx="1" fill={`${c}80`} />
                        <rect x={x + 20} y={y + 12} width="7" height="2" rx="1" fill={`${c}50`} />
                        {/* genre chip */}
                        <rect x={x + 4} y={y + 19} width="12" height="2.5" rx="1" fill={`${c}40`} />
                      </g>
                    )
                  })}
                </svg>
              ),
            },
            {
              id: 'network',
              name: 'The Venues',
              subtitle: '10 most-visited venues',
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
                <svg width="128" height="64" viewBox="0 0 140 70" fill="none">
                  {/* venue → headliner links */}
                  <line x1="62" y1="36" x2="28" y2="18" stroke="#818cf8" strokeWidth="1.25" opacity="0.5" />
                  <line x1="62" y1="36" x2="96" y2="14" stroke="#818cf8" strokeWidth="1.25" opacity="0.5" />
                  <line x1="62" y1="36" x2="30" y2="56" stroke="#818cf8" strokeWidth="1.25" opacity="0.5" />
                  <line x1="62" y1="36" x2="105" y2="50" stroke="#818cf8" strokeWidth="1.25" opacity="0.5" />
                  <line x1="62" y1="36" x2="118" y2="30" stroke="#818cf8" strokeWidth="1" opacity="0.4" />
                  {/* headliner → opener links */}
                  <line x1="28" y1="18" x2="8" y2="10" stroke="#818cf8" strokeWidth="0.75" opacity="0.3" />
                  <line x1="28" y1="18" x2="12" y2="38" stroke="#818cf8" strokeWidth="0.75" opacity="0.3" />
                  <line x1="96" y1="14" x2="120" y2="6" stroke="#818cf8" strokeWidth="0.75" opacity="0.3" />
                  <line x1="105" y1="50" x2="128" y2="58" stroke="#818cf8" strokeWidth="0.75" opacity="0.3" />
                  <line x1="30" y1="56" x2="10" y2="62" stroke="#818cf8" strokeWidth="0.75" opacity="0.3" />
                  <line x1="118" y1="30" x2="132" y2="18" stroke="#818cf8" strokeWidth="0.75" opacity="0.3" />
                  {/* venue node — off-center, large indigo */}
                  <circle cx={62} cy={36} r={11} fill="#6366f1" stroke="#4f46e5" strokeWidth="1.5" />
                  {/* headliner nodes — purple, irregular positions */}
                  <circle cx={28} cy={18} r={6} fill="#8b5cf6" stroke="#7c3aed" strokeWidth="1" />
                  <circle cx={96} cy={14} r={5} fill="#8b5cf6" stroke="#7c3aed" strokeWidth="1" />
                  <circle cx={30} cy={56} r={5.5} fill="#8b5cf6" stroke="#7c3aed" strokeWidth="1" />
                  <circle cx={105} cy={50} r={4.5} fill="#8b5cf6" stroke="#7c3aed" strokeWidth="1" />
                  <circle cx={118} cy={30} r={4} fill="#8b5cf6" stroke="#7c3aed" strokeWidth="1" />
                  {/* opener nodes — pink, scattered */}
                  <circle cx={8} cy={10} r={2.5} fill="#ec4899" opacity={0.85} />
                  <circle cx={12} cy={38} r={2.5} fill="#ec4899" opacity={0.85} />
                  <circle cx={120} cy={6} r={2.5} fill="#ec4899" opacity={0.85} />
                  <circle cx={128} cy={58} r={2.5} fill="#ec4899" opacity={0.85} />
                  <circle cx={10} cy={62} r={2.5} fill="#ec4899" opacity={0.85} />
                  <circle cx={132} cy={18} r={2.5} fill="#ec4899" opacity={0.85} />
                </svg>
              ),
            },
          ]

          return (
            <motion.div
              id="cascade-tier-6"
              initial={{ opacity: 0.6 }}
              animate={{ opacity: isTierRelevant(6) ? 1 : 0.12 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              style={{
                ...TIER_ROW_STYLE,
                paddingTop: 48,
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 16,
                ...(isTierRelevant(6) ? {} : { filter: 'grayscale(0.5)' }),
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <TierLabel color="#7c3aed" text="Tier 6 · The Living Archive" />
                <TierTitle color="#ffffff">Four Scenes. 42 Years.</TierTitle>
                <TierSubtitle color="#c4b5fd">Here's what three words actually built.</TierSubtitle>
              </div>

              <div style={{ maxWidth: 780, margin: '0 auto', width: '100%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {SCENES.map((scene, sceneIndex) => {
                    const isActive = focusedScene === scene.id
                    const isUnlocked = scenesUnlocked > sceneIndex
                    return (
                      <motion.div
                        key={scene.id}
                        initial={{ opacity: 0, y: 20, scale: 0.97 }}
                        animate={isUnlocked
                          ? { opacity: 1, y: 0, scale: 1 }
                          : { opacity: 0, y: 20, scale: 0.97 }
                        }
                        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                      >
                        <button
                          onClick={() => isUnlocked && focusScene(scene.id)}
                          style={{
                            width: '100%',
                            background: scene.bg,
                            border: `1.5px solid ${isActive ? scene.activeBorderColor : scene.borderColor}`,
                            borderRadius: 10,
                            padding: '14px 16px 16px',
                            cursor: isUnlocked ? 'pointer' : 'default',
                            pointerEvents: isUnlocked ? 'auto' : 'none',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0,
                            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                            outline: 'none',
                            boxShadow: isActive ? '0 0 0 2px rgba(139,92,246,0.25)' : 'none',
                          }}
                        >
                          {/* Label — top center, mirrors real scene H1 */}
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ ...SANS, fontSize: 13, fontWeight: 600, color: scene.labelColor, lineHeight: 1.2 }}>
                              {scene.name}
                            </div>
                            <div style={{ ...SANS, fontSize: 10, fontWeight: 300, color: scene.subtitleColor, marginTop: 2 }}>
                              {scene.subtitle}
                            </div>
                          </div>
                          {/* Visual */}
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 64 }}>
                            {scene.icon}
                          </div>
                          {/* Tier chips */}
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
                            {scene.tiers.map(t => (
                              <span key={t.label} style={{
                                ...MONO, fontSize: 9, padding: '2px 6px', borderRadius: 3,
                                background: `${t.color}20`, border: `1px solid ${t.color}44`,
                                color: t.color, letterSpacing: '0.05em',
                              }}>
                                {t.label}
                              </span>
                            ))}
                          </div>
                        </button>

                      </motion.div>
                    )
                  })}
                </div>

                {scenesUnlocked >= 4 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    style={{ ...MONO, fontSize: 9, color: '#6b7280', textAlign: 'center', marginTop: 14, letterSpacing: '0.1em' }}
                  >
                    ↑ select a scene to trace its data
                  </motion.div>
                ) : (
                  <div style={{ ...MONO, fontSize: 9, color: '#374151', textAlign: 'center', marginTop: 14, letterSpacing: '0.1em' }}>
                    · · · hydrating
                  </div>
                )}
              </div>
            </motion.div>
          )
        })()}

        {/* ── FOOTER ── */}
        {flowPhase === 'complete' && (
        <motion.footer
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', padding: '36px 40px 60px', position: 'relative', zIndex: 2 }}
        >
          {/* Radial glow */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse 600px 300px at 50% 30%, rgba(139,92,246,0.08), transparent)',
            pointerEvents: 'none',
          }} />

          {/* Punchline stats — derived from this concert's actual cascade */}
          {(() => {
            const totalDataPoints = t1FieldCount + t2FieldCount + t3FieldCount + t4FieldCount + t5FieldCount
            const inputs = 3
            const ratio = totalDataPoints > 0 ? Math.round(totalDataPoints / inputs) : 0
            const stats = [
              { num: String(inputs), label: 'inputs' },
              { num: '→', label: '' },
              { num: String(totalDataPoints), label: 'data points' },
              { num: '=', label: '' },
              { num: `${ratio}×`, label: 'enrichment' },
            ]
            return (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 28, marginBottom: 28, flexWrap: 'wrap', position: 'relative' }}>
                {stats.map((stat, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{
                      ...PLAYFAIR,
                      fontSize: stat.num === '→' || stat.num === '=' ? 28 : 42,
                      fontWeight: 900, lineHeight: 1,
                      background: 'linear-gradient(135deg, #c084fc, #6366f1, #ec4899)',
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                      display: 'flex', alignItems: 'center',
                      height: stat.num === '→' || stat.num === '=' ? 42 : undefined,
                    }}>
                      {stat.num}
                    </div>
                    {stat.label && (
                      <div style={{ ...SANS, fontSize: 12, color: '#6b7280', marginTop: 3, fontWeight: 300 }}>
                        {stat.label}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          })()}

          {/* API logo row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'nowrap', marginBottom: 40, position: 'relative' }}>
            {[
              { name: 'Google Places', domain: 'google.com' },
              { name: 'TheAudioDB', domain: 'theaudiodb.com' },
              { name: 'Last.fm', domain: 'last.fm' },
              { name: 'MusicBrainz', domain: 'musicbrainz.org' },
              { name: 'Apple Music', domain: 'music.apple.com' },
              { name: 'setlist.fm', domain: 'setlist.fm' },
              { name: 'Ticketmaster', domain: 'ticketmaster.com' },
            ].map(api => (
              <span key={api.name} style={{
                ...MONO, fontSize: 11, color: '#9ca3af',
                padding: '5px 10px', border: '1px solid #2d3040',
                borderRadius: 100, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
              }}>
                <img src={`https://www.google.com/s2/favicons?domain=${api.domain}&sz=16`}
                  width={12} height={12} style={{ borderRadius: 2, opacity: 0.85 }} alt="" />
                {api.name}
              </span>
            ))}
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={handleReset}
              style={{
                ...MONO, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#8b5cf6', background: 'rgba(139,92,246,0.1)',
                border: '1px solid rgba(139,92,246,0.3)', borderRadius: 4,
                padding: '6px 16px', cursor: 'pointer',
              }}
            >
              ↺ Try another
            </button>
          </div>
        </motion.footer>
        )}

        {/* ── FOCUS RESET PILL ── */}
        {(focusedAtom || focusedScene) && (
          <motion.button
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            onClick={resetFocus}
            style={{
              position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              ...MONO, fontSize: 12, color: '#e2e8f0',
              background: 'rgba(30,27,75,0.9)', border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: 100, padding: '10px 24px', cursor: 'pointer',
              backdropFilter: 'blur(12px)', zIndex: 100,
            }}
          >
            Show All
          </motion.button>
        )}
      </div>
      </div>{/* end scroll wrapper */}

      {/* ── FLOATING SELECTION BAR — visible once cascade completes ── */}
      <AnimatePresence>
        {flowPhase === 'complete' && selectedConcert && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: 'easeOut', delay: 0.6 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '10px 24px',
              background: 'rgba(10, 10, 18, 0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderBottom: '1px solid rgba(139, 92, 246, 0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'center' }}>
              <span style={{ ...MONO, fontSize: 12, color: '#c4b5fd', letterSpacing: '0.04em' }}>
                {selectedArtistDisplay}
              </span>
              <span style={{ ...MONO, fontSize: 10, color: '#4b5563' }}>·</span>
              <span style={{ ...MONO, fontSize: 12, color: '#94a3b8' }}>
                {selectedVenueDisplay}
              </span>
              <span style={{ ...MONO, fontSize: 10, color: '#4b5563' }}>·</span>
              <span style={{ ...MONO, fontSize: 12, color: '#94a3b8' }}>
                {selectedConcert.date}
              </span>
            </div>
            <button
              onClick={handleReset}
              style={{
                ...MONO, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#8b5cf6', background: 'rgba(139,92,246,0.1)',
                border: '1px solid rgba(139,92,246,0.3)', borderRadius: 4,
                padding: '6px 16px', cursor: 'pointer', flexShrink: 0,
              }}
            >
              ↺ Try another
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
