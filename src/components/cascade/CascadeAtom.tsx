import type { FocusAtom } from './cascadeTypes'

const ATOM_COLORS: Record<string, string> = {
  date: '#64748b',
  venue: '#6366f1',
  artist: '#8b5cf6',
}

interface CascadeAtomProps {
  type: 'date' | 'venue' | 'artist'
  value: string
  focusedAtom: FocusAtom
  onFocus: (atom: FocusAtom) => void
}

export function CascadeAtom({ type, value, focusedAtom, onFocus }: CascadeAtomProps) {
  const color = ATOM_COLORS[type]
  const isFocused = focusedAtom === type
  const isDimmed = focusedAtom !== null && !isFocused

  return (
    <div
      onClick={() => onFocus(type)}
      style={{
        background: '#1e2028',
        border: `1px solid ${isFocused ? color : '#2d3040'}`,
        borderRadius: 6,
        padding: '20px',
        fontFamily: "'JetBrains Mono', monospace",
        cursor: 'pointer',
        textAlign: 'center',
        width: '100%',
        opacity: isDimmed ? 0.2 : 1,
        transform: isDimmed ? 'scale(0.95)' : 'scale(1)',
        boxShadow: isFocused ? `0 0 24px ${color}40` : 'none',
        transition: 'all 0.4s ease',
      }}
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#4b5563',
          marginBottom: 8,
        }}
      >
        {type}
      </div>
      <div style={{ fontSize: 17, color: '#9ca3af' }}>{value}</div>
    </div>
  )
}
