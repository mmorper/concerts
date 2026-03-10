import { useEffect, useCallback, useState, type RefObject } from 'react'

export const LANE_COLORS = ['#8b5cf6', '#6366f1', '#64748b'] // artist, venue, date

// Width ratios [artist, venue, date] per tier row ID
export const TIER_WIDTHS: Record<string, [number, number, number]> = {}

const TIER_IDS = Object.keys(TIER_WIDTHS)

interface SvgPaths {
  fills: string[]
  centers: string[]
}

function smoothPath(pts: Array<{ x: number; y: number }>): string {
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const curr = pts[i]
    const next = pts[i + 1]
    const midY = curr.y + (next.y - curr.y) * 0.5
    d += ` C ${curr.x} ${midY}, ${next.x} ${midY}, ${next.x} ${next.y}`
  }
  return d
}

function computePaths(containerEl: HTMLElement): SvgPaths {
  const fills: string[] = []
  const centers: string[] = []
  const containerRect = containerEl.getBoundingClientRect()

  for (let lane = 0; lane < 3; lane++) {
    const points: Array<{ y: number; cx: number; hw: number }> = []

    for (const rowId of TIER_IDS) {
      const rowEl = document.getElementById(rowId)
      if (!rowEl) continue

      const widths = TIER_WIDTHS[rowId]
      const r = rowEl.getBoundingClientRect()
      const y = r.top - containerRect.top
      const h = r.height
      const totalW = r.width
      const padX = 16
      const usableW = totalW - padX * 2
      const sum = widths.reduce((a, b) => a + b, 0)
      const gap = 8
      const contentW = usableW - gap * (widths.length - 1)

      let x = padX
      const regions = widths.map(w => {
        const laneW = (w / sum) * contentW
        const cx = x + laneW / 2
        x += laneW + gap
        return { cx, hw: laneW / 2 }
      })

      const reg = regions[lane]
      points.push({ y, cx: reg.cx, hw: reg.hw })
      points.push({ y: y + h, cx: reg.cx, hw: reg.hw })
    }

    if (points.length < 2) {
      fills.push('')
      centers.push('')
      continue
    }

    const leftPts = points.map(p => ({ x: p.cx - p.hw, y: p.y }))
    const rightPts = [...points.map(p => ({ x: p.cx + p.hw, y: p.y }))].reverse()

    const leftD = smoothPath(leftPts)
    const rightD = smoothPath(rightPts)
    const curveStart = rightD.indexOf(' C')
    const closedPath =
      leftD +
      ` L ${rightPts[0].x} ${rightPts[0].y}` +
      (curveStart >= 0 ? rightD.substring(curveStart) : '') +
      ' Z'

    fills.push(closedPath)
    centers.push(smoothPath(points.map(p => ({ x: p.cx, y: p.y }))))
  }

  return { fills, centers }
}

export function useCascadeLanes(containerRef: RefObject<HTMLElement | null>) {
  const [paths, setPaths] = useState<SvgPaths>({ fills: [], centers: [] })
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 })

  const draw = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const tier5El = document.getElementById('cascade-tier-5')
    const svgH = tier5El
      ? tier5El.getBoundingClientRect().bottom - container.getBoundingClientRect().top
      : container.offsetHeight
    setSvgSize({ w: container.offsetWidth, h: svgH })
    setPaths(computePaths(container))
  }, [containerRef])

  useEffect(() => {
    // Delay to let Framer Motion animations settle before measuring DOM
    const t1 = setTimeout(draw, 900)
    const t2 = setTimeout(draw, 3500) // second pass after all staggered tiers appear
    window.addEventListener('resize', draw)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      window.removeEventListener('resize', draw)
    }
  }, [draw])

  return { paths, svgSize, LANE_COLORS }
}
