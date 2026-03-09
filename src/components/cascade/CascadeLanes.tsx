import { type RefObject } from 'react'
import { useCascadeLanes } from './useCascadeLanes'
import type { FocusAtom } from './cascadeTypes'

interface CascadeLanesProps {
  containerRef: RefObject<HTMLElement | null>
  focusedAtom: FocusAtom
}

const LANE_NAMES = ['artist', 'venue', 'date'] as const

export function CascadeLanes({ containerRef, focusedAtom }: CascadeLanesProps) {
  const { paths, svgSize, LANE_COLORS } = useCascadeLanes(containerRef)

  if (!svgSize.w || !svgSize.h) return null

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: svgSize.h,
        pointerEvents: 'none',
        zIndex: 0,
      }}
      viewBox={`0 0 ${svgSize.w} ${svgSize.h}`}
    >
      <defs>
        <filter id="laneBlur" x="-20%" y="-5%" width="140%" height="110%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      {paths.fills.map((d, i) => {
        if (!d) return null
        const laneName = LANE_NAMES[i]
        const isFocused = focusedAtom === laneName
        const isDimmed = focusedAtom !== null && !isFocused

        return (
          <g key={laneName}>
            <path
              d={d}
              fill={LANE_COLORS[i]}
              opacity={isFocused ? 0.28 : isDimmed ? 0.04 : 0.15}
              filter="url(#laneBlur)"
              style={{ transition: 'opacity 0.6s ease' }}
            />
            <path
              d={paths.centers[i]}
              fill="none"
              stroke={LANE_COLORS[i]}
              strokeWidth="1"
              opacity={isFocused ? 0.4 : isDimmed ? 0.06 : 0.25}
              style={{ transition: 'opacity 0.6s ease' }}
            />
          </g>
        )
      })}
    </svg>
  )
}
