import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface AnimatedConnectorProps {
  toColor: string
  duration?: number
  height?: number
}

export function AnimatedConnector({ toColor, duration = 400, height = 40 }: AnimatedConnectorProps) {
  const [done, setDone] = useState(false)

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const ms = reduced ? 0 : duration
    const timer = setTimeout(() => setDone(true), ms)
    return () => clearTimeout(timer)
  }, [])

  if (done) {
    return (
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 2, height: 24 }}>
        <svg width="2" height="24" viewBox="0 0 2 24" style={{ display: 'block', margin: '0 auto' }}>
          <line x1="1" y1="0" x2="1" y2="22" stroke={toColor} strokeWidth="1" strokeOpacity="0.2" />
        </svg>
      </div>
    )
  }

  if (reduced) return null

  return (
    <div style={{ textAlign: 'center', position: 'relative', zIndex: 2, height }}>
      <svg
        width="2"
        height={height}
        viewBox={`0 0 2 ${height}`}
        style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}
      >
        <motion.path
          d={`M 1 0 L 1 ${height}`}
          stroke={toColor}
          strokeWidth="1.5"
          strokeOpacity="0.7"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: duration / 1000, ease: 'easeInOut' }}
        />
      </svg>
    </div>
  )
}
