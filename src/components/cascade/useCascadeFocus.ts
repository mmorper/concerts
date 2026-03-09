import { useState, useCallback } from 'react'
import type { FocusAtom } from './cascadeTypes'

// Which tier indices (0-6) are relevant to each atom
const ATOM_RELEVANCE: Record<string, number[]> = {
  date:   [0, 1, 5, 6],
  venue:  [0, 1, 2, 5, 6],
  artist: [0, 1, 3, 4, 5, 6],
}

export function useCascadeFocus() {
  const [focusedAtom, setFocusedAtom] = useState<FocusAtom>(null)

  const focusAtom = useCallback((atom: FocusAtom) => {
    setFocusedAtom(prev => (prev === atom ? null : atom))
  }, [])

  const resetFocus = useCallback(() => {
    setFocusedAtom(null)
  }, [])

  const isTierRelevant = useCallback(
    (tierIndex: number): boolean => {
      if (!focusedAtom) return true
      return ATOM_RELEVANCE[focusedAtom]?.includes(tierIndex) ?? true
    },
    [focusedAtom],
  )

  return { focusedAtom, focusAtom, resetFocus, isTierRelevant }
}
