interface UpcomingBadgeProps {
  /** "md" = card image overlay (10px font, 5px dot); "sm" = gatefold row inline (9px font, 4px dot) */
  size?: 'sm' | 'md'
}

/**
 * Pill badge indicating an upcoming concert.
 * Shared between Timeline card image overlay and Artist gatefold concert history rows.
 */
export function UpcomingBadge({ size = 'md' }: UpcomingBadgeProps) {
  const isSm = size === 'sm'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        background: '#4f46e5',
        color: 'white',
        borderRadius: isSm ? '12px' : '20px',
        padding: isSm ? '2px 7px 2px 5px' : '3px 9px 3px 7px',
        fontSize: isSm ? '9px' : '10px',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        fontFamily: "'Source Sans 3', system-ui, sans-serif",
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        lineHeight: 1,
      }}
      aria-label="Upcoming concert"
    >
      <span
        className="animate-upcoming-dot"
        style={{
          width: isSm ? '4px' : '5px',
          height: isSm ? '4px' : '5px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.8)',
          flexShrink: 0,
          display: 'inline-block',
        }}
        aria-hidden="true"
      />
      UPCOMING
    </span>
  )
}
