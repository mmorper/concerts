import { useEffect, useRef, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import * as d3 from 'd3'
import type { Concert } from '../../types/concert'
import { getGenreColor } from '../../constants/colors'

interface Scene5GenresProps {
  concerts: Concert[]
}

interface GenreNode {
  name: string
  value?: number
  children?: GenreNode[]
  isOther?: boolean
  isArtist?: boolean
}

interface PartitionNode extends d3.HierarchyRectangularNode<GenreNode> {
  x0: number
  x1: number
  y0: number
  y1: number
}

export function Scene5Genres({ concerts }: Scene5GenresProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [focusedNode, setFocusedNode] = useState<string>('All Genres')
  const [expandedGenre, setExpandedGenre] = useState<string | null>(null)

  // Build hierarchical genre data with zoom-in effect
  const genreHierarchy = useMemo((): GenreNode => {
    // Count concerts per genre
    const genreCounts = new Map<string, number>()
    const genreArtists = new Map<string, Map<string, number>>()

    concerts.forEach(concert => {
      const genre = concert.genre || 'Unknown'
      genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1)

      // Track artists within each genre
      if (!genreArtists.has(genre)) {
        genreArtists.set(genre, new Map())
      }
      const artists = genreArtists.get(genre)!
      artists.set(concert.headliner, (artists.get(concert.headliner) || 0) + 1)
    })

    const totalConcerts = concerts.length
    const threshold = totalConcerts * 0.03 // 3% threshold

    // Separate major genres (>=3%) and small genres (<3%)
    const majorGenres: { name: string; count: number; artists: Map<string, number> }[] = []
    const smallGenres: { name: string; count: number; artists: Map<string, number> }[] = []

    Array.from(genreCounts.entries()).forEach(([genre, count]) => {
      const artists = genreArtists.get(genre)!
      if (count >= threshold) {
        majorGenres.push({ name: genre, count, artists })
      } else {
        smallGenres.push({ name: genre, count, artists })
      }
    })

    majorGenres.sort((a, b) => b.count - a.count)
    smallGenres.sort((a, b) => b.count - a.count)

    // ZOOM-IN LOGIC: If a genre is expanded, it becomes the inner ring
    if (expandedGenre && expandedGenre !== 'All Genres') {
      // Check if it's a major genre
      const majorGenre = majorGenres.find(g => g.name === expandedGenre)
      if (majorGenre) {
        // Zoomed into a major genre: show as single inner ring, artists in middle ring
        const artistChildren: GenreNode[] = Array.from(majorGenre.artists.entries())
          .map(([artist, count]) => ({
            name: artist,
            value: count,
            isArtist: true,
          }))
          .sort((a, b) => (b.value || 0) - (a.value || 0))

        return {
          name: 'All Genres',
          children: [
            {
              name: expandedGenre,
              value: majorGenre.count,
              children: artistChildren,
            },
          ],
        }
      }

      // Check if it's "Other"
      if (expandedGenre === 'Other') {
        // Zoomed into "Other": show as single inner ring, small genres in middle ring
        return {
          name: 'All Genres',
          children: [
            {
              name: 'Other',
              value: smallGenres.reduce((sum, g) => sum + g.count, 0),
              isOther: true,
              children: smallGenres.map(g => ({
                name: g.name,
                value: g.count,
              })),
            },
          ],
        }
      }

      // Check if it's a small genre (from within "Other")
      const smallGenre = smallGenres.find(g => g.name === expandedGenre)
      if (smallGenre) {
        // Zoomed into a small genre: show as single inner ring, artists in middle ring
        const artistChildren: GenreNode[] = Array.from(smallGenre.artists.entries())
          .map(([artist, count]) => ({
            name: artist,
            value: count,
            isArtist: true,
          }))
          .sort((a, b) => (b.value || 0) - (a.value || 0))

        return {
          name: 'All Genres',
          children: [
            {
              name: expandedGenre,
              value: smallGenre.count,
              children: artistChildren,
            },
          ],
        }
      }
    }

    // DEFAULT VIEW: Show all major genres + "Other" in inner ring
    const children: GenreNode[] = majorGenres.map(g => ({
      name: g.name,
      value: g.count,
    }))

    if (smallGenres.length > 0) {
      children.push({
        name: 'Other',
        value: smallGenres.reduce((sum, g) => sum + g.count, 0),
        isOther: true,
      })
    }

    return {
      name: 'All Genres',
      children,
    }
  }, [concerts, expandedGenre])


  // Render D3 sunburst - reads actual SVG dimensions from CSS
  useEffect(() => {
    if (!svgRef.current || !genreHierarchy.children || genreHierarchy.children.length === 0) return

    const renderSunburst = () => {
      if (!svgRef.current) return

      const svg = d3.select(svgRef.current)
      svg.selectAll('*').remove()

      // Read the actual computed dimensions from the SVG element
      const rect = svgRef.current.getBoundingClientRect()
      const width = rect.width
      const height = rect.height
      const radius = Math.min(width, height) / 2 - 20

      console.log('🎯 SUNBURST DIMENSIONS:', {
        width,
        height,
        radius,
        source: 'getBoundingClientRect (CSS-computed)'
      })

    // Function to get color for any node using genre color palette
    const getNodeColor = (d: PartitionNode): string => {
      if (d.depth === 1) {
        // Top-level genre - use genre color palette
        return getGenreColor(d.data.name)
      } else if (d.depth >= 2) {
        // Artist or small genre - inherit parent color with brightness variation
        const parent = d.parent
        if (parent && parent.depth >= 1) {
          const parentColor = d.depth === 2 && parent.depth === 1
            ? getGenreColor(parent.data.name)
            : getNodeColor(parent as PartitionNode)

          const color = d3.color(parentColor)
          if (color) {
            // Vary brightness based on index within siblings
            const siblings = parent.children || []
            const siblingIndex = siblings.indexOf(d)
            const brightnessShift = (siblingIndex / Math.max(siblings.length - 1, 1)) * 1.5 - 0.75
            return color.brighter(brightnessShift).toString()
          }
        }
        return getGenreColor(d.data.name)
      }
      return '#999'
    }

    // Create hierarchy
    const root = d3.hierarchy(genreHierarchy)
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0))

    // Create partition layout
    const partition = d3.partition<GenreNode>()
      .size([2 * Math.PI, radius])

    partition(root)

    // Create arc generators with fixed 3-ring layout
    // Ring 1 (inner): 20-50% of radius
    // Ring 2 (middle): 50-80% of radius
    // Ring 3 (outer): 80-98% of radius (reserved for future expansion)
    const arc = d3.arc<PartitionNode>()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius / 2)
      .innerRadius(d => {
        if (d.depth === 1) return radius * 0.20  // Inner ring
        if (d.depth === 2) return radius * 0.50  // Middle ring
        return radius * 0.80  // Outer ring (future)
      })
      .outerRadius(d => {
        if (d.depth === 1) return radius * 0.50  // Inner ring
        if (d.depth === 2) return radius * 0.80  // Middle ring
        return radius * 0.98  // Outer ring (future)
      })

    const arcExpanded = d3.arc<PartitionNode>()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius / 2)
      .innerRadius(d => {
        if (d.depth === 1) return radius * 0.15  // Inner ring (expanded)
        if (d.depth === 2) return radius * 0.45  // Middle ring (expanded)
        return radius * 0.75  // Outer ring (future)
      })
      .outerRadius(d => {
        if (d.depth === 1) return radius * 0.55  // Inner ring (expanded)
        if (d.depth === 2) return radius * 0.85  // Middle ring (expanded)
        return radius * 1.0   // Outer ring (future)
      })

    // Create main group
    const g = svg.append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`)

    // Add transparent background for click-away - must not block path hover events
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent')
      .style('pointer-events', 'none')  // Don't block hover events on paths!
      .on('click', () => {
        setFocusedNode('All Genres')
      })

    // Add radial gradient definitions for all nodes
    const defs = svg.append('defs')
    const allNodes = root.descendants().filter(d => d.depth > 0) as PartitionNode[]
    allNodes.forEach((node, i) => {
      const gradient = defs.append('radialGradient')
        .attr('id', `gradient-${i}`)
        .attr('cx', '50%')
        .attr('cy', '50%')
        .attr('r', '50%')

      const baseColor = getNodeColor(node)
      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', d3.color(baseColor)!.brighter(0.5).toString())

      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', baseColor)
    })

    // Create floating tooltip (before segments so it's above them)
    const tooltip = svg.append('g')
      .attr('class', 'hover-tooltip')
      .style('opacity', 0)
      .style('pointer-events', 'none')

    const tooltipBg = tooltip.append('rect')
      .attr('rx', 6)
      .attr('ry', 6)
      .attr('fill', 'white')
      .attr('stroke', '#d1d5db')
      .attr('stroke-width', 1)
      .style('filter', 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))')

    const tooltipText = tooltip.append('text')
      .attr('font-family', 'Source Sans 3, system-ui, sans-serif')
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .attr('fill', '#1f2937')

    const tooltipSubtext = tooltip.append('text')
      .attr('font-family', 'Source Sans 3, system-ui, sans-serif')
      .attr('font-size', '12px')
      .attr('fill', '#6b7280')

    // Create node groups
    const nodeGroups = g.selectAll('.node-group')
      .data(root.descendants().filter(d => d.depth > 0) as PartitionNode[])
      .join('g')
      .attr('class', 'node-group')

    // Add paths with interactivity
    const paths = nodeGroups.append('path')
      .attr('class', 'segment-path')
      .attr('d', arc)
      .attr('fill', (_d, i) => `url(#gradient-${i})`)
      .attr('fill-opacity', 0.9)
      .attr('stroke', 'white')
      .attr('stroke-width', 3)
      .style('cursor', 'pointer')
      .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))')
      .style('pointer-events', 'all')
      .on('click', function(_event, d) {
        _event.stopPropagation()

        // NEW ZOOM LOGIC:
        // - Depth 1 nodes are either genres (in default view) or a focused genre (in zoomed view)
        // - Depth 2 nodes are either artists (zoomed into genre) or small genres (zoomed into "Other")

        if (d.depth === 1) {
          // Clicking inner ring
          if (expandedGenre === d.data.name) {
            // Already zoomed in - zoom out
            setExpandedGenre(null)
            setFocusedNode('All Genres')
          } else {
            // Zoom into this genre
            setExpandedGenre(d.data.name)
            setFocusedNode(d.data.name)
          }
        } else if (d.depth === 2) {
          // Clicking middle ring
          if (d.parent && d.parent.data.isOther && !d.data.isArtist) {
            // Clicking a small genre within "Other" - zoom into it
            setExpandedGenre(d.data.name)
            setFocusedNode(d.data.name)
          } else if (d.data.isArtist) {
            // Clicking an artist - just focus (no further zoom)
            if (focusedNode === d.data.name) {
              setFocusedNode(d.parent?.data.name || 'All Genres')
            } else {
              setFocusedNode(d.data.name)
            }
          }
        }
      })
      .on('mouseover', function(_event, d) {
        console.log('MOUSEOVER detected on:', d.data.name)
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

        // Show floating tooltip to the right (only in drill-down view with artists)
        if (expandedGenre && d.depth === 2 && d.data.isArtist) {
          const angle = (d.x0 + d.x1) / 2

          // Position at the outer edge of the slice (depth 2 is at 0.50 to 0.80 radius)
          const sliceOuterRadius = radius * 0.80

          // Calculate position at outer edge of slice
          const sliceX = Math.cos(angle - Math.PI / 2) * sliceOuterRadius
          const sliceY = Math.sin(angle - Math.PI / 2) * sliceOuterRadius

          // Add offset to position tooltip to the right of the slice
          const offsetDistance = 20
          const tooltipX = sliceX + Math.cos(angle - Math.PI / 2) * offsetDistance
          const tooltipY = sliceY + Math.sin(angle - Math.PI / 2) * offsetDistance

          const value = d.value || 0
          const percentage = ((value / (root.value || 1)) * 100).toFixed(1)

          tooltipText
            .text(d.data.name)
            .attr('x', tooltipX + 8)
            .attr('y', tooltipY - 2)

          tooltipSubtext
            .text(`${value} show${value !== 1 ? 's' : ''} (${percentage}%)`)
            .attr('x', tooltipX + 8)
            .attr('y', tooltipY + 14)

          // Size background to fit text
          const textBBox = (tooltipText.node() as SVGTextElement).getBBox()
          const subtextBBox = (tooltipSubtext.node() as SVGTextElement).getBBox()
          const maxWidth = Math.max(textBBox.width, subtextBBox.width)
          const totalHeight = textBBox.height + subtextBBox.height + 8

          tooltipBg
            .attr('x', tooltipX + 4)
            .attr('y', tooltipY - textBBox.height - 2)
            .attr('width', maxWidth + 8)
            .attr('height', totalHeight + 4)

          tooltip
            .transition()
            .duration(200)
            .style('opacity', 1)
        }
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

        // Hide floating tooltip
        tooltip
          .transition()
          .duration(200)
          .style('opacity', 0)
      })

    // Add tooltips (browser default)
    nodeGroups.append('title')
      .text(d => {
        const value = d.value || 0
        const total = root.value || 1
        const percentage = ((value / total) * 100).toFixed(1)
        return `${d.data.name}: ${value} shows (${percentage}%)`
      })

    // DEBUG: Log paths created
    console.log('Sunburst paths created:', paths.size(), 'paths with hover handlers')

    // Add labels with fixed ring positioning
    nodeGroups.append('text')
      .attr('class', 'segment-label')
      .attr('transform', function(d) {
        const angle = (d.x0 + d.x1) / 2
        // Fixed radius based on depth (matching arc generators)
        let adjustedRadius
        if (d.depth === 1) {
          adjustedRadius = radius * 0.35   // Middle of inner ring (0.20 to 0.50)
        } else if (d.depth === 2) {
          adjustedRadius = radius * 0.65   // Middle of middle ring (0.50 to 0.80)
        } else {
          adjustedRadius = radius * 0.89   // Middle of outer ring (0.80 to 0.98)
        }
        const x = Math.cos(angle - Math.PI / 2) * adjustedRadius
        const y = Math.sin(angle - Math.PI / 2) * adjustedRadius

        // Keep labels horizontal in bottom half for depth 1 (inner genres)
        const rotation = angle * 180 / Math.PI - 90
        if (d.depth === 1 && angle > Math.PI) {
          // Bottom half - keep horizontal (no rotation)
          return `translate(${x},${y})`
        }

        return `translate(${x},${y}) rotate(${rotation < 180 ? rotation : rotation + 180})`
      })
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', d => {
        const angle = d.x1 - d.x0
        // Depth 2 (artists/small genres) - increased font sizes for better visibility
        if (d.depth === 2) {
          if (angle > 0.4) return '12px'
          if (angle > 0.2) return '11px'
          return '10px'
        }
        // Depth 1 (genres) - larger when zoomed in (single segment)
        if (expandedGenre && d.data.name === expandedGenre) return '18px'
        if (angle > 0.4) return '14px'
        if (angle > 0.2) return '12px'
        return '11px'
      })
      .attr('font-weight', d => {
        if (expandedGenre && d.depth === 1 && d.data.name === expandedGenre) return '700'
        return d.depth === 2 ? '500' : '600'
      })
      .attr('fill', 'white')
      .attr('font-family', 'Source Sans 3, system-ui, sans-serif')
      .style('pointer-events', 'none')
      .style('text-shadow', '0 1px 4px rgba(0,0,0,0.8)')
      .text(d => {
        const name = d.data.name
        const angle = d.x1 - d.x0

        // For zoomed-in single genre, show full name
        if (expandedGenre && d.depth === 1 && d.data.name === expandedGenre) {
          return name
        }

        if (d.depth === 2) {
          // Artists/small genres - show more text, less aggressive truncation
          if (angle > 0.4) return name.length > 18 ? name.substring(0, 16) + '…' : name
          if (angle > 0.2) return name.length > 12 ? name.substring(0, 10) + '…' : name
          return name.length > 8 ? name.substring(0, 6) + '…' : name
        }

        // Genres in default view
        if (angle > 0.4) return name
        if (angle > 0.2) return name.length > 14 ? name.substring(0, 12) + '…' : name
        return name.length > 10 ? name.substring(0, 8) + '…' : name
      })
      .attr('opacity', d => {
        const angle = d.x1 - d.x0
        if (expandedGenre && d.depth === 1) return 1  // Always show zoomed genre
        if (d.depth === 2) return 1  // Always show artist labels at full opacity
        if (angle > 0.2) return 1
        return 0.5  // Increased from 0.3 for better visibility
      })

    // Add center text
    const centerText = g.append('g')
      .attr('class', 'center-text')
      .style('pointer-events', 'none')

    const totalGenres = genreHierarchy.children?.length || 0

    centerText.append('text')
      .attr('class', 'center-count')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.2em')
      .attr('font-size', '56px')
      .attr('font-weight', '400')
      .attr('fill', '#1f2937')
      .attr('font-family', 'Playfair Display, Georgia, serif')
      .text(concerts.length)

    centerText.append('text')
      .attr('class', 'center-label')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.8em')
      .attr('font-size', '13px')
      .attr('font-weight', '500')
      .attr('fill', '#6b7280')
      .attr('font-family', 'Source Sans 3, system-ui, sans-serif')
      .attr('letter-spacing', '0.05em')
      .style('text-transform', 'uppercase')
      .text('total shows')

    centerText.append('text')
      .attr('class', 'center-genre')
      .attr('text-anchor', 'middle')
      .attr('dy', '3.4em')
      .attr('font-size', '11px')
      .attr('font-weight', '400')
      .attr('fill', '#9ca3af')
      .attr('font-family', 'Source Sans 3, system-ui, sans-serif')
      .text(`${totalGenres} genres`)
    }

    // Initial render
    renderSunburst()

    // Re-render on window resize
    window.addEventListener('resize', renderSunburst)

    return () => {
      window.removeEventListener('resize', renderSunburst)
    }
  }, [genreHierarchy, concerts, expandedGenre]) // Rebuild when hierarchy changes

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
        return 0.3  // Keep labels visible at 30% opacity instead of hiding completely
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
      className="h-screen flex flex-col items-center justify-center relative snap-start snap-always"
      style={{ backgroundColor: '#ede9fe' }}
    >
      {/* Title */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="absolute top-20 left-0 right-0 z-20 text-center px-8"
      >
        <h2 className="font-serif text-5xl md:text-7xl text-gray-900 mb-3 tracking-tight">
          The Music
        </h2>
        <p className="font-sans text-lg md:text-xl text-gray-500">
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
          className="absolute top-32 right-8 z-20 px-4 py-2 bg-white/80 backdrop-blur-sm text-gray-900 border border-gray-300 rounded-lg font-sans text-sm font-medium hover:bg-white transition-all duration-200 shadow-sm"
        >
          Reset View
        </motion.button>
      )}

      {/* Chart Container */}
      <motion.div
        ref={containerRef}
        initial={{ scale: 0.9, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 1, delay: 0.4 }}
        className="absolute inset-0 flex justify-center items-center pointer-events-none"
      >
        <svg
          ref={svgRef}
          className="pointer-events-auto"
          style={{
            width: 'min(85vw, 85vh)',
            height: 'min(85vw, 85vh)',
            maxWidth: '800px',
            maxHeight: '800px'
          }}
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
        <p className="font-sans text-xs text-gray-500 font-medium uppercase tracking-widest">
          {expandedGenre
            ? 'Click inner ring to zoom out · Click outer segments to drill deeper'
            : 'Hover to preview · Click to zoom into a genre'
          }
        </p>
      </motion.div>
    </motion.section>
  )
}
