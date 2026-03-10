import { useState, useCallback } from 'react'
import type { FocusAtom } from './cascadeTypes'

// Which tier indices (0-6) are relevant to each atom
const ATOM_RELEVANCE: Record<string, number[]> = {
  date:   [0, 1, 5, 6],
  venue:  [0, 1, 2, 5, 6],
  artist: [0, 1, 3, 4, 5, 6],
}

// Which tier indices are relevant to each scene card
const SCENE_RELEVANCE: Record<string, number[]> = {
  timeline: [0, 1, 6],
  map:      [0, 1, 2, 6],
  artists:  [0, 1, 3, 4, 5, 6],
  network:  [0, 1, 2, 6],
}

export function useCascadeFocus() {
  const [focusedAtom, setFocusedAtom] = useState<FocusAtom>(null)
  const [focusedScene, setFocusedScene] = useState<string | null>(null)

  const focusAtom = useCallback((atom: FocusAtom) => {
    setFocusedScene(null)
    setFocusedAtom(prev => (prev === atom ? null : atom))
  }, [])

  const focusScene = useCallback((scene: string) => {
    setFocusedAtom(null)
    setFocusedScene(prev => (prev === scene ? null : scene))
  }, [])

  const resetFocus = useCallback(() => {
    setFocusedAtom(null)
    setFocusedScene(null)
  }, [])

  const isTierRelevant = useCallback(
    (tierIndex: number): boolean => {
      if (focusedAtom) return ATOM_RELEVANCE[focusedAtom]?.includes(tierIndex) ?? true
      if (focusedScene) return SCENE_RELEVANCE[focusedScene]?.includes(tierIndex) ?? true
      return true
    },
    [focusedAtom, focusedScene],
  )

  return { focusedAtom, focusAtom, focusedScene, focusScene, resetFocus, isTierRelevant }
}
