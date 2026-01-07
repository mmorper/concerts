import { useRef, useState, useCallback, useEffect } from 'react'
import { haptics } from '../../../utils/haptics'

interface MilestoneYear {
  milestone: number
  year: number
}

interface TimelineSliderProps {
  currentYear: number
  startYear: number
  endYear: number
  dominantColor: string
  milestones: MilestoneYear[]
  hasInteracted: boolean
  onYearChange: (year: number) => void
  onInteractionStart: () => void
}

export function TimelineSlider({
  currentYear,
  startYear,
  endYear,
  dominantColor,
  milestones,
  hasInteracted,
  onYearChange,
  onInteractionStart,
}: TimelineSliderProps) {
  const sliderRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const prevDecade = useRef(Math.floor(currentYear / 10) * 10)

  const getYearFromPosition = useCallback(
    (clientX: number) => {
      if (!sliderRef.current) return currentYear
      const rect = sliderRef.current.getBoundingClientRect()
      const x = clientX - rect.left
      const percent = Math.max(0, Math.min(1, x / rect.width))
      return Math.round(startYear + percent * (endYear - startYear))
    },
    [currentYear, startYear, endYear]
  )

  // Haptic on decade crossing (when user is interacting)
  useEffect(() => {
    const currentDecade = Math.floor(currentYear / 10) * 10
    if (currentDecade !== prevDecade.current && hasInteracted) {
      haptics.decade()
      prevDecade.current = currentDecade
    }
  }, [currentYear, hasInteracted])

  // Haptic when reaching start or end year
  useEffect(() => {
    if (!hasInteracted) return
    if (currentYear === startYear || currentYear === endYear) {
      haptics.medium()
    }
  }, [currentYear, startYear, endYear, hasInteracted])

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true)
    onInteractionStart()
    onYearChange(getYearFromPosition(e.clientX))
    haptics.light()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      onYearChange(getYearFromPosition(e.clientX))
    }
  }

  const handlePointerUp = () => {
    setIsDragging(false)
  }

  const percent = ((currentYear - startYear) / (endYear - startYear)) * 100
  const decades = [1990, 2000, 2010, 2020]

  return (
    <div className="w-full max-w-[600px] px-6">
      {/* Slider container with larger touch target (44px min for iOS) */}
      <div
        ref={sliderRef}
        className="relative h-11 flex items-center cursor-pointer"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: 'none' }}
      >
        {/* Visual track (thin line) */}
        <div className="absolute left-0 right-0 h-1 bg-white/10 rounded-full pointer-events-none">
          {/* Progress line */}
          <div
            className="absolute top-0 left-0 h-full rounded-full"
            style={{
              width: `${percent}%`,
              background: dominantColor,
              opacity: 0.7,
              transition: isDragging ? 'none' : 'width 0.1s ease-out',
            }}
          />
        </div>

        {/* Decade tick marks */}
        {decades.map((decade) => {
          if (decade < startYear || decade > endYear) return null
          const decadePercent =
            ((decade - startYear) / (endYear - startYear)) * 100
          const isPast = currentYear >= decade
          return (
            <div
              key={decade}
              className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `${decadePercent}%` }}
            >
              <div
                className="w-px h-3 -translate-x-1/2"
                style={{
                  background: isPast ? dominantColor : 'rgba(255,255,255,0.2)',
                  opacity: isPast ? 0.8 : 1,
                }}
              />
            </div>
          )
        })}

        {/* Milestone dots (subtle) */}
        {milestones.map(({ milestone, year }) => {
          if (year < startYear || year > endYear) return null
          const milestonePercent =
            ((year - startYear) / (endYear - startYear)) * 100
          const isPast = currentYear >= year
          return (
            <div
              key={milestone}
              className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `${milestonePercent}%` }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2"
                style={{
                  background: isPast ? dominantColor : 'rgba(255,255,255,0.3)',
                }}
                title={`${milestone} shows`}
              />
            </div>
          )
        })}

        {/* Thumb - larger touch target with visual indicator */}
        <div
          className={!hasInteracted ? 'animate-wobble' : ''}
          style={{
            position: 'absolute',
            top: '50%',
            left: `${percent}%`,
            transform: 'translateX(-50%) translateY(-50%)',
            transition: isDragging ? 'none' : 'left 0.1s ease-out',
            zIndex: 10,
            // 44px touch target (invisible)
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Visual thumb (smaller) */}
          <div
            style={{
              width: isDragging ? 20 : 14,
              height: isDragging ? 20 : 14,
              borderRadius: '50%',
              background: dominantColor,
              boxShadow: `0 0 ${isDragging ? 16 : 10}px ${dominantColor}80`,
              border: '2px solid rgba(255,255,255,0.9)',
              transition: 'width 0.15s, height 0.15s, box-shadow 0.15s',
            }}
          />
        </div>
      </div>

      {/* Year labels */}
      <div className="flex justify-between mt-3 px-0">
        <span className="text-[11px] text-slate-400 font-sans tabular-nums">
          {startYear}
        </span>
        <div className="flex-1 flex justify-around">
          {decades.map((decade) => {
            if (decade < startYear || decade > endYear) return null
            const isActive = currentYear >= decade && currentYear < decade + 10
            return (
              <span
                key={decade}
                className="text-[11px] tabular-nums font-sans transition-colors duration-200"
                style={{
                  color: isActive ? dominantColor : '#94a3b8', // slate-400 for better contrast
                }}
              >
                {decade}
              </span>
            )
          })}
        </div>
        <span className="text-[11px] text-slate-400 font-sans tabular-nums">
          {endYear}
        </span>
      </div>
    </div>
  )
}
