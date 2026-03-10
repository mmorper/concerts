import { useRef, useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CascadeLanes } from './CascadeLanes'
import { CascadeAtom } from './CascadeAtom'
import { ServiceGatewayPeer, CodeTransform, FlowArrow, API_BRANDS, PillGrid } from './CascadeApiEngine'
import { useCascadeFocus } from './useCascadeFocus'

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

// ─── Helper components ────────────────────────────────────────────────────────

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

function CorpusScale({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ ...MONO, fontSize: 9, color: `${color}55`, textAlign: 'center', marginTop: 10, letterSpacing: '0.05em' }}>
      {children}
    </div>
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

function ArtistPicker({
  artists,
  search,
  onSearchChange,
  onSelect,
}: {
  artists: { norm: string; display: string }[]
  search: string
  onSearchChange: (v: string) => void
  onSelect: (norm: string, display: string) => void
}) {
  return (
    <div>
      <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#4b5563', marginBottom: 8, textAlign: 'center' }}>
        artist
      </div>
      <input
        type="text"
        placeholder="search artists…"
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        style={{
          width: '100%',
          ...MONO,
          fontSize: 10,
          background: '#0d0f18',
          border: '1px solid #2d3040',
          borderRadius: 4,
          padding: '6px 10px',
          color: '#9ca3af',
          marginBottom: 4,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ maxHeight: 168, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {artists.map(a => (
          <button
            key={a.norm}
            onClick={() => onSelect(a.norm, a.display)}
            style={{ ...PICKER_BTN, color: '#9ca3af' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1a1e2a')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            {a.display}
          </button>
        ))}
        {artists.length === 0 && (
          <div style={{ ...MONO, fontSize: 9, color: '#374151', textAlign: 'center', padding: '12px 0' }}>no match</div>
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
  return (
    <div>
      <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#4b5563', marginBottom: 8, textAlign: 'center' }}>
        venue
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {options.map(o => (
          <button
            key={o.norm}
            onClick={() => onSelect(o.norm)}
            style={{ ...PICKER_BTN, color: '#a5b4fc' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1a1e2a')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            {o.display}
          </button>
        ))}
      </div>
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
      background: '#0d0f18',
      border: '1px solid #161920',
      borderRadius: 6,
      padding: '20px',
      textAlign: 'center',
      opacity: 0.25,
    }}>
      <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#4b5563', marginBottom: 8 }}>
        {type}
      </div>
      <div style={{ fontSize: 17, color: '#374151' }}>· · ·</div>
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
  const setlistsByConcertId = useRef<Record<string, any>>({})

  useEffect(() => {
    Promise.all([
      fetch('/data/concerts.json').then(r => r.json()),
      fetch('/data/artists-metadata.json').then(r => r.json()),
      fetch('/data/venues-metadata.json').then(r => r.json()),
      fetch('/data/artists-top-tracks.json').then(r => r.json()),
      fetch('/data/setlists-cache.json').then(r => r.json()),
    ]).then(([c, am, vm, tt, sl]) => {
      setConcerts(c.concerts ?? [])
      artistsMetaRef.current = am
      venuesMetaRef.current = vm
      topTracksRef.current = tt
      const slMap: Record<string, any> = {}
      Object.values(sl.entries ?? {}).forEach((entry: any) => {
        if (entry.concertId) slMap[entry.concertId] = entry
      })
      setlistsByConcertId.current = slMap
    })
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

  // ── Animation state ───────────────────────────────────────────────────────
  const genRef = useRef(0)
  const [animStep, setAnimStep] = useState(0)
  const [loadingTier, setLoadingTier] = useState<number | null>(null)
  const [pillCounts, setPillCounts] = useState<Partial<Record<string, number>>>({})
  const [setlistLines, setSetlistLines] = useState(0)
  const [scenesUnlocked, setScenesUnlocked] = useState(0)

  // ── Animation phase 1: artist tiers (T0 → T1a → T2 dormant → T3 → T4) ──

  const runArtistAnim = async (gen: number) => {
    const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
    const alive = () => genRef.current === gen

    setAnimStep(0); setLoadingTier(null); setPillCounts({}); setSetlistLines(0); setScenesUnlocked(0)
    await delay(100); if (!alive()) return

    setAnimStep(1) // T0 seeds visible
    await delay(600); if (!alive()) return

    setAnimStep(2) // T1 visible
    await delay(200); if (!alive()) return
    for (let i = 1; i <= 3; i++) {
      await delay(80); if (!alive()) return
      setPillCounts(prev => ({ ...prev, t1a: i }))
    }
    await delay(300); if (!alive()) return

    setAnimStep(3) // T2 visible (dormant — no venue data yet)
    await delay(500); if (!alive()) return

    setLoadingTier(3); setAnimStep(4) // T3 visible
    await delay(600); if (!alive()) return
    setLoadingTier(null)
    for (let i = 1; i <= 7; i++) {
      await delay(80); if (!alive()) return
      setPillCounts(prev => ({ ...prev, t3: i }))
    }
    await delay(300); if (!alive()) return

    setLoadingTier(4); setAnimStep(5) // T4 visible
    await delay(600); if (!alive()) return
    setLoadingTier(null)
    for (let i = 1; i <= 3; i++) {
      await delay(80); if (!alive()) return
      setPillCounts(prev => ({ ...prev, t4: i }))
    }
    await delay(400); if (!alive()) return
  }

  // ── Animation phase 2: venue tier (T2 activates + T1v pills) ─────────────

  const runVenueAnim = async (gen: number) => {
    const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
    const alive = () => genRef.current === gen

    setLoadingTier(2)
    await delay(600); if (!alive()) return
    setLoadingTier(null)
    for (let i = 1; i <= 6; i++) {
      await delay(80); if (!alive()) return
      setPillCounts(prev => ({ ...prev, t2: i }))
    }
    for (let i = 1; i <= 4; i++) {
      await delay(80); if (!alive()) return
      setPillCounts(prev => ({ ...prev, t1v: i }))
    }
    await delay(300); if (!alive()) return
  }

  // ── Animation phase 3: convergence (T1d pills + T5 + T6) ─────────────────

  const runConvergenceAnim = async (gen: number, songCount: number) => {
    const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
    const alive = () => genRef.current === gen

    for (let i = 1; i <= 5; i++) {
      await delay(80); if (!alive()) return
      setPillCounts(prev => ({ ...prev, t1d: i }))
    }
    await delay(200); if (!alive()) return

    setLoadingTier(5); setAnimStep(6)
    await delay(600); if (!alive()) return
    setLoadingTier(null)
    for (let i = 1; i <= 4; i++) {
      await delay(80); if (!alive()) return
      setPillCounts(prev => ({ ...prev, t5s: i, t5t: i }))
    }
    await delay(300); if (!alive()) return
    for (let i = 1; i <= songCount; i++) {
      await delay(60); if (!alive()) return
      setSetlistLines(i)
    }
    await delay(400); if (!alive()) return
    for (let i = 1; i <= 4; i++) {
      await delay(80); if (!alive()) return
      setScenesUnlocked(i)
    }
    setAnimStep(7)
    setFlowPhase('complete')
  }

  // ── Selection handlers ────────────────────────────────────────────────────

  const doDateSelect = (concert: Concert, gen: number) => {
    setSelectedConcert(concert)
    setDateOptions([])
    setFlowPhase('convergence')

    let songs: string[] = []
    let tour: string | null = null
    const entry = setlistsByConcertId.current[concert.id]
    if (entry?.setlist?.sets) {
      songs = (entry.setlist.sets.set as any[])
        .flatMap((s: any) => s.song as any[])
        .filter((s: any) => !s.tape)
        .map((s: any) => s.name as string)
      tour = entry.setlist.tour?.name ?? null
    }
    setSetlistSongs(songs)
    setTourName(tour)
    runConvergenceAnim(gen, songs.length)
  }

  const doVenueSelect = (venueNorm: string, artistNorm: string, gen: number) => {
    const vm = venuesMetaRef.current[venueNorm] ?? null
    setSelectedVenueNorm(venueNorm)
    setSelectedVenueDisplay(vm?.name ?? venueNorm)
    setVenueOptions([])
    setVenueMeta(vm)
    setFlowPhase('venue-hydrating')

    ;(async () => {
      await runVenueAnim(gen)
      if (genRef.current !== gen) return

      const key = `${artistNorm}::${venueNorm}`
      const available = (artistVenueToConcerts.get(key) ?? []).sort((a, b) =>
        a.date.localeCompare(b.date)
      )
      if (available.length === 1) {
        doDateSelect(available[0], gen)
      } else {
        setDateOptions(available)
        setFlowPhase('date-pending')
      }
    })()
  }

  const handleArtistSelect = (artistNorm: string, artistDisplay: string) => {
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
    setArtistMeta(artistsMetaRef.current[artistNorm] ?? null)
    setArtistTracks(topTracksRef.current[artistNorm]?.tracks?.slice(0, 5) ?? [])
    setFlowPhase('artist-hydrating')

    ;(async () => {
      await runArtistAnim(gen)
      if (genRef.current !== gen) return

      const venues = [...(artistToVenues.get(artistNorm) ?? [])]
      if (venues.length === 1) {
        doVenueSelect(venues[0], artistNorm, gen)
      } else {
        const opts = venues
          .map(vn => ({ norm: vn, display: venuesMetaRef.current[vn]?.name ?? vn }))
          .sort((a, b) => a.display.localeCompare(b.display))
        setVenueOptions(opts)
        setFlowPhase('venue-pending')
      }
    })()
  }

  const handleReset = () => {
    genRef.current++
    setFlowPhase('idle')
    setAnimStep(0); setLoadingTier(null); setPillCounts({}); setSetlistLines(0); setScenesUnlocked(0)
    setSelectedArtistNorm(null); setSelectedArtistDisplay(null)
    setSelectedVenueNorm(null); setSelectedVenueDisplay(null)
    setSelectedConcert(null)
    setVenueOptions([]); setDateOptions([])
    setArtistMeta(null); setVenueMeta(null)
    setArtistTracks([]); setSetlistSongs([]); setTourName(null)
    resetFocus(); setArtistSearch('')
  }

  // ── Body style ────────────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = 'auto'
    document.body.style.background = '#0a0a0f'
    return () => {
      document.body.style.overflow = 'hidden'
      document.body.style.background = ''
    }
  }, [])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const tierAnim = (step: number, relevant = true) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: animStep >= step ? (relevant ? 1 : 0.12) : 0, y: animStep >= step ? 0 : 16 },
    transition: { duration: 0.4, ease: 'easeOut' },
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
    <div style={{ background: '#0a0a0f', minHeight: '100vh', color: '#fff' }}>
      <style>{`
        @keyframes favPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.25; transform: scale(0.85); }
        }
      `}</style>
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
          style={{ textAlign: 'center', padding: '80px 40px 40px', position: 'relative', zIndex: 2 }}
        >
          <div style={{ ...MONO, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 24 }}>
            Morperhaus Concert Archives
          </div>
          <h1 style={{ ...PLAYFAIR, fontSize: 48, fontWeight: 900, lineHeight: 1.1, marginBottom: 20 }}>
            The Data<br />
            <span style={{
              background: 'linear-gradient(135deg, #c084fc, #6366f1)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Enrichment Cascade
            </span>
          </h1>
          <p style={{ ...SANS, fontSize: 18, color: '#94a3b8', fontWeight: 300, maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
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
          <div style={TIER_HEADER_STYLE}>
            <TierLabel color={TIER_COLORS.t0.label} text="Tier 0 · The Source" />
            <TierTitle color={TIER_COLORS.t0.title}>Three Atoms</TierTitle>
            <TierSubtitle color={TIER_COLORS.t0.sub}>One row in a spreadsheet. That's the whole input.</TierSubtitle>
          </div>

          {/* Artist column */}
          {flowPhase === 'idle' ? (
            <ArtistPicker
              artists={filteredArtistList}
              search={artistSearch}
              onSearchChange={setArtistSearch}
              onSelect={handleArtistSelect}
            />
          ) : (
            <CascadeAtom type="artist" value={selectedArtistDisplay ?? ''} focusedAtom={focusedAtom} onFocus={focusAtom} />
          )}

          {/* Venue column */}
          {flowPhase === 'venue-pending' ? (
            <VenuePicker options={venueOptions} onSelect={v => { const gen = ++genRef.current; doVenueSelect(v, selectedArtistNorm!, gen) }} />
          ) : selectedVenueDisplay ? (
            <CascadeAtom type="venue" value={selectedVenueDisplay} focusedAtom={focusedAtom} onFocus={focusAtom} />
          ) : (
            <PendingAtom type="venue" />
          )}

          {/* Date column */}
          {flowPhase === 'date-pending' ? (
            <DatePicker options={dateOptions} onSelect={c => { const gen = ++genRef.current; doDateSelect(c, gen) }} />
          ) : selectedConcert ? (
            <CascadeAtom type="date" value={selectedConcert.date} focusedAtom={focusedAtom} onFocus={focusAtom} />
          ) : (
            <PendingAtom type="date" />
          )}

          {/* Hint / reset row */}
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: 8 }}>
            {flowPhase === 'idle' ? (
              <div style={{ ...MONO, fontSize: 9, color: '#374151', letterSpacing: '0.1em' }}>
                {concerts.length > 0 ? 'select an artist to begin the cascade ↓' : 'loading…'}
              </div>
            ) : (
              <button
                onClick={handleReset}
                style={{ ...MONO, fontSize: 9, letterSpacing: '0.12em', color: '#374151', background: 'none', border: '1px solid #1e2028', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}
              >
                ↻ reset
              </button>
            )}
          </div>

          {flowPhase !== 'idle' && (
            <div style={{ gridColumn: '1 / -1', ...MONO, fontSize: 12, color: '#4b5563', textAlign: 'center' }}>
              180 concerts × 3 fields ={' '}
              <span style={{ color: '#6b7280' }}>540 total inputs</span>
            </div>
          )}
        </div>

        {/* ── TIER 1 — BUILD PIPELINE ── */}
        <motion.div
          id="cascade-tier-1"
          {...tierAnim(2, isTierRelevant(1))}
          style={{
            ...TIER_ROW_STYLE,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16,
            alignItems: 'start',
            ...(isTierRelevant(1) ? {} : { filter: 'grayscale(0.5)' }),
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
            <PillGrid tierColor="#8b5cf6" visibleCount={pillCounts.t1a} items={[
              { key: 'headlinerNormalized', value: selectedArtistNorm ? `"${selectedArtistNorm}"` : '—' },
              { key: 'concertId', value: selectedConcert ? `"${selectedConcert.id}"` : '…' },
              { key: 'openers', value: selectedConcert?.openers?.length ? `["${selectedConcert.openers[0]}"]` : '[]' },
            ]} />
          </div>

          {/* Venue lane */}
          <div>
            <CodeTransform fn="normalize(venue)" description="slug + location lookup" />
            <PillGrid tierColor="#6366f1" visibleCount={pillCounts.t1v} items={[
              { key: 'venueNormalized', value: selectedVenueNorm ? `"${selectedVenueNorm}"` : '—' },
              { key: 'city', value: venueMeta?.city ? `"${venueMeta.city}"` : '—' },
              { key: 'state', value: venueMeta?.state ? `"${venueMeta.state}"` : '—' },
              { key: 'cityState', value: venueMeta?.cityState ? `"${venueMeta.cityState}"` : '—' },
            ]} />
          </div>

          {/* Date lane */}
          <div>
            <CodeTransform fn="parse(date)" description="extract temporal fields" />
            <PillGrid tierColor="#64748b" visibleCount={pillCounts.t1d} items={[
              { key: 'year', value: selectedConcert ? String(selectedConcert.year) : '—' },
              { key: 'month', value: selectedConcert ? String(selectedConcert.month) : '—' },
              { key: 'day', value: selectedConcert ? String(selectedConcert.day) : '—' },
              { key: 'dayOfWeek', value: selectedConcert?.dayOfWeek ? `"${selectedConcert.dayOfWeek}"` : '—' },
              { key: 'decade', value: selectedConcert?.decade ? `"${selectedConcert.decade}"` : '—' },
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
          {...tierAnim(3, isTierRelevant(2))}
          style={{
            ...TIER_ROW_STYLE,
            display: 'grid',
            gridTemplateColumns: '0.6fr 2.4fr 0.6fr',
            gap: 12,
            alignItems: 'start',
            ...(isTierRelevant(2) ? {} : { filter: 'grayscale(0.5)' }),
          }}
        >
          <div style={TIER_HEADER_STYLE}>
            <TierLabel color={TIER_COLORS.t2.label} text="Tier 2 · Geographic Enrichment" />
            <TierTitle color={TIER_COLORS.t2.title}>Every Venue, Precisely Placed</TierTitle>
            <TierSubtitle color={TIER_COLORS.t2.sub}>Structural data becomes geographic intelligence.</TierSubtitle>
          </div>

          {/* Artist — dormant */}
          <div style={{ minHeight: 60 }} />

          {/* Venue — active (or dormant placeholder) */}
          <TierBand color="#6366f1">
            {!venueMeta ? (
              // Dormant pass-through during artist animation
              <div style={{ textAlign: 'center', padding: '20px 0', ...MONO, fontSize: 11, color: '#6366f118' }}>
                · · ·
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                  <ApiBadge name="Google Places" domain="google.com" color="#4285F4" pulsing={loadingTier === 2} />
                </div>
                {/* Venue photo */}
                {venueMeta.photoUrls?.thumbnail ? (
                  <img
                    src={venueMeta.photoUrls.thumbnail}
                    alt={venueMeta.name}
                    style={{ width: '100%', height: 56, objectFit: 'cover', borderRadius: 4, marginBottom: 10 }}
                  />
                ) : (
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
                )}
                {/* Coordinate pill */}
                <div style={{
                  ...MONO, fontSize: 9, textAlign: 'center', color: '#a5b4fc',
                  marginBottom: 10, background: 'rgba(99,102,241,0.1)',
                  padding: '4px 8px', borderRadius: 3, letterSpacing: '0.02em',
                }}>
                  {venueMeta.location.lat.toFixed(4)}° N · {Math.abs(venueMeta.location.lng).toFixed(4)}° W
                </div>
                <PillGrid tierColor="#6366f1" visibleCount={pillCounts.t2} items={t2Pills} />
                <CorpusScale color="#6366f1">× 77 venues · 35 cities</CorpusScale>
              </>
            )}
          </TierBand>

          {/* Date — dormant */}
          <div style={{ minHeight: 60 }} />
        </motion.div>

        {/* ── TIER 3 — ARTIST IDENTITY (artist lane wide) ── */}
        <motion.div
          id="cascade-tier-3"
          {...tierAnim(4, isTierRelevant(3))}
          style={{
            ...TIER_ROW_STYLE,
            display: 'grid',
            gridTemplateColumns: '2.4fr 0.6fr 0.6fr',
            gap: 12,
            alignItems: 'start',
            ...(isTierRelevant(3) ? {} : { filter: 'grayscale(0.5)' }),
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
              <ApiBadge name="TheAudioDB" domain="theaudiodb.com" color="#1DA0C3" pulsing={loadingTier === 3} />
              <ApiBadge name="Last.fm" domain="last.fm" color="#D51007" pulsing={loadingTier === 3} />
              <ApiBadge name="MusicBrainz" domain="musicbrainz.org" color="#BA478F" pulsing={loadingTier === 3} />
            </div>
            {/* Artist photo or initials avatar */}
            {artistImage ? (
              <img
                src={artistImage}
                alt={selectedArtistDisplay ?? ''}
                style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', display: 'block', margin: '0 auto 10px', border: '1px solid rgba(139,92,246,0.45)' }}
              />
            ) : (
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
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
          {...tierAnim(5, isTierRelevant(4))}
          style={{
            ...TIER_ROW_STYLE,
            display: 'grid',
            gridTemplateColumns: '2.4fr 0.6fr 0.6fr',
            gap: 12,
            alignItems: 'start',
            ...(isTierRelevant(4) ? {} : { filter: 'grayscale(0.5)' }),
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
              <ApiBadge name="Apple Music" domain="music.apple.com" color="#FC3C44" pulsing={loadingTier === 4} />
            </div>
            {/* Album art + label */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              {albumArt ? (
                <img src={albumArt} alt="album" style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: 48, height: 48, borderRadius: 6,
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
            {artistTracks.length === 0 && animStep >= 5 && (
              <div style={{ ...MONO, fontSize: 9, color: '#a855f740', textAlign: 'center', padding: '8px 0' }}>
                no audio data
              </div>
            )}
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
          {...tierAnim(6, isTierRelevant(5))}
          style={{
            ...TIER_ROW_STYLE,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16,
            alignItems: 'start',
            ...(isTierRelevant(5) ? {} : { filter: 'grayscale(0.5)' }),
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
                  { label: 'artist', value: selectedArtistDisplay ?? '—', color: '#8b5cf6' },
                  { label: '+', value: '', color: '#4b5563' },
                  { label: 'venue', value: selectedVenueDisplay ?? '—', color: '#6366f1' },
                  { label: '+', value: '', color: '#4b5563' },
                  { label: 'date', value: selectedConcert?.date ?? '—', color: '#64748b' },
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
              <div style={{ marginTop: 16 }}>
                <div style={{ ...MONO, fontSize: 8, letterSpacing: '0.15em', color: '#7c3aed', marginBottom: 8, textAlign: 'center' }}>
                  SETLIST — {selectedConcert?.date ?? '—'}
                </div>
                {setlistSongs.length === 0 && animStep >= 6 && (
                  <div style={{ ...MONO, fontSize: 9, color: '#7c3aed40', textAlign: 'center', padding: '8px 0' }}>
                    setlist not available
                  </div>
                )}
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
          {...tierAnim(6)}
          style={{ textAlign: 'center', padding: '8px 16px 0', position: 'relative', zIndex: 2 }}
        >
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
                <div style={{ ...MONO, fontSize: 9, padding: '3px 8px', borderRadius: 4, background: `${t.color}12`, border: `1px solid ${t.color}30`, color: t.color, lineHeight: 1.5 }}>
                  <span style={{ fontSize: 7, letterSpacing: '0.1em', opacity: 0.7, display: 'block' }}>{t.label}</span>
                  {t.count}
                </div>
              </div>
            ))}
            <span style={{ ...MONO, fontSize: 11, color: '#374151' }}>=</span>
            <div style={{
              ...PLAYFAIR, fontSize: 22, fontWeight: 700,
              background: 'linear-gradient(135deg, #c084fc, #6366f1)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              23,000+
            </div>
          </div>
          <div style={{ ...SANS, fontSize: 11, color: '#374151', marginBottom: 10, fontWeight: 300 }}>
            data points assembled into
          </div>
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
              {...tierAnim(1, isTierRelevant(6))}
              style={{
                ...TIER_ROW_STYLE,
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 16,
                ...(isTierRelevant(6) ? {} : { filter: 'grayscale(0.5)' }),
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <TierLabel color="#7c3aed" text="Tier 6 · The Living Archive" />
                <TierTitle color="#ffffff">Four Scenes. 42 Years.</TierTitle>
                <TierSubtitle color="#c4b5fd">Here's what three words actually built.</TierSubtitle>
              </div>

              <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {SCENES.map((scene, sceneIndex) => {
                    const isActive = focusedScene === scene.id
                    const isUnlocked = scenesUnlocked > sceneIndex
                    return (
                      <motion.div
                        key={scene.id}
                        animate={{
                          opacity: isUnlocked ? 1 : 0.15,
                          filter: isUnlocked ? 'grayscale(0)' : 'grayscale(1)',
                        }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      >
                        <button
                          onClick={() => isUnlocked && focusScene(scene.id)}
                          style={{
                            width: '100%',
                            background: scene.bg,
                            border: `1.5px solid ${isActive ? scene.activeBorderColor : scene.borderColor}`,
                            borderRadius: 10,
                            padding: '14px 12px 10px',
                            cursor: isUnlocked ? 'pointer' : 'default',
                            pointerEvents: isUnlocked ? 'auto' : 'none',
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
                              <span key={t.label} style={{
                                ...MONO, fontSize: 8, padding: '2px 5px', borderRadius: 3,
                                background: `${t.color}20`, border: `1px solid ${t.color}44`,
                                color: t.color, letterSpacing: '0.05em',
                              }}>
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
                              <div style={{
                                background: 'rgba(15,18,30,0.95)',
                                border: '1px solid rgba(139,92,246,0.25)',
                                borderRadius: 8,
                                padding: '12px 14px',
                                display: 'flex', flexDirection: 'column', gap: 8,
                              }}>
                                <div style={{ ...MONO, fontSize: 8, letterSpacing: '0.12em', color: '#6b7280', textTransform: 'uppercase' }}>
                                  Powered by
                                </div>
                                {scene.tiers.map(t => (
                                  <div key={t.label} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                    <span style={{
                                      ...MONO, fontSize: 9, padding: '2px 6px', borderRadius: 3,
                                      background: `${t.color}20`, border: `1px solid ${t.color}55`,
                                      color: t.color, flexShrink: 0, letterSpacing: '0.04em',
                                    }}>
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
                    {animStep === 0 && flowPhase === 'idle' ? '' : '· · · hydrating'}
                  </div>
                )}
              </div>
            </motion.div>
          )
        })()}

        {/* ── FOOTER ── */}
        <motion.footer
          {...tierAnim(7)}
          style={{ textAlign: 'center', padding: '80px 40px 100px', position: 'relative', zIndex: 2 }}
        >
          {/* Radial glow */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse 600px 300px at 50% 30%, rgba(139,92,246,0.08), transparent)',
            pointerEvents: 'none',
          }} />

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
                <div style={{
                  ...PLAYFAIR,
                  fontSize: stat.num === '→' || stat.num === '=' ? 36 : 56,
                  fontWeight: 900, lineHeight: 1,
                  background: 'linear-gradient(135deg, #c084fc, #6366f1, #ec4899)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                  display: 'flex', alignItems: 'center',
                  height: stat.num === '→' || stat.num === '=' ? 56 : undefined,
                }}>
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

          <p style={{
            ...PLAYFAIR, fontSize: 24, fontWeight: 400, fontStyle: 'italic',
            color: '#c4b5fd', marginBottom: 36, lineHeight: 1.4, position: 'relative',
          }}>
            7 APIs. 4 scenes. 42 years.<br />Three words started it all.
          </p>

          {/* API logo row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 40, position: 'relative' }}>
            {['Google Places', 'TheAudioDB', 'Last.fm', 'MusicBrainz', 'Apple Music', 'setlist.fm', 'Ticketmaster'].map(api => (
              <span key={api} style={{ ...MONO, fontSize: 11, color: '#4b5563', padding: '6px 14px', border: '1px solid #1e2028', borderRadius: 100 }}>
                {api}
              </span>
            ))}
          </div>

          {/* CTA */}
          <a
            href="https://concerts.morperhaus.org"
            style={{ ...MONO, fontSize: 16, color: '#6366f1', textDecoration: 'none', padding: '12px 28px', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, display: 'inline-block', position: 'relative' }}
          >
            concerts.morperhaus.org
          </a>
        </motion.footer>

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
    </div>
  )
}
