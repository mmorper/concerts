import { useEffect, useRef, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import * as d3 from 'd3'
import type { Concert } from '../../types/concert'

interface Scene5GenresProps {
  concerts: Concert[]
}

interface GenreNode {
  name: string
  value?: number
  children?: GenreNode[]
}

interface PartitionNode extends d3.HierarchyRectangularNode<GenreNode> {
  x0: number
  x1: number
  y0: number
  y1: number
}

export function Scene5Genres({ concerts }: Scene5GenresProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [focusedNode, setFocusedNode] = useState<string>('All Genres')

  // Build hierarchical genre data
  const genreHierarchy = useMemo((): GenreNode => {
    const genreCounts = new Map<string, number>()

    concerts.forEach(concert => {
      const genre = concert.genre || 'Unknown'
      genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1)
    })

    const children: GenreNode[] = Array.from(genreCounts.entries())
      .map(([genre, count]) => ({
        name: genre,
        value: count,
      }))
      .sort((a, b) => (b.value || 0) - (a.value || 0))

    return {
      name: 'All Genres',
      children,
    } as GenreNode
  }, [concerts])

  // Separate initialization from state updates
  useEffect(() => {
    if (!svgRef.current || !genreHierarchy.children || genreHierarchy.children.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight
    const radius = Math.min(width, height) / 2 - 60

    // Create color scale
    const colorScale = d3.scaleOrdinal<string>()
      .domain(genreHierarchy.children.map(d => d.name))
      .range([
        '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
        '#eab308', '#84cc16', '#10b981', '#14b8a6', '#06b6d4',
        '#0ea5e9', '#3b82f6', '#a855f7', '#d946ef', '#e11d48',
      ])

    // Create hierarchy
    const root = d3.hierarchy(genreHierarchy)
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0))

    // Create partition layout
    const partition = d3.partition<GenreNode>()
      .size([2 * Math.PI, radius])

    partition(root)

    // Create arc generators
    const arc = d3.arc<PartitionNode>()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.01))
      .padRadius(radius / 2)
      .innerRadius(radius * 0.4)
      .outerRadius(radius * 0.95)

    const arcExpanded = d3.arc<PartitionNode>()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.01))
      .padRadius(radius / 2)
      .innerRadius(radius * 0.35)
      .outerRadius(radius * 1.15)

    // Create main group
    const g = svg.append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`)

    // Add transparent background for click-away
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('click', () => {
        setFocusedNode('All Genres')
      })

    // Add radial gradient definitions
    const defs = svg.append('defs')
    genreHierarchy.children?.forEach((genre, i) => {
      const gradient = defs.append('radialGradient')
        .attr('id', `gradient-${i}`)
        .attr('cx', '50%')
        .attr('cy', '50%')
        .attr('r', '50%')

      const baseColor = colorScale(genre.name)
      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', d3.color(baseColor)!.brighter(0.5).toString())

      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', baseColor)
    })

    // Create node groups
    const nodeGroups = g.selectAll('.node-group')
      .data(root.descendants().filter(d => d.depth > 0) as PartitionNode[])
      .join('g')
      .attr('class', 'node-group')

    // Add paths with interactivity
    nodeGroups.append('path')
      .attr('class', 'segment-path')
      .attr('d', arc)
      .attr('fill', (_d, i) => `url(#gradient-${i})`)
      .attr('fill-opacity', 0.9)
      .attr('stroke', 'white')
      .attr('stroke-width', 3)
      .style('cursor', 'pointer')
      .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))')
      .on('click', function(_event, d) {
        _event.stopPropagation()
        if (focusedNode === d.data.name) {
          setFocusedNode('All Genres')
        } else {
          setFocusedNode(d.data.name)
        }
      })
      .on('mouseenter', function(_event, d) {
        const currentPath = d3.select(this)
        const parentNode = this.parentNode as Element
        const parentSelection = d3.select(parentNode)

        // Dramatic expansion
        currentPath
          .raise()
          .transition()
          .duration(400)
          .ease(d3.easeBackOut.overshoot(2))
          .attr('d', arcExpanded(d))
          .attr('fill-opacity', 1)
          .attr('stroke-width', 4)
          .style('filter', 'drop-shadow(0 6px 20px rgba(0,0,0,0.5))')

        // Enlarge label
        parentSelection
          .raise()
          .select('.segment-label')
          .transition()
          .duration(400)
          .attr('opacity', 1)
          .attr('font-size', '16px')
          .attr('font-weight', '800')
          .style('text-shadow', '0 2px 8px rgba(0,0,0,1)')
      })
      .on('mouseleave', function(_event, d) {
        const currentPath = d3.select(this)
        const parentNode = this.parentNode as Element
        const parentSelection = d3.select(parentNode)

        const angle = d.x1 - d.x0

        // Contract segment
        currentPath
          .transition()
          .duration(400)
          .ease(d3.easeBackIn)
          .attr('d', arc(d))
          .attr('fill-opacity', 0.9)
          .attr('stroke-width', 3)
          .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))')

        // Reset label
        const baseOpacity = angle > 0.3 ? 1 : 0.3
        const baseFontSize = angle > 0.4 ? '12px' : angle > 0.2 ? '11px' : '10px'

        parentSelection
          .select('.segment-label')
          .transition()
          .duration(300)
          .attr('opacity', baseOpacity)
          .attr('font-size', baseFontSize)
          .attr('font-weight', '600')
          .style('text-shadow', '0 1px 4px rgba(0,0,0,0.8)')
      })

    // Add tooltips
    nodeGroups.append('title')
      .text(d => {
        const value = d.value || 0
        const total = root.value || 1
        const percentage = ((value / total) * 100).toFixed(1)
        return `${d.data.name}: ${value} shows (${percentage}%)`
      })

    // Add labels
    nodeGroups.append('text')
      .attr('class', 'segment-label')
      .attr('transform', function(d) {
        const angle = (d.x0 + d.x1) / 2
        const adjustedRadius = (radius * 0.4 + radius * 0.95) / 2
        const x = Math.cos(angle - Math.PI / 2) * adjustedRadius
        const y = Math.sin(angle - Math.PI / 2) * adjustedRadius
        const rotation = angle * 180 / Math.PI - 90
        return `translate(${x},${y}) rotate(${rotation < 180 ? rotation : rotation + 180})`
      })
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', d => {
        const angle = d.x1 - d.x0
        if (angle > 0.4) return '12px'
        if (angle > 0.2) return '11px'
        return '10px'
      })
      .attr('font-weight', '600')
      .attr('fill', 'white')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .style('pointer-events', 'none')
      .style('text-shadow', '0 1px 4px rgba(0,0,0,0.8)')
      .text(d => {
        const name = d.data.name
        const angle = d.x1 - d.x0
        if (angle > 0.4) return name
        if (angle > 0.2) return name.length > 12 ? name.substring(0, 10) + '…' : name
        return name.length > 8 ? name.substring(0, 6) + '…' : name
      })
      .attr('opacity', d => {
        const angle = d.x1 - d.x0
        if (angle > 0.3) return 1
        return 0.3
      })

    // Add center text
    const centerText = g.append('g')
      .attr('class', 'center-text')
      .style('pointer-events', 'none')

    const totalGenres = genreHierarchy.children?.length || 0

    centerText.append('text')
      .attr('class', 'center-count')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.5em')
      .attr('font-size', '48px')
      .attr('font-weight', '300')
      .attr('fill', '#1f2937')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text(concerts.length)

    centerText.append('text')
      .attr('class', 'center-label')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.5em')
      .attr('font-size', '14px')
      .attr('fill', '#6b7280')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text('total shows')

    centerText.append('text')
      .attr('class', 'center-genre')
      .attr('text-anchor', 'middle')
      .attr('dy', '3em')
      .attr('font-size', '12px')
      .attr('fill', '#9ca3af')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text(`${totalGenres} genres`)

  }, [genreHierarchy, concerts]) // Removed focusedNode from dependencies

  // Separate effect to update visuals when focus changes
  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    const focusedGenre = genreHierarchy.children?.find(c => c.name === focusedNode)
    const displayCount = focusedGenre ? focusedGenre.value : concerts.length
    const displayLabel = focusedGenre ? 'shows' : 'total shows'

    // Update segment opacities
    svg.selectAll<SVGPathElement, PartitionNode>('.segment-path')
      .transition()
      .duration(300)
      .attr('fill-opacity', d => {
        if (focusedNode === 'All Genres') return 0.9
        if (d.data.name === focusedNode) return 1
        return 0.2
      })

    // Update label opacities
    svg.selectAll<SVGTextElement, PartitionNode>('.segment-label')
      .transition()
      .duration(300)
      .attr('opacity', d => {
        const angle = d.x1 - d.x0
        if (focusedNode === 'All Genres') {
          if (angle > 0.3) return 1
          return 0.3
        }
        if (d.data.name === focusedNode) return 1
        return 0
      })

    // Update center text
    svg.select('.center-count')
      .transition()
      .duration(300)
      .tween('text', function() {
        const currentValue = parseInt(d3.select(this).text()) || 0
        const interpolator = d3.interpolateNumber(currentValue, displayCount || 0)
        return function(t) {
          d3.select(this).text(Math.round(interpolator(t)))
        }
      })

    svg.select('.center-label')
      .transition()
      .duration(300)
      .text(displayLabel)

    svg.select('.center-genre')
      .transition()
      .duration(300)
      .text(focusedGenre ? focusedNode : `${genreHierarchy.children?.length || 0} genres`)
      .attr('fill', focusedGenre ? '#4b5563' : '#9ca3af')
      .attr('font-weight', focusedGenre ? '600' : '400')

  }, [focusedNode, genreHierarchy, concerts])

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: false, margin: '-20%' }}
      transition={{ duration: 0.8 }}
      className="h-screen flex flex-col items-center justify-center bg-gray-100 relative snap-start snap-always"
    >
      {/* Title */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="absolute top-20 left-0 right-0 z-20 text-center px-8"
      >
        <h2 className="text-5xl md:text-6xl font-light text-gray-900 mb-3 tracking-tight">
          The Music
        </h2>
        <p className="text-lg text-gray-600">
          {focusedNode === 'All Genres'
            ? 'A diverse sonic journey'
            : `Exploring ${focusedNode}`
          }
        </p>
      </motion.div>

      {/* Reset Button */}
      {focusedNode !== 'All Genres' && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          onClick={() => setFocusedNode('All Genres')}
          className="absolute top-32 right-8 z-20 px-4 py-2 bg-white/80 backdrop-blur-sm text-gray-900 border border-gray-300 rounded-lg text-sm font-medium hover:bg-white transition-all shadow-sm"
        >
          Reset View
        </motion.button>
      )}

      {/* Chart Container */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 1, delay: 0.4 }}
        className="flex justify-center items-center"
      >
        <svg
          ref={svgRef}
          width="600"
          height="600"
          className="max-w-full h-auto"
        />
      </motion.div>

      {/* Instruction Text */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="absolute bottom-20 left-0 right-0 z-20 text-center"
      >
        <p className="text-sm text-gray-500">
          {focusedNode === 'All Genres'
            ? 'Hover to expand · Click to focus on a genre'
            : 'Click anywhere to reset view'
          }
        </p>
      </motion.div>
    </motion.section>
  )
}
