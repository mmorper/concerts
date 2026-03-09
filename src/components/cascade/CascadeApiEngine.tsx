import { useState } from 'react'
import type { ApiService, ApiTag } from './cascadeTypes'

// ─── Brand config ─────────────────────────────────────────────────────────────

interface BrandConfig {
  primary: string
  domain: string
}

export const API_BRANDS: Record<string, BrandConfig> = {
  'Google Places':   { primary: '#4285F4', domain: 'google.com' },
  'TheAudioDB':      { primary: '#1DA0C3', domain: 'theaudiodb.com' },
  'Last.fm':         { primary: '#D51007', domain: 'last.fm' },
  'MusicBrainz':     { primary: '#BA478F', domain: 'musicbrainz.org' },
  'Apple Music':     { primary: '#FC3C44', domain: 'music.apple.com' },
  'setlist.fm':      { primary: '#EF6932', domain: 'setlist.fm' },
  'Ticketmaster':    { primary: '#026CDF', domain: 'ticketmaster.com' },
}

const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" }
const SANS: React.CSSProperties = { fontFamily: "'Source Sans 3', sans-serif" }

// ─── Data type icons (4 semantic categories only) ─────────────────────────────

export function DataTypeIcon({ type }: { type: 'image' | 'audio' | 'link' | 'id' }) {
  const paths: Record<string, React.ReactNode> = {
    image: (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ display: 'block' }}>
        <rect x="0.5" y="1.5" width="9" height="7" rx="1" stroke="currentColor" strokeWidth="1" />
        <circle cx="3" cy="4" r="0.8" fill="currentColor" opacity="0.7" />
        <path d="M0.5 7.5L3 5l2 2.5 1.5-1.5L9.5 8.5" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
      </svg>
    ),
    audio: (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ display: 'block' }}>
        <rect x="1" y="4" width="2" height="3" rx="1" fill="currentColor" />
        <rect x="4" y="1.5" width="2" height="7" rx="1" fill="currentColor" />
        <rect x="7" y="2.5" width="2" height="5" rx="1" fill="currentColor" />
      </svg>
    ),
    link: (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ display: 'block' }}>
        <path d="M1 9L8.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M4.5 1.5H8.5V5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    id: (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ display: 'block' }}>
        <path d="M2.5 1v8M7.5 1v8M0.5 3.5h9M0.5 6.5h9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  }
  return (
    <span style={{ opacity: 0.55, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>
      {paths[type]}
    </span>
  )
}

// ─── Code transform node (pure pipeline logic, no external API) ───────────────

export function CodeTransform({ fn, description }: { fn: string; description: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '12px 10px',
        borderRadius: 6,
        background: 'rgba(15,18,30,0.8)',
        border: '1px dashed rgba(100,116,139,0.25)',
        textAlign: 'center',
        marginBottom: 8,
      }}
    >
      {/* Code icon — same footprint as favicon */}
      <div
        style={{
          width: 20,
          height: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 3,
          background: 'rgba(100,116,139,0.12)',
          ...MONO,
          fontSize: 9,
          color: '#475569',
        }}
      >
        {'</>'}
      </div>
      <div style={{ ...MONO, fontSize: 11, color: '#64748b' }}>{fn}</div>
      <div style={{ ...SANS, fontSize: 9, fontWeight: 300, color: '#4b5563', lineHeight: 1.3 }}>{description}</div>
    </div>
  )
}

// ─── Flow arrow ───────────────────────────────────────────────────────────────

export function FlowArrow({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
      <span style={{ ...MONO, fontSize: 9, color: '#374151', letterSpacing: '0.15em' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
    </div>
  )
}

// ─── Service badge — centered vertical format (all contexts) ──────────────────

export function ServiceGatewayPeer({ svc, pulsing }: { svc: ApiService; pulsing?: boolean }) {
  const brand = API_BRANDS[svc.name] ?? { primary: '#6b7280', domain: '' }
  const { primary, domain } = brand

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 10px',
        borderRadius: 6,
        background: `linear-gradient(180deg, ${primary}18 0%, ${primary}09 100%)`,
        border: svc.isFallback ? `1px dashed ${primary}44` : `1px solid ${primary}55`,
        opacity: svc.isFallback ? 0.65 : 1,
        textAlign: 'center',
        gap: 6,
      }}
    >
      {domain && (
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
          alt=""
          width={20}
          height={20}
          style={{ borderRadius: 3, animation: pulsing ? 'favPulse 0.6s ease-in-out infinite' : 'none' }}
        />
      )}
      <div>
        <div style={{ ...SANS, fontSize: 11, fontWeight: 600, color: primary, lineHeight: 1.2 }}>{svc.name}</div>
        <div style={{ ...SANS, fontSize: 9, fontWeight: 300, color: `${primary}99` }}>{svc.type}</div>
        {svc.isFallback && (
          <div style={{ ...MONO, fontSize: 7, color: `${primary}66`, marginTop: 2, letterSpacing: '0.08em' }}>fallback</div>
        )}
      </div>
    </div>
  )
}

// ─── Normalized pill grid (all tiers) ────────────────────────────────────────

interface PillGridProps {
  items: ApiTag[]
  tierColor: string
  maxVisible?: number
  visibleCount?: number
}

export function PillGrid({ items, tierColor, maxVisible = 3, visibleCount }: PillGridProps) {
  const [expanded, setExpanded] = useState(false)
  // During animation, visibleCount overrides; otherwise normal expand behavior
  const effectiveMax = visibleCount !== undefined ? visibleCount : (expanded ? items.length : maxVisible)
  const shown = items.slice(0, effectiveMax)
  const hiddenCount = items.length - maxVisible

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 4,
        }}
      >
        {(shown as ApiTag[]).map(tag => {
          const chipColor = tag.source ? (API_BRANDS[tag.source]?.primary ?? tierColor) : tierColor
          return (
            <div
              key={tag.key}
              style={{
                ...MONO,
                padding: '6px 10px',
                borderRadius: 4,
                background: `${chipColor}12`,
                border: `1px solid ${chipColor}30`,
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  fontSize: 8,
                  display: 'block',
                  letterSpacing: '0.05em',
                  color: `${chipColor}90`,
                  marginBottom: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {tag.key}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: '#f0f0ff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}
              >
                {tag.icon && <DataTypeIcon type={tag.icon} />}
                {tag.value}
              </span>
            </div>
          )
        })}
      </div>
      {visibleCount === undefined && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            ...MONO,
            fontSize: 9,
            color: `${tierColor}55`,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px 0 0',
            letterSpacing: '0.1em',
            width: '100%',
            textAlign: 'center',
          }}
        >
          {expanded
            ? '↑ collapse'
            : `· · · ${hiddenCount} more field${hiddenCount !== 1 ? 's' : ''} ↓`}
        </button>
      )}
    </div>
  )
}

// ─── Main engine ──────────────────────────────────────────────────────────────

interface CascadeApiEngineProps {
  inputs: ApiTag[]
  services: ApiService[]
  outputs: ApiTag[]
  scaleLabel: string
  tierColor: string
  children?: React.ReactNode
}

export function CascadeApiEngine({
  inputs,
  services,
  outputs,
  scaleLabel,
  tierColor,
  children,
}: CascadeApiEngineProps) {
  const hex = tierColor

  return (
    <div style={{ width: '100%' }}>
      {/* Inputs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginBottom: 4 }}>
        {inputs.map(tag => (
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
            <span style={{ color: '#4b5563', fontSize: 8, display: 'block', letterSpacing: '0.04em' }}>
              {tag.key}
            </span>
            <span style={{ color: '#94a3b8' }}>{tag.value}</span>
          </div>
        ))}
      </div>

      <FlowArrow label="query" />

      {/* Services — always centered badges, flex row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        {services.map(svc => (
          <ServiceGatewayPeer key={svc.name} svc={svc} />
        ))}
      </div>

      <FlowArrow label="response" />

      <PillGrid items={outputs} tierColor={hex} />

      {children}

      {/* Scale */}
      <div
        style={{
          textAlign: 'center',
          ...MONO,
          fontSize: 10,
          marginTop: 12,
          letterSpacing: '0.05em',
          color: `${hex}80`,
        }}
      >
        {scaleLabel}
      </div>
    </div>
  )
}
