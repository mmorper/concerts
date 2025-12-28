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

export function Scene4Bands({ concerts }: Scene4BandsProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)

  // Build venue → band hierarchy network
  const { nodes, links } = useMemo(() => {
    // Track venue counts and band appearances per venue
    const venueCounts = new Map<string, number>()
    const venueHeadliners = new Map<string, Map<string, number>>()
    const venueOpeners = new Map<string, Map<string, Map<string, number>>>()
    const bandVenues = new Map<string, Set<string>>() // Track which venues each band has played

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

      // Track which venues this headliner has played
      if (!bandVenues.has(headliner)) {
        bandVenues.set(headliner, new Set())
      }
      bandVenues.get(headliner)!.add(venue)

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

        // Track which venues this opener has played
        if (!bandVenues.has(opener)) {
          bandVenues.set(opener, new Set())
        }
        bandVenues.get(opener)!.add(venue)
      })
    })

    // Get top 10 venues for clarity
    const topVenues = Array.from(venueCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([venue]) => venue)

    const nodes: Node[] = []
    const links: Link[] = []
    const nodeIds = new Set<string>()

    // Create venue nodes (root)
    topVenues.forEach(venue => {
      const nodeId = `venue:${venue}`
      nodes.push({
        id: nodeId,
        count: venueCounts.get(venue) || 0,
        type: 'venue',
      })
      nodeIds.add(nodeId)
    })

    // Create headliner and opener nodes for each venue
    topVenues.forEach(venue => {
      const headliners = venueHeadliners.get(venue)
      if (!headliners) return

      headliners.forEach((count, headliner) => {
        const headlinerId = `headliner:${venue}:${headliner}`

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
          source: `venue:${venue}`,
          target: headlinerId,
          value: count,
          type: 'hierarchy',
        })

        // Add openers for this headliner
        const openers = venueOpeners.get(venue)?.get(headliner)
        if (openers) {
          openers.forEach((openerCount, opener) => {
            const openerId = `opener:${venue}:${headliner}:${opener}`

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
      const venueList = Array.from(venues).filter(v => topVenues.includes(v))
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
  }, [concerts])

  // Helper to get related nodes for a clicked node
  const getRelatedNodes = useCallback((nodeId: string): Set<string> => {
    const related = new Set<string>([nodeId])
    const node = nodes.find(n => n.id === nodeId)

    if (!node) return related

    if (node.type === 'venue') {
      // Get all children (headliners and openers)
      nodes.forEach(n => {
        if (n.parentVenue === node.id.replace('venue:', '')) {
          related.add(n.id)
        }
      })
    } else if (node.type === 'headliner') {
      // Get parent venue and sibling/child openers
      const venue = `venue:${node.parentVenue}`
      related.add(venue)

      // Get openers for this headliner
      nodes.forEach(n => {
        if (n.type === 'opener' && n.id.startsWith(`opener:${node.parentVenue}:${node.id.split(':')[2]}`)) {
          related.add(n.id)
        }
      })
    } else if (node.type === 'opener') {
      // Get parent venue and parent headliner
      const parts = node.id.split(':')
      const venue = `venue:${parts[1]}`
      const headlinerName = parts[2]
      const headliner = `headliner:${parts[1]}:${headlinerName}`
      related.add(venue)
      related.add(headliner)
    }

    return related
  }, [nodes])

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
      .style('cursor', focusedNodeId ? 'pointer' : 'default')
      .on('click', () => {
        if (focusedNodeId) {
          setFocusedNodeId(null)
        }
      })

    const relatedNodes = focusedNodeId ? getRelatedNodes(focusedNodeId) : new Set<string>()

    // Create size scales for different node types
    const venueSizeScale = d3.scaleSqrt()
      .domain([1, Math.max(...nodes.filter(n => n.type === 'venue').map(n => n.count))])
      .range([20, 40])

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
      .force('radial', d3.forceRadial(
        (d: any) => {
          if (d.type === 'venue') return 0 // Venues in center
          if (d.type === 'headliner') return 150 // Headliners mid-radius
          return 250 // Openers outer radius
        },
        width / 2,
        height / 2
      ).strength(0.3))

    // Create container group
    const g = svg.append('g')

    // Draw links with different styles for hierarchy vs cross-venue
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', (d: any) => d.type === 'hierarchy' ? '#818cf8' : '#f472b6')
      .attr('stroke-opacity', (d: any) => {
        if (!focusedNodeId) return d.type === 'hierarchy' ? 0.5 : 0.3

        // Show links connected to related nodes
        const sourceId = typeof d.source === 'string' ? d.source : d.source.id
        const targetId = typeof d.target === 'string' ? d.target : d.target.id
        const isRelated = relatedNodes.has(sourceId) && relatedNodes.has(targetId)

        if (isRelated) return d.type === 'hierarchy' ? 0.7 : 0.5
        return 0.05 // Ghost back
      })
      .attr('stroke-width', (d: any) => d.type === 'hierarchy' ? 2 : 1)
      .attr('stroke-dasharray', (d: any) => d.type === 'cross-venue' ? '5,5' : 'none')

    // Draw nodes
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag<any, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any)

    // Add circles with different colors per type
    node.append('circle')
      .attr('r', d => {
        const baseSize = getNodeSize(d)
        // Increase size by 50% when focused or related
        if (focusedNodeId && relatedNodes.has(d.id)) {
          return baseSize * 1.5
        }
        return baseSize
      })
      .attr('fill', d => {
        if (d.type === 'venue') return '#6366f1' // Indigo for venues
        if (d.type === 'headliner') return '#8b5cf6' // Purple for headliners
        return '#ec4899' // Pink for openers
      })
      .attr('fill-opacity', d => {
        if (!focusedNodeId) return 0.85
        return relatedNodes.has(d.id) ? 1 : 0.15 // Ghost back unrelated nodes
      })
      .attr('stroke', d => {
        if (d.type === 'venue') return '#4f46e5'
        if (d.type === 'headliner') return '#7c3aed'
        return '#db2777'
      })
      .attr('stroke-width', d => {
        const baseWidth = d.type === 'venue' ? 3 : 2
        // Increase stroke width when focused
        if (focusedNodeId && relatedNodes.has(d.id)) {
          return baseWidth * 1.5
        }
        return baseWidth
      })
      .attr('stroke-opacity', d => {
        if (!focusedNodeId) return 1
        return relatedNodes.has(d.id) ? 1 : 0.15
      })
      .style('cursor', 'pointer')
      .on('click', function(_event, d) {
        // Toggle focus: if already focused, unfocus
        if (focusedNodeId === d.id) {
          setFocusedNodeId(null)
        } else {
          setFocusedNodeId(d.id)
        }
      })
      .on('mouseenter', function(_event, d) {
        if (!focusedNodeId || relatedNodes.has(d.id)) {
          d3.select(this)
            .transition()
            .duration(200)
            .attr('fill-opacity', 1)
        }
      })
      .on('mouseleave', function(_event, d) {
        const baseOpacity = (!focusedNodeId || relatedNodes.has(d.id)) ? 0.85 : 0.15
        d3.select(this)
          .transition()
          .duration(200)
          .attr('fill-opacity', baseOpacity)
      })

    // Add labels for venue nodes (always visible)
    node.filter(d => d.type === 'venue')
      .append('text')
      .text(d => {
        // Extract venue name from the id
        const venueName = d.id.replace('venue:', '')
        // Truncate long names
        return venueName.length > 20 ? venueName.substring(0, 17) + '...' : venueName
      })
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '11px')
      .attr('fill', 'white')
      .attr('fill-opacity', d => {
        if (!focusedNodeId) return 1
        return relatedNodes.has(d.id) ? 1 : 0.15
      })
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('font-weight', '600')
      .attr('pointer-events', 'none')
      .style('text-shadow', '0 1px 3px rgba(0,0,0,0.8)')

    // Add labels for focused band nodes (headliners and openers)
    node.filter(d => {
        // Show label if this node is part of focused hierarchy
        if (!focusedNodeId) return false
        if (d.type === 'venue') return false
        return relatedNodes.has(d.id) // Show all related band labels
      })
      .append('text')
      .text(d => {
        // Extract band name from the id
        let bandName = ''
        if (d.type === 'headliner') {
          bandName = d.id.split(':')[2]
        } else if (d.type === 'opener') {
          bandName = d.id.split(':')[3]
        }
        // Truncate long names - be more generous with focused nodes
        return bandName.length > 18 ? bandName.substring(0, 15) + '...' : bandName
      })
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', d => {
        // Larger font for focused nodes
        return focusedNodeId && relatedNodes.has(d.id) ? '10px' : '9px'
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
          label = d.id.replace('venue:', '')
        } else if (d.type === 'headliner') {
          label = d.id.split(':')[2] // Extract band name
        } else {
          label = d.id.split(':')[3] // Extract opener name
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
  }, [nodes, links, focusedNodeId, getRelatedNodes])

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
        transition={{ duration: 0.8, delay: 0.2 }}
        className="absolute top-20 left-0 right-0 z-10 text-center px-8"
      >
        <h2 className="text-5xl md:text-6xl font-light text-white mb-3 tracking-tight">
          The Venues
        </h2>
        <p className="text-lg text-indigo-300">
          {totalVenues} concert halls and amphitheaters
        </p>
      </motion.div>

      {/* Network Visualization */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 1, delay: 0.4 }}
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
        transition={{ duration: 0.8, delay: 0.6 }}
        className="absolute bottom-20 left-0 right-0 z-10 text-center"
      >
        <p className="text-sm text-indigo-400 uppercase tracking-wide">
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
          className="absolute top-32 right-8 z-20 px-4 py-2 bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-lg text-sm font-medium hover:bg-white/20 transition-all"
        >
          Reset View
        </motion.button>
      )}
    </motion.section>
  )
}
