import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import * as d3 from 'd3'
import type { Concert } from '../../types/concert'

interface Scene4BandsProps {
  concerts: Concert[]
}

interface Node {
  id: string
  count: number
  type: 'venue' | 'headliner' | 'opener'
  parentVenue?: string
}

interface Link {
  source: string
  target: string
  value: number
  type: 'hierarchy' | 'cross-venue'
}

type ViewMode = 'top10' | 'all'

export function Scene4Bands({ concerts }: Scene4BandsProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('top10')
  const [expandedVenues, setExpandedVenues] = useState<Set<string>>(new Set())
  const [centeredVenue, setCenteredVenue] = useState<string | null>(null)

  // Compute venue stats
  const venueStats = useMemo(() => {
    const venueCounts = new Map<string, number>()
    const venueHeadliners = new Map<string, Map<string, number>>()
    const venueOpeners = new Map<string, Map<string, Map<string, number>>>()

    concerts.forEach(concert => {
      const venue = concert.venue
      const headliner = concert.headliner

      // Count venue appearances
      venueCounts.set(venue, (venueCounts.get(venue) || 0) + 1)

      // Track headliners per venue
      if (!venueHeadliners.has(venue)) {
        venueHeadliners.set(venue, new Map())
      }
      const headlinerMap = venueHeadliners.get(venue)!
      headlinerMap.set(headliner, (headlinerMap.get(headliner) || 0) + 1)

      // Track openers per headliner per venue
      if (!venueOpeners.has(venue)) {
        venueOpeners.set(venue, new Map())
      }
      if (!venueOpeners.get(venue)!.has(headliner)) {
        venueOpeners.get(venue)!.set(headliner, new Map())
      }
      const openerMap = venueOpeners.get(venue)!.get(headliner)!

      concert.openers.forEach(opener => {
        openerMap.set(opener, (openerMap.get(opener) || 0) + 1)
      })
    })

    return { venueCounts, venueHeadliners, venueOpeners }
  }, [concerts])

  // Get sorted venues by show count
  const sortedVenues = useMemo(() => {
    return Array.from(venueStats.venueCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([venue]) => venue)
  }, [venueStats])

  // Determine which venues to show based on viewMode
  const displayedVenues = useMemo(() => {
    return viewMode === 'top10' ? sortedVenues.slice(0, 10) : sortedVenues
  }, [viewMode, sortedVenues])

  // In "all" mode, no venues are expanded by default (all collapsed to dots)
  const defaultExpandedVenues = useMemo<Set<string>>(() => {
    return new Set() // Start with all collapsed
  }, [])

  // Build venue → band hierarchy network
  const { nodes, links } = useMemo(() => {
    const { venueCounts, venueHeadliners, venueOpeners } = venueStats
    const bandVenues = new Map<string, Set<string>>() // Track which venues each band has played

    // Track band venues for cross-venue links
    concerts.forEach(concert => {
      const venue = concert.venue
      const headliner = concert.headliner

      if (!bandVenues.has(headliner)) {
        bandVenues.set(headliner, new Set())
      }
      bandVenues.get(headliner)!.add(venue)

      concert.openers.forEach(opener => {
        if (!bandVenues.has(opener)) {
          bandVenues.set(opener, new Set())
        }
        bandVenues.get(opener)!.add(venue)
      })
    })

    // Determine which venues should show their artists
    const venuesToExpand: Set<string> = viewMode === 'top10'
      ? new Set(displayedVenues) // Top 10 mode: all venues expanded
      : new Set([...defaultExpandedVenues, ...expandedVenues]) // All mode: default + user-expanded

    const nodes: Node[] = []
    const links: Link[] = []
    const nodeIds = new Set<string>()

    // Create venue nodes (root) - all displayed venues
    displayedVenues.forEach(venue => {
      const nodeId = `venue|${venue}`
      nodes.push({
        id: nodeId,
        count: venueCounts.get(venue) || 0,
        type: 'venue',
      })
      nodeIds.add(nodeId)
    })

    // Create headliner and opener nodes only for expanded venues
    venuesToExpand.forEach(venue => {
      const headliners = venueHeadliners.get(venue)
      if (!headliners) return

      headliners.forEach((count, headliner) => {
        const headlinerId = `headliner|${venue}|${headliner}`

        // Add headliner node
        nodes.push({
          id: headlinerId,
          count,
          type: 'headliner',
          parentVenue: venue,
        })
        nodeIds.add(headlinerId)

        // Link venue → headliner
        links.push({
          source: `venue|${venue}`,
          target: headlinerId,
          value: count,
          type: 'hierarchy',
        })

        // Add openers for this headliner
        const openers = venueOpeners.get(venue)?.get(headliner)
        if (openers) {
          openers.forEach((openerCount, opener) => {
            const openerId = `opener|${venue}|${headliner}|${opener}`

            // Add opener node
            nodes.push({
              id: openerId,
              count: openerCount,
              type: 'opener',
              parentVenue: venue,
            })
            nodeIds.add(openerId)

            // Link headliner → opener
            links.push({
              source: headlinerId,
              target: openerId,
              value: openerCount,
              type: 'hierarchy',
            })
          })
        }
      })
    })

    // Create cross-venue links for bands that played multiple venues
    bandVenues.forEach((venues, band) => {
      const venueList = Array.from(venues).filter(v => displayedVenues.includes(v))
      if (venueList.length > 1) {
        // Find all nodes for this band across venues
        const bandNodes = nodes.filter(n =>
          n.id.includes(band) && (n.type === 'headliner' || n.type === 'opener')
        )

        // Create links between instances of the same band at different venues
        for (let i = 0; i < bandNodes.length; i++) {
          for (let j = i + 1; j < bandNodes.length; j++) {
            links.push({
              source: bandNodes[i].id,
              target: bandNodes[j].id,
              value: 1,
              type: 'cross-venue',
            })
          }
        }
      }
    })

    return { nodes, links }
  }, [concerts, venueStats, displayedVenues, viewMode, defaultExpandedVenues, expandedVenues])

  // Helper to get related nodes for a clicked node
  const getRelatedNodes = useCallback((nodeId: string): Set<string> => {
    const related = new Set<string>([nodeId])
    const node = nodes.find(n => n.id === nodeId)

    if (!node) return related

    if (node.type === 'venue') {
      // Get all children (headliners and openers)
      nodes.forEach(n => {
        if (n.parentVenue === node.id.replace('venue|', '')) {
          related.add(n.id)
        }
      })
    } else if (node.type === 'headliner') {
      // Get parent venue and sibling/child openers
      const venue = `venue|${node.parentVenue}`
      related.add(venue)

      // Get openers for this headliner
      nodes.forEach(n => {
        if (n.type === 'opener' && n.id.startsWith(`opener|${node.parentVenue}|${node.id.split('|')[2]}`)) {
          related.add(n.id)
        }
      })
    } else if (node.type === 'opener') {
      // Get parent venue and parent headliner
      const parts = node.id.split('|')
      const venue = `venue|${parts[1]}`
      const headlinerName = parts[2]
      const headliner = `headliner|${parts[1]}|${headlinerName}`
      related.add(venue)
      related.add(headliner)
    }

    return related
  }, [nodes])

  // Custom force to create elliptical exclusion zone around header
  const createExclusionZone = (
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number
  ) => {
    function force(alpha: number) {
      // This will be called by the simulation on each tick
      nodes.forEach((d: any) => {
        if (d.x == null || d.y == null) return // Skip nodes without positions

        // Calculate normalized distance from center using ellipse equation
        const dx = (d.x - centerX) / radiusX
        const dy = (d.y - centerY) / radiusY
        const distanceFromCenter = Math.sqrt(dx * dx + dy * dy)

        // If node is inside the ellipse (distance < 1), push it out
        if (distanceFromCenter < 1) {
          // Calculate push direction (radial from center)
          const angle = Math.atan2(d.y - centerY, d.x - centerX)

          // Strength increases as node gets closer to center
          const strength = alpha * (1 - distanceFromCenter) * 3.0

          // Apply radial force pushing outward
          d.vx = (d.vx || 0) + Math.cos(angle) * strength * 100
          d.vy = (d.vy || 0) + Math.sin(angle) * strength * 100
        }
      })
    }

    return force
  }

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    // Add background rect for click-away
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent')
      .style('cursor', focusedNodeId || expandedVenues.size > 0 ? 'pointer' : 'default')
      .on('click', () => {
        if (focusedNodeId) {
          setFocusedNodeId(null)
        }
        // In "all" mode, clear user-expanded venues and centered venue
        if (viewMode === 'all' && expandedVenues.size > 0) {
          setExpandedVenues(new Set())
          setCenteredVenue(null)
        }
      })

    const relatedNodes = focusedNodeId ? getRelatedNodes(focusedNodeId) : new Set<string>()

    // Create size scales for different node types
    // In "all" mode, use wider range to show hierarchy clearly
    const venueSizeScale = d3.scaleSqrt()
      .domain([1, Math.max(...nodes.filter(n => n.type === 'venue').map(n => n.count))])
      .range(viewMode === 'all' ? [8, 45] : [20, 40])

    const bandSizeScale = d3.scaleSqrt()
      .domain([1, Math.max(...nodes.filter(n => n.type !== 'venue').map(n => n.count))])
      .range([6, 16])

    const getNodeSize = (d: Node) => {
      if (d.type === 'venue') return venueSizeScale(d.count)
      return bandSizeScale(d.count)
    }

    // Create force simulation with radial layout
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links)
        .id((d: any) => d.id)
        .distance((d: any) => {
          // Hierarchy links are shorter, cross-venue links are longer
          if (d.type === 'hierarchy') {
            return 80 // Fixed distance for hierarchy
          }
          return 200 // Longer for cross-venue connections
        })
        .strength((d: any) => {
          return d.type === 'hierarchy' ? 0.8 : 0.2
        }))
      .force('charge', d3.forceManyBody().strength((d: any) => {
        // Venues repel more strongly
        if (d.type === 'venue') return -1000
        if (d.type === 'headliner') return -200
        return -100
      }))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => getNodeSize(d) + 15))
      // Radial force to push venues toward center
      // When a venue is centered, position children around it
      .force('radial', d3.forceRadial(
        (d: any) => {
          if (d.type === 'venue') return 0 // Venues in center

          // If this node belongs to the centered venue, position children around it
          if (centeredVenue && d.parentVenue === centeredVenue) {
            if (d.type === 'headliner') return 120 // Headliners closer
            return 180 // Openers further out
          }

          // Otherwise use default radial positions
          if (d.type === 'headliner') return 150 // Headliners mid-radius
          return 250 // Openers outer radius
        },
        width / 2,
        centeredVenue ? 380 : height / 2 // Center around the positioned venue
      ).strength((d: any) => {
        // Stronger radial force for centered venue's children
        if (centeredVenue && d.parentVenue === centeredVenue) return 0.5
        return 0.3
      }))
      // In "all" mode with centered venue, add strong positioning force
      // Position the centered venue below the exclusion zone (y = 380)
      .force('centerVenue', viewMode === 'all' && centeredVenue ?
        d3.forceX((d: any) => {
          const venueName = d.id.replace('venue|', '')
          if (venueName === centeredVenue) return width / 2
          return d.x
        }).strength((d: any) => {
          const venueName = d.id.replace('venue|', '')
          return venueName === centeredVenue ? 1.0 : 0
        }) : null
      )
      .force('centerVenueY', viewMode === 'all' && centeredVenue ?
        d3.forceY((d: any) => {
          const venueName = d.id.replace('venue|', '')
          // Position centered venue at y=380 (below exclusion zone which ends around y=360)
          if (venueName === centeredVenue) return 380
          return d.y
        }).strength((d: any) => {
          const venueName = d.id.replace('venue|', '')
          return venueName === centeredVenue ? 1.0 : 0
        }) : null
      )
      // Add elliptical exclusion zone around header for organic distribution
      .force('exclusion', createExclusionZone(
        width / 2, // centerX (middle of viewport)
        180, // centerY (center of header area)
        280, // radiusX (horizontal radius - narrower for closer sides)
        180 // radiusY (vertical radius from top to below buttons)
      ))

    // Create container group
    const g = svg.append('g')

    // Draw links with different styles for hierarchy vs cross-venue
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join(
        enter => enter.append('line')
          .attr('stroke-opacity', 0) // Start invisible
          .call(enter => enter.transition().duration(800)
            .attr('stroke-opacity', (d: any) => d.type === 'hierarchy' ? 0.5 : 0.3)
          ),
        update => update,
        exit => exit.call(exit => exit.transition().duration(600)
          .attr('stroke-opacity', 0)
          .remove()
        )
      )
      .attr('stroke', (d: any) => d.type === 'hierarchy' ? '#818cf8' : '#f472b6')
      .attr('stroke-width', (d: any) => d.type === 'hierarchy' ? 2 : 1)
      .attr('stroke-dasharray', (d: any) => d.type === 'cross-venue' ? '5,5' : 'none')

    // Draw nodes
    const node = g.append('g')
      .selectAll('g')
      .data(nodes, (d: any) => d.id) // Use key function for proper transitions
      .join(
        enter => enter.append('g')
          .attr('opacity', 0) // Start invisible
          .call(enter => enter.transition().duration(800)
            .attr('opacity', 1)
          ),
        update => update,
        exit => exit.call(exit => exit.transition().duration(600)
          .attr('opacity', 0)
          .remove()
        )
      )
      .call(d3.drag<any, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any)

    // Add circles with different colors per type
    node.append('circle')
      .attr('r', d => getNodeSize(d))
      .attr('fill', d => {
        if (d.type === 'venue') return '#6366f1' // Indigo for venues
        if (d.type === 'headliner') return '#8b5cf6' // Purple for headliners
        return '#ec4899' // Pink for openers
      })
      .attr('fill-opacity', 0.85)
      .attr('stroke', d => {
        if (d.type === 'venue') return '#4f46e5'
        if (d.type === 'headliner') return '#7c3aed'
        return '#db2777'
      })
      .attr('stroke-width', d => d.type === 'venue' ? 3 : 2)
      .attr('stroke-opacity', 1)
      .style('cursor', 'pointer')
      .on('click', function(_event, d) {
        // Add click feedback: brief opacity boost on clicked circle only
        const circle = d3.select(this)
        circle
          .classed('clicking', true)
          .attr('fill-opacity', 1)
          .transition()
          .duration(300)
          .attr('fill-opacity', 0.85)
          .on('end', function() {
            d3.select(this).classed('clicking', false)
          })

        // In "all" mode, clicking a venue expands/collapses it and centers it
        if (viewMode === 'all' && d.type === 'venue') {
          const venueName = d.id.replace('venue|', '')

          if (expandedVenues.has(venueName)) {
            // Collapse: clear expanded and centered
            setExpandedVenues(new Set())
            setCenteredVenue(null)
          } else {
            // Expand: set this venue as the only expanded one and center it
            setExpandedVenues(new Set([venueName]))
            setCenteredVenue(venueName)
          }

          return
        }

        // Original behavior for other modes/nodes: Toggle focus
        if (focusedNodeId === d.id) {
          setFocusedNodeId(null)
        } else {
          setFocusedNodeId(d.id)
        }
      })
      .on('mouseenter', function(_event, d) {
        // Suppress hover effect if circle is being clicked
        const circle = d3.select(this)
        if (!circle.classed('clicking')) {
          circle
            .transition()
            .duration(200)
            .attr('fill-opacity', 1)
        }

        // Show hover label for small venues in "all" mode
        if (viewMode === 'all' && d.type === 'venue' && d.count < 3) {
          const parentNode = this.parentNode as Element
          d3.select(parentNode)
            .select('.hover-label')
            .transition()
            .duration(200)
            .attr('fill-opacity', 1)
        }
      })
      .on('mouseleave', function(_event, d) {
        // Suppress hover effect if circle is being clicked
        const circle = d3.select(this)
        if (!circle.classed('clicking')) {
          circle
            .transition()
            .duration(200)
            .attr('fill-opacity', 0.85)
        }

        // Hide hover label for small venues in "all" mode
        if (viewMode === 'all' && d.type === 'venue' && d.count < 3) {
          const parentNode = this.parentNode as Element
          d3.select(parentNode)
            .select('.hover-label')
            .transition()
            .duration(200)
            .attr('fill-opacity', 0)
        }
      })

    // Add labels for venue nodes
    // In "all" mode: only show labels for venues with 3+ shows (others show on hover)
    // In "top10" mode: always show labels
    node.filter(d => {
      if (d.type !== 'venue') return false
      if (viewMode === 'top10') return true
      // In "all" mode, only show if 3+ shows
      return d.count >= 3
    })
      .append('text')
      .text(d => {
        // Extract venue name from the id
        const venueName = d.id.replace('venue|', '')
        // Truncate long names
        return venueName.length > 20 ? venueName.substring(0, 17) + '...' : venueName
      })
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '11px')
      .attr('fill', 'white')
      .attr('fill-opacity', 1)
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('font-weight', '600')
      .attr('pointer-events', 'none')
      .style('text-shadow', '0 1px 3px rgba(0,0,0,0.8)')

    // Add hover labels for small venues in "all" mode (1-2 shows)
    if (viewMode === 'all') {
      node.filter(d => d.type === 'venue' && d.count < 3)
        .append('text')
        .text(d => {
          const venueName = d.id.replace('venue|', '')
          return venueName.length > 20 ? venueName.substring(0, 17) + '...' : venueName
        })
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('font-size', '10px')
        .attr('fill', 'white')
        .attr('fill-opacity', 0) // Hidden by default
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .attr('font-weight', '600')
        .attr('pointer-events', 'none')
        .attr('class', 'hover-label')
        .style('text-shadow', '0 1px 3px rgba(0,0,0,0.8)')
    }

    // Add labels for band nodes (headliners and openers)
    node.filter(d => {
        if (d.type === 'venue') return false

        // Show labels for focused hierarchy
        if (focusedNodeId && relatedNodes.has(d.id)) return true

        // Show labels for expanded venues in "all" mode
        if (viewMode === 'all' && d.parentVenue && expandedVenues.has(d.parentVenue)) return true

        return false
      })
      .append('text')
      .text(d => {
        // Extract band name from the id
        let bandName = ''
        if (d.type === 'headliner') {
          bandName = d.id.split('|')[2]
        } else if (d.type === 'opener') {
          bandName = d.id.split('|')[3]
        }
        // Truncate long names - be more generous with focused nodes
        return bandName.length > 18 ? bandName.substring(0, 15) + '...' : bandName
      })
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', d => {
        // Larger font for focused/expanded nodes
        const isHighlighted = (focusedNodeId && relatedNodes.has(d.id)) ||
                              (viewMode === 'all' && d.parentVenue && expandedVenues.has(d.parentVenue))
        return isHighlighted ? '10px' : '9px'
      })
      .attr('fill', 'white')
      .attr('fill-opacity', 1)
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('font-weight', '600')
      .attr('pointer-events', 'none')
      .style('text-shadow', '0 1px 4px rgba(0,0,0,0.95)')

    // Add tooltips
    node.append('title')
      .text(d => {
        let label = d.id
        if (d.type === 'venue') {
          label = d.id.replace('venue|', '')
        } else if (d.type === 'headliner') {
          label = d.id.split('|')[2] // Extract band name
        } else {
          label = d.id.split('|')[3] // Extract opener name
        }
        return `${label}: ${d.count} show${d.count !== 1 ? 's' : ''}`
      })

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    // Drag functions
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      event.subject.fx = event.subject.x
      event.subject.fy = event.subject.y
    }

    function dragged(event: any) {
      event.subject.fx = event.x
      event.subject.fy = event.y
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0)
      event.subject.fx = null
      event.subject.fy = null
    }

    return () => {
      simulation.stop()
    }
  }, [nodes, links, focusedNodeId, getRelatedNodes, viewMode, expandedVenues, centeredVenue])

  const totalVenues = useMemo(() => {
    const allVenues = new Set<string>()
    concerts.forEach(c => allVenues.add(c.venue))
    return allVenues.size
  }, [concerts])

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: false, margin: '-20%' }}
      transition={{ duration: 0.8 }}
      className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-950 to-purple-950 relative overflow-hidden snap-start snap-always"
    >
      {/* Title */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 0.8, delay: 0 }}
        className="venue-header absolute top-20 left-0 right-0 z-10 text-center px-8"
      >
        <h2 className="font-serif text-5xl md:text-7xl text-white mb-3 tracking-tight">
          The Venues
        </h2>
        <p className="font-sans text-lg md:text-xl text-gray-400 mb-6">
          {viewMode === 'top10'
            ? '10 most-visited venues'
            : `${totalVenues} concert halls and amphitheaters`}
        </p>

        {/* View Mode Toggle */}
        <div className="flex justify-center gap-2">
          <button
            onClick={() => {
              setViewMode('top10')
              setExpandedVenues(new Set())
              setFocusedNodeId(null)
              setCenteredVenue(null)
            }}
            className={`font-sans px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              viewMode === 'top10'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Top 10
          </button>
          <button
            onClick={() => {
              setViewMode('all')
              setExpandedVenues(new Set())
              setFocusedNodeId(null)
              setCenteredVenue(null)
            }}
            className={`font-sans px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              viewMode === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            All Venues
          </button>
        </div>
      </motion.div>

      {/* Network Visualization */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 1, delay: 0.2 }}
        className="w-full h-full"
      >
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ cursor: 'default' }}
        />
      </motion.div>

      {/* Subtitle */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="absolute bottom-20 left-0 right-0 z-10 text-center"
      >
        <p className="font-sans text-xs text-gray-400 font-medium uppercase tracking-widest">
          {focusedNodeId ? 'Click anywhere to reset · Drag to explore' : 'Click to focus · Drag to explore'}
        </p>
      </motion.div>

      {/* Reset Button */}
      {focusedNodeId && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          onClick={() => setFocusedNodeId(null)}
          className="absolute top-32 right-8 z-20 px-4 py-2 bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-lg font-sans text-sm font-medium hover:bg-white/20 transition-all duration-200"
        >
          Reset View
        </motion.button>
      )}
    </motion.section>
  )
}
