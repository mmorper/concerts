import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import * as d3 from 'd3'
import type { Concert } from '../../types/concert'
import { TimelineHoverPreview, useTimelineHover } from '../TimelineHoverPreview'

interface Scene1HeroProps {
  concerts: Concert[]
}

export function Scene1Hero({ concerts }: Scene1HeroProps) {
  const timelineRef = useRef<SVGSVGElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 200 })
  const {
    hoverState,
    handleMouseEnter,
    handleMouseLeave,
    handlePopupMouseEnter,
    handlePopupMouseLeave,
  } = useTimelineHover()

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

  useEffect(() => {
    if (!timelineRef.current || concerts.length === 0 || dimensions.width === 0) return

    const svg = d3.select(timelineRef.current)
    svg.selectAll('*').remove() // Clear previous render

    const width = dimensions.width
    const height = dimensions.height
    const margin = { top: 40, right: 60, bottom: 40, left: 60 }
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
    const maxConcerts = Math.max(...concertsByYear.values())
    const sizeScale = d3.scaleSqrt()
      .domain([0, maxConcerts])
      .range([4, 16])

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

    yearArray.forEach(year => {
      const count = concertsByYear.get(year) || 0
      const x = xScale(year)
      const radius = sizeScale(count)

      // Calculate touch target radius (minimum 44px diameter = 22px radius)
      const touchRadius = Math.max(radius, minTouchRadius)

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

      // Draw invisible larger touch target
      const touchTarget = g.append('circle')
        .attr('cx', x)
        .attr('cy', innerHeight / 2)
        .attr('r', touchRadius)
        .attr('fill', 'transparent')
        .attr('class', 'cursor-pointer')
        .style('cursor', 'pointer')

      // Draw visible dot (smaller, for aesthetics)
      const dot = g.append('circle')
        .attr('cx', x)
        .attr('cy', innerHeight / 2)
        .attr('r', radius)
        .attr('fill', '#6366f1')
        .attr('opacity', 0.8)
        .style('pointer-events', 'none') // Touch handled by touchTarget

      // Add interactions to touch target
      touchTarget
        .on('mouseenter', function() {
          // Get the most prominent artist for this year
          const yearConcerts = concerts.filter(c => c.year === year)
          const artistCounts = new Map<string, number>()
          yearConcerts.forEach(c => {
            artistCounts.set(c.headliner, (artistCounts.get(c.headliner) || 0) + 1)
          })
          const mostFrequentArtist = Array.from(artistCounts.entries())
            .sort((a, b) => b[1] - a[1])[0]?.[0] || yearConcerts[0]?.headliner || 'Unknown'

          // Get the venue for the first show by the most frequent artist
          const artistConcert = yearConcerts.find(c => c.headliner === mostFrequentArtist)
          const venueName = artistConcert?.venue || 'Unknown Venue'

          // Get screen position of the dot
          const svgRect = timelineRef.current?.getBoundingClientRect()
          if (svgRect) {
            const screenX = svgRect.left + x + margin.left
            const screenY = svgRect.top + innerHeight / 2 + margin.top
            handleMouseEnter(mostFrequentArtist, year, count, venueName, { x: screenX, y: screenY })
          }

          // Animate the visible dot
          dot
            .transition()
            .duration(250)
            .attr('r', radius * 1.5)
            .attr('fill', '#a5b4fc') // Much lighter indigo
            .attr('opacity', 1)

          // Animate glow ring
          glowRing
            .transition()
            .duration(250)
            .attr('r', radius * 1.8)
            .attr('stroke-width', 3)
            .attr('opacity', 0.6)

          // Animate shadow
          shadow
            .transition()
            .duration(250)
            .attr('r', radius * 1.6)
            .attr('opacity', 0.6)
        })
        .on('mouseleave', function() {
          handleMouseLeave()

          // Reset the visible dot
          dot
            .transition()
            .duration(250)
            .attr('r', radius)
            .attr('fill', '#6366f1')
            .attr('opacity', 0.8)

          // Fade glow ring
          glowRing
            .transition()
            .duration(250)
            .attr('r', radius)
            .attr('stroke-width', 0)
            .attr('opacity', 0)

          // Fade shadow
          shadow
            .transition()
            .duration(250)
            .attr('r', radius)
            .attr('opacity', 0)
        })
    })

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
      .attr('fill', '#6b7280')
      .attr('font-family', 'Source Sans 3, system-ui, sans-serif')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .text(d => d)

  }, [concerts, dimensions, handleMouseEnter, handleMouseLeave])

  // Calculate stats from data
  const totalConcerts = concerts.length
  const years = concerts.map(c => c.year)
  const yearSpan = years.length > 0 ? `${Math.min(...years)}–${Math.max(...years)}` : ''

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: false, margin: '-20%' }}
      transition={{ duration: 0.8 }}
      className="h-screen flex flex-col items-center justify-center bg-white snap-start snap-always relative"
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

      {/* Timeline Hover Preview */}
      <TimelineHoverPreview
        hoverState={hoverState}
        onMouseEnter={handlePopupMouseEnter}
        onMouseLeave={handlePopupMouseLeave}
      />
    </motion.section>
  )
}
