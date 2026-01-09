import { useEffect, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as d3 from 'd3'
import type { Concert } from '../../types/concert'
import { TimelineHoverPreview, useTimelineHover } from '../TimelineHoverPreview'
import { LAYOUT as POPUP_LAYOUT } from '../TimelineHoverPreview/constants'
import { haptics } from '../../utils/haptics'
import { useYearFilter } from '../TimelineYearFilter/useYearFilter'
import { YearCardStack } from '../TimelineYearFilter'
import { normalizeArtistName } from '../../utils/normalize'
import { analytics } from '../../services/analytics'

interface Scene1HeroProps {
  concerts: Concert[]
  onNavigateToArtist?: (artistName: string) => void
}

export function Scene1Hero({ concerts, onNavigateToArtist }: Scene1HeroProps) {
  const timelineRef = useRef<SVGSVGElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 200 })
  const {
    hoverState,
    handleMouseEnter,
    handleMouseLeave,
    handlePopupMouseEnter,
    handlePopupMouseLeave,
  } = useTimelineHover()

  // Year filter state
  const {
    filterState,
    isTabletOrLarger: _isTabletOrLarger, // Used internally by hook
    handleYearClick,
    handleCardHover,
    collapse,
    handleClickOutside: handleClickOutsideBase,
  } = useYearFilter(concerts)

  // Wrap handleClickOutside to also clear hover state
  const handleClickOutside = () => {
    // Add haptic feedback when dismissing via tap outside
    if (filterState.isExpanded) {
      haptics.light()
    }
    handleClickOutsideBase()
    // Delay clearing hover state to allow exit animations to complete
    setTimeout(() => {
      handleMouseLeave()
    }, 400) // Wait for cards (250ms) + popup (250ms + 100ms delay)
  }

  // Track dot positions for card stack positioning
  const [dotPositions, setDotPositions] = useState<Map<number, { x: number; y: number }>>(new Map())

  // Track touch state
  const isTouchingRef = useRef(false)
  const lastTouchTargetRef = useRef<Element | null>(null)
  const touchThrottleRef = useRef<number | null>(null)

  // Handle navigation to artist scene from card click
  const handleNavigateToArtist = (concert: Concert) => {
    const normalizedName = normalizeArtistName(concert.headliner)

    // Track card click
    const year = new Date(concert.date).getFullYear()
    analytics.trackEvent('timeline_card_clicked', {
      year,
      artist_name: concert.headliner,
      concert_date: concert.date,
    })

    onNavigateToArtist?.(normalizedName)
    // Don't collapse - let user explore all cards
  }

  // Handle navigation to artist scene from popup click
  const handlePopupClick = (artistName: string) => {
    const normalizedName = normalizeArtistName(artistName)

    // Track artist navigation from popup
    analytics.trackEvent('timeline_artist_navigate', {
      artist_name: artistName,
    })

    onNavigateToArtist?.(normalizedName)
  }

  // Use ResizeObserver to get accurate dimensions and handle orientation changes
  useEffect(() => {
    if (!timelineRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const { width } = entry.contentRect
        // Only update if width is valid (avoid initial 0 width)
        if (width > 0) {
          setDimensions({ width, height: 200 })
        }
      }
    })

    resizeObserver.observe(timelineRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  // Cleanup touch throttle on unmount
  useEffect(() => {
    return () => {
      if (touchThrottleRef.current) {
        cancelAnimationFrame(touchThrottleRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!timelineRef.current || concerts.length === 0 || dimensions.width === 0) return

    const svg = d3.select(timelineRef.current)
    svg.selectAll('*').remove() // Clear previous render

    const width = dimensions.width
    const height = dimensions.height
    // Responsive margins - smaller on mobile to prevent dot overlap
    const isMobile = width < 768
    const margin = isMobile
      ? { top: 40, right: 20, bottom: 40, left: 20 }
      : { top: 40, right: 60, bottom: 40, left: 60 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    // Get year range from data
    const years = concerts.map(c => c.year)
    const minYear = Math.min(...years)
    const maxYear = Math.max(...years)

    // Create scale
    const xScale = d3.scaleLinear()
      .domain([minYear, maxYear])
      .range([0, innerWidth])

    // Count concerts per year
    const concertsByYear = d3.rollup(
      concerts,
      v => v.length,
      d => d.year
    )

    // Create size scale for dots (based on concert count)
    // Mobile: adaptive sizing - tiny dots (2-4px) for 1-2 concerts, larger (8-20px) for 3+
    // Desktop: standard size (4-16px)
    const maxConcerts = Math.max(...concertsByYear.values())

    // Mobile-only: Custom scale function for visual hierarchy
    const sizeScale = isMobile
      ? ((count: number) => {
          if (count <= 2) return 3 // Tiny dots for sparse years
          // Scale 3+ concerts from 8-20px
          return 8 + Math.sqrt((count - 3) / (maxConcerts - 3)) * 12
        })
      : d3.scaleSqrt().domain([0, maxConcerts]).range([4, 16])

    // Minimum touch target size (44px / 2 = 22px radius)
    const minTouchRadius = 22

    // Create main group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Draw horizontal axis line
    g.append('line')
      .attr('x1', 0)
      .attr('y1', innerHeight / 2)
      .attr('x2', innerWidth)
      .attr('y2', innerHeight / 2)
      .attr('stroke', '#999')
      .attr('stroke-width', 1)

    // Draw year markers and dots
    const yearArray = Array.from(concertsByYear.keys()).sort((a, b) => a - b)

    // Store dot positions for card stack
    const newDotPositions = new Map<number, { x: number; y: number }>()

    yearArray.forEach(year => {
      const count = concertsByYear.get(year) || 0
      const x = xScale(year)
      const radius = sizeScale(count)

      // Store screen position for this year
      if (timelineRef.current) {
        const svgRect = timelineRef.current.getBoundingClientRect()
        newDotPositions.set(year, {
          x: svgRect.left + x + margin.left,
          y: svgRect.top + innerHeight / 2 + margin.top,
        })
      }

      // Mobile-only: Skip touch interactions for tiny dots (1-2 concerts)
      const isSignificant = !isMobile || count >= 3

      // Calculate touch target radius (minimum 44px diameter = 22px radius)
      // Tiny dots on mobile: no touch target (visual only)
      const touchRadius = isSignificant ? Math.max(radius, minTouchRadius) : radius

      // Check if this year is selected
      const isSelected = filterState.selectedYear === year
      const isFaded = filterState.isExpanded && !isSelected

      // Draw outer glow ring (appears on hover)
      const glowRing = g.append('circle')
        .attr('cx', x)
        .attr('cy', innerHeight / 2)
        .attr('r', radius)
        .attr('fill', 'none')
        .attr('stroke', '#818cf8')
        .attr('stroke-width', 0)
        .attr('opacity', 0)
        .style('pointer-events', 'none')

      // Draw shadow (for elevation effect)
      const shadow = g.append('circle')
        .attr('cx', x)
        .attr('cy', innerHeight / 2)
        .attr('r', radius)
        .attr('fill', '#6366f1')
        .attr('opacity', 0)
        .attr('filter', 'blur(12px)')
        .style('pointer-events', 'none')

      // Draw invisible larger touch target (only for significant dots)
      const touchTarget = g.append('circle')
        .attr('cx', x)
        .attr('cy', innerHeight / 2)
        .attr('r', touchRadius)
        .attr('fill', 'transparent')
        .attr('class', isSignificant ? 'timeline-dot' : 'timeline-dot-tiny')
        .attr('data-year', year)
        .attr('data-count', count)
        .style('cursor', isSignificant ? 'pointer' : 'default')
        .style('touch-action', isSignificant ? 'none' : 'auto')
        .style('pointer-events', isSignificant ? 'auto' : 'none')

      // Draw visible dot (smaller, for aesthetics)
      // Mobile: tiny dots are more subtle (lower opacity)
      // Apply selection/fade states
      const dot = g.append('circle')
        .attr('cx', x)
        .attr('cy', innerHeight / 2)
        .attr('r', isSelected ? radius * 1.2 : radius)
        .attr('fill', isSelected ? '#a5b4fc' : '#6366f1')
        .attr('opacity', isFaded ? 0.3 : (isSignificant ? 0.8 : 0.5))
        .style('pointer-events', 'none') // Touch handled by touchTarget
        .style('transition', 'all 200ms ease-out')

      // Helper function to get concert info for a year
      const getConcertInfo = () => {
        const yearConcerts = concerts.filter(c => c.year === year)
        const artistCounts = new Map<string, number>()
        yearConcerts.forEach(c => {
          artistCounts.set(c.headliner, (artistCounts.get(c.headliner) || 0) + 1)
        })
        const mostFrequentArtist = Array.from(artistCounts.entries())
          .sort((a, b) => b[1] - a[1])[0]?.[0] || yearConcerts[0]?.headliner || 'Unknown'
        const artistConcert = yearConcerts.find(c => c.headliner === mostFrequentArtist)
        const venueName = artistConcert?.venue || 'Unknown Venue'
        return { mostFrequentArtist, venueName }
      }

      // Helper function to animate dot on hover/touch
      const animateDotEnter = () => {
        // Much larger scale on mobile (4x) vs desktop (1.5x)
        const scaleMultiplier = isMobile ? 4 : 1.5

        dot
          .transition()
          .duration(250)
          .attr('r', radius * scaleMultiplier)
          .attr('fill', '#a5b4fc')
          .attr('opacity', 1)

        glowRing
          .transition()
          .duration(250)
          .attr('r', radius * (scaleMultiplier + 0.3))
          .attr('stroke-width', isMobile ? 4 : 3)
          .attr('opacity', isMobile ? 0.8 : 0.6)

        shadow
          .transition()
          .duration(250)
          .attr('r', radius * (scaleMultiplier + 0.1))
          .attr('opacity', isMobile ? 0.8 : 0.6)
          .attr('filter', isMobile ? 'blur(16px)' : 'blur(12px)')
      }

      // Helper function to reset dot animation
      const animateDotLeave = () => {
        dot
          .transition()
          .duration(250)
          .attr('r', radius)
          .attr('fill', '#6366f1')
          .attr('opacity', 0.8)

        glowRing
          .transition()
          .duration(250)
          .attr('r', radius)
          .attr('stroke-width', 0)
          .attr('opacity', 0)

        shadow
          .transition()
          .duration(250)
          .attr('r', radius)
          .attr('opacity', 0)
      }

      // Store metadata on the touch target for touch event handling
      touchTarget.datum({ year, count, x, getConcertInfo, animateDotEnter, animateDotLeave, isSignificant })

      // Add mouse interactions only to significant dots
      if (isSignificant) {
        touchTarget
          .on('mouseenter', function() {
            // Don't trigger mouse events during touch or when expanded
            if (isTouchingRef.current || filterState.isExpanded) return

            const { mostFrequentArtist, venueName } = getConcertInfo()
            const svgRect = timelineRef.current?.getBoundingClientRect()
            if (svgRect) {
              const screenX = svgRect.left + x + margin.left
              const screenY = svgRect.top + innerHeight / 2 + margin.top
              handleMouseEnter(mostFrequentArtist, year, count, venueName, { x: screenX, y: screenY })
            }

            animateDotEnter()
          })
          .on('mouseleave', function() {
            // Don't trigger mouse events during touch
            if (isTouchingRef.current) return

            // If expanded (year selected), keep hover state and don't animate leave
            if (filterState.isExpanded) return

            handleMouseLeave()
            animateDotLeave()
          })
          .on('click', function(event: MouseEvent) {
            // Handle year selection on click (tablet+ only)
            event.stopPropagation()

            // If not already showing hover state, trigger it first
            if (!hoverState || hoverState.year !== year) {
              const { mostFrequentArtist, venueName } = getConcertInfo()
              const svgRect = timelineRef.current?.getBoundingClientRect()
              if (svgRect) {
                const screenX = svgRect.left + x + margin.left
                const screenY = svgRect.top + innerHeight / 2 + margin.top
                handleMouseEnter(mostFrequentArtist, year, count, venueName, { x: screenX, y: screenY })
              }
            }

            // Check if we're collapsing (clicking same year) or expanding
            const wasExpanded = filterState.selectedYear === year && filterState.isExpanded
            handleYearClick(year)
            // Different haptics: light for collapse, medium for expand
            haptics[wasExpanded ? 'light' : 'medium']()
          })

        // Add touchend handler for touch devices (iPad/tablets)
        // D3's .on('click') doesn't fire reliably on touch, so we need explicit touch handling
        const isTouchDevice = typeof window !== 'undefined' &&
          ('ontouchstart' in window || navigator.maxTouchPoints > 0)
        const isTabletOrLarger = typeof window !== 'undefined' && window.innerWidth >= 768

        if (isTouchDevice && isTabletOrLarger) {
          touchTarget.on('touchend', function(event: TouchEvent) {
            // Only fire if user hasn't dragged away from dot (still touching this element)
            // This prevents expansion when user is scrubbing across the timeline
            if (!isTouchingRef.current || lastTouchTargetRef.current !== this) {
              return
            }

            // Prevent synthetic click event to avoid double-firing
            event.preventDefault()
            event.stopPropagation()

            // If not already showing hover state, trigger it first
            if (!hoverState || hoverState.year !== year) {
              const { mostFrequentArtist, venueName } = getConcertInfo()
              const svgRect = timelineRef.current?.getBoundingClientRect()
              if (svgRect) {
                const screenX = svgRect.left + x + margin.left
                const screenY = svgRect.top + innerHeight / 2 + margin.top
                handleMouseEnter(mostFrequentArtist, year, count, venueName, { x: screenX, y: screenY })
              }
            }

            // Check if we're collapsing (tapping same year) or expanding
            const wasExpanded = filterState.selectedYear === year && filterState.isExpanded
            handleYearClick(year)
            // Different haptics: light for collapse, medium for expand
            haptics[wasExpanded ? 'light' : 'medium']()
          })
        }
      }
    })

    // Update dot positions state
    setDotPositions(newDotPositions)

    // Draw decade markers
    const decades = []
    for (let year = Math.floor(minYear / 10) * 10; year <= maxYear; year += 10) {
      decades.push(year)
    }

    g.selectAll('.decade-label')
      .data(decades)
      .join('text')
      .attr('class', 'decade-label')
      .attr('x', d => xScale(d))
      .attr('y', innerHeight / 2 + 30)
      .attr('text-anchor', 'middle')
      .attr('fill', (d) => {
        // Highlight selected year's decade
        if (filterState.selectedYear && Math.floor(filterState.selectedYear / 10) * 10 === d) {
          return '#ffffff'
        }
        return '#6b7280'
      })
      .attr('font-family', 'Source Sans 3, system-ui, sans-serif')
      .attr('font-size', '12px')
      .attr('font-weight', (d) => {
        // Bold selected year's decade
        if (filterState.selectedYear && Math.floor(filterState.selectedYear / 10) * 10 === d) {
          return '700'
        }
        return '500'
      })
      .style('transition', 'all 150ms ease-out')
      .text(d => d)

    // Add touch event handlers to SVG
    svg
      .on('touchstart', function(event: TouchEvent) {
        isTouchingRef.current = true
        // Don't prevent default on touchstart - let the browser handle scrolling
        // unless we're touching a dot
        const touch = event.touches[0]
        if (!touch) return

        const element = document.elementFromPoint(touch.clientX, touch.clientY)
        // Only process significant dots (class 'timeline-dot', not 'timeline-dot-tiny')
        if (element && element.classList.contains('timeline-dot')) {
          // Touching a timeline dot - prevent scrolling for this touch
          event.preventDefault()

          // Trigger haptic feedback (only for significant dots)
          haptics.light()

          // Trigger initial touch feedback
          const d3Element = d3.select(element)
          const data = d3Element.datum() as any
          if (data?.animateDotEnter) {
            data.animateDotEnter()
            lastTouchTargetRef.current = element

            // Show preview
            if (data.getConcertInfo) {
              const { mostFrequentArtist, venueName } = data.getConcertInfo()
              handleMouseEnter(
                mostFrequentArtist,
                data.year,
                data.count,
                venueName,
                { x: touch.clientX, y: touch.clientY },
                true // isTouch = true for shorter delay
              )
            }
          }
        }
      })
      .on('touchmove', function(event: TouchEvent) {
        if (!isTouchingRef.current) return

        const touch = event.touches[0]
        if (!touch) return

        // Find element under touch point first to decide about preventDefault
        const element = document.elementFromPoint(touch.clientX, touch.clientY)

        // Only prevent default if we're over a significant timeline dot
        if (element && element.classList.contains('timeline-dot')) {
          event.preventDefault()
        }

        // Throttle using requestAnimationFrame for smooth performance
        if (touchThrottleRef.current === null) {
          touchThrottleRef.current = requestAnimationFrame(() => {
            touchThrottleRef.current = null

            // Check if we've moved to a different dot
            if (element && element !== lastTouchTargetRef.current) {
              // Get the data bound to this element (if it's a timeline dot)
              const d3Element = d3.select(element)
              const data = d3Element.datum() as any

              if (data?.year) {
                // Reset animation on previous dot if any
                if (lastTouchTargetRef.current) {
                  const prevD3Element = d3.select(lastTouchTargetRef.current)
                  const prevData = prevD3Element.datum() as any
                  if (prevData?.animateDotLeave) {
                    prevData.animateDotLeave()
                  }
                }

                // Trigger haptic feedback for new dot
                haptics.light()

                // Animate new dot
                if (data.animateDotEnter) {
                  data.animateDotEnter()
                }

                // Get concert info and show preview
                if (data.getConcertInfo) {
                  const { mostFrequentArtist, venueName } = data.getConcertInfo()
                  handleMouseEnter(
                    mostFrequentArtist,
                    data.year,
                    data.count,
                    venueName,
                    { x: touch.clientX, y: touch.clientY },
                    true // isTouch = true for shorter delay
                  )
                }

                lastTouchTargetRef.current = element
              }
            }
          })
        }
      })
      .on('touchend', function() {
        isTouchingRef.current = false

        // Reset animation on last touched dot
        if (lastTouchTargetRef.current) {
          const d3Element = d3.select(lastTouchTargetRef.current)
          const data = d3Element.datum() as any
          if (data?.animateDotLeave) {
            data.animateDotLeave()
          }
          lastTouchTargetRef.current = null
        }

        // Clear throttle
        if (touchThrottleRef.current !== null) {
          cancelAnimationFrame(touchThrottleRef.current)
          touchThrottleRef.current = null
        }

        // Hide preview
        handleMouseLeave()
      })
      .on('touchcancel', function() {
        // Handle touch cancel same as touch end
        isTouchingRef.current = false

        if (lastTouchTargetRef.current) {
          const d3Element = d3.select(lastTouchTargetRef.current)
          const data = d3Element.datum() as any
          if (data?.animateDotLeave) {
            data.animateDotLeave()
          }
          lastTouchTargetRef.current = null
        }

        if (touchThrottleRef.current !== null) {
          cancelAnimationFrame(touchThrottleRef.current)
          touchThrottleRef.current = null
        }

        handleMouseLeave()
      })

  }, [concerts, dimensions, handleMouseEnter, handleMouseLeave, filterState, handleYearClick])

  // Calculate stats from data
  const totalConcerts = concerts.length
  const years = concerts.map(c => c.year)
  const yearSpan = years.length > 0 ? `${Math.min(...years)}–${Math.max(...years)}` : ''

  // Calculate popup position for card stack positioning
  const popupPosition = useMemo(() => {
    if (!filterState.selectedYear || !dotPositions.has(filterState.selectedYear) || !hoverState) {
      return null
    }

    const dotPos = dotPositions.get(filterState.selectedYear)!
    const popupWidth = POPUP_LAYOUT.WIDTH

    // Calculate popup X position (centered on dot, with edge constraints)
    let popupX = dotPos.x - popupWidth / 2
    const edgeMargin = POPUP_LAYOUT.EDGE_MARGIN
    const maxX = window.innerWidth - popupWidth - edgeMargin
    popupX = Math.max(edgeMargin, Math.min(popupX, maxX))

    // Calculate popup Y position (above or below dot)
    const estimatedHeight = POPUP_LAYOUT.MIN_HEIGHT + 20
    const spaceAbove = dotPos.y - POPUP_LAYOUT.OFFSET_Y - POPUP_LAYOUT.ARROW_SIZE
    const isAbove = spaceAbove >= estimatedHeight
    const popupY = isAbove
      ? dotPos.y - POPUP_LAYOUT.OFFSET_Y - POPUP_LAYOUT.ARROW_SIZE - estimatedHeight
      : dotPos.y + POPUP_LAYOUT.OFFSET_Y + POPUP_LAYOUT.ARROW_SIZE

    return {
      x: popupX,
      y: Math.max(edgeMargin, popupY),
      width: popupWidth,
    }
  }, [filterState.selectedYear, dotPositions, hoverState])

  // Get concerts for selected year, excluding the first one (shown in popup)
  const additionalConcerts = useMemo(() => {
    if (!filterState.selectedYear) return []
    const yearConcerts = concerts.filter(c => c.year === filterState.selectedYear)
    // Skip the first concert (it's shown in the popup)
    return yearConcerts.slice(1)
  }, [filterState.selectedYear, concerts])

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: false, margin: '-20%' }}
      transition={{ duration: 0.8 }}
      className="h-screen flex flex-col items-center justify-center bg-white snap-start snap-always relative"
      onClick={handleClickOutside}
    >
      <div className="max-w-6xl w-full px-8">
        {/* Title */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: false }}
          transition={{ duration: 0.8, delay: 0 }}
          className="text-center mb-12"
        >
          <h1 className="font-serif text-5xl md:text-7xl text-gray-900 mb-4 tracking-tight">
            Concert Archive
          </h1>
          <p className="font-sans text-lg md:text-xl text-gray-500">
            {totalConcerts} shows across {yearSpan}
          </p>
        </motion.div>

        {/* Timeline Visualization */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: false }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-full"
        >
          <svg
            ref={timelineRef}
            className="w-full"
            height="200"
            style={{ overflow: 'visible' }}
          />
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: false }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-center font-sans text-gray-500 mt-8 text-xs font-medium tracking-widest uppercase"
        >
          A Visual Journey Through Live Music
        </motion.p>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.8 }}
        className="absolute bottom-8"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="text-gray-400 text-sm"
        >
          ↓ Scroll to explore
        </motion.div>
      </motion.div>

      {/* Timeline Hover Preview - stays visible when expanded */}
      <TimelineHoverPreview
        hoverState={hoverState}
        onMouseEnter={handlePopupMouseEnter}
        onMouseLeave={handlePopupMouseLeave}
        onClick={handlePopupClick}
      />

      {/* Year Card Stack - fans out beside the popup */}
      <AnimatePresence>
        {filterState.isExpanded && filterState.selectedYear && popupPosition && additionalConcerts.length > 0 && (
          <YearCardStack
            key={`year-stack-${filterState.selectedYear}`}
            year={filterState.selectedYear}
            concerts={additionalConcerts}
            popupPosition={popupPosition}
            hoveredCardIndex={filterState.hoveredCardIndex}
            onCardHover={handleCardHover}
            onCardClick={handleNavigateToArtist}
            onDismiss={collapse}
            onMouseEnter={handlePopupMouseEnter}
            onMouseLeave={handlePopupMouseLeave}
          />
        )}
      </AnimatePresence>
    </motion.section>
  )
}
