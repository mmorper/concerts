import { useEffect, useState } from 'react'

export interface ActiveSceneState {
  /** 1-based index of the currently snapped scene (clamped to [1, sceneCount]). */
  scene: number
  /** True while the user is actively scrolling; flips false after `dwellMs` of stillness. */
  isScrolling: boolean
}

// Dwell before the rail's hover label is dismissed on scroll (~0.8–1s of stillness).
const DWELL_MS = 900

/**
 * The 1-based snapped-scene index for a `.snap-y` scroll container. The single shared definition of
 * this math — used by both this hook (the rail) and App's scene/analytics listener — so they can't
 * drift. Clamped to [1, sceneCount].
 */
export function sceneIndexFromScroll(container: Element, sceneCount: number): number {
  const idx = Math.round(container.scrollTop / window.innerHeight) + 1
  return Math.min(Math.max(idx, 1), sceneCount)
}

/**
 * Tracks "which scene is in view + is the user actively scrolling", derived from the `.snap-y`
 * container. `sceneCount` is REQUIRED (the scene roster lives with the caller — there is no safe
 * default). Safe on routes without a scroll container — it reports scene 1, settled.
 */
export function useActiveScene(opts: { sceneCount: number; dwellMs?: number }): ActiveSceneState {
  const { sceneCount } = opts
  const dwellMs = opts.dwellMs ?? DWELL_MS
  const [scene, setScene] = useState(1)
  const [isScrolling, setIsScrolling] = useState(false)

  useEffect(() => {
    const container = document.querySelector('.snap-y')
    if (!container) return

    let dwellTimer: ReturnType<typeof setTimeout> | undefined

    const computeScene = () => setScene(sceneIndexFromScroll(container, sceneCount))

    const handleScroll = () => {
      computeScene()
      setIsScrolling(true)
      if (dwellTimer) clearTimeout(dwellTimer)
      dwellTimer = setTimeout(() => setIsScrolling(false), dwellMs)
    }

    computeScene() // initialise — deep links can land mid-scroll
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (dwellTimer) clearTimeout(dwellTimer)
    }
  }, [sceneCount, dwellMs])

  return { scene, isScrolling }
}
