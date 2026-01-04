import { useState, useRef, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDebounce } from '../../../hooks/useDebounce'
import { ArtistPlaceholder } from './ArtistPlaceholder'
import type { ArtistCard } from './types'

interface ArtistSearchTypeaheadProps {
  artists: ArtistCard[]
  onArtistSelect: (normalizedName: string) => void
  getArtistImage: (artistName: string) => string | undefined
  artistImageLoading: boolean
}

/**
 * Multi-tier search algorithm for artist names
 * Scores artists based on match quality and popularity
 */
function searchArtists(query: string, artists: ArtistCard[]): ArtistCard[] {
  if (!query.trim()) return []

  const normalizedQuery = query.toLowerCase().trim()

  const scored = artists.map(artist => {
    const name = artist.name.toLowerCase()
    let score = 0

    // TIER 1: Exact match (highest priority)
    if (name === normalizedQuery) {
      score += 1000
    }
    // TIER 2: Starts with query (high priority)
    else if (name.startsWith(normalizedQuery)) {
      score += 100
      // Bonus: Shorter names rank higher (more relevant)
      score += (50 - name.length) * 0.5
    }
    // TIER 3: Contains query (medium priority)
    else if (name.includes(normalizedQuery)) {
      score += 50
      // Bonus: Earlier position ranks higher
      const position = name.indexOf(normalizedQuery)
      score += (50 - position) * 0.3
    }
    // TIER 4: Word boundary matching (low priority)
    else {
      const words = name.split(/\s+/)
      const matchingWords = words.filter(w => w.startsWith(normalizedQuery))
      if (matchingWords.length > 0) {
        score += 25 * matchingWords.length
      }
    }

    // BONUS: Popularity weight (tiebreaker)
    if (score > 0) {
      score += artist.timesSeen * 0.5
    }

    return { artist, score }
  })

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => {
      // Primary sort: Score descending
      if (b.score !== a.score) return b.score - a.score
      // Tiebreaker: Alphabetical
      return a.artist.name.localeCompare(b.artist.name)
    })
    .slice(0, 20) // Limit to top 20 results
    .map(s => s.artist)
}

/**
 * Artist search with intelligent typeahead dropdown
 * Features multi-tier scoring, keyboard navigation, and smooth scrolling
 */
export function ArtistSearchTypeahead({
  artists,
  onArtistSelect,
  getArtistImage,
  artistImageLoading
}: ArtistSearchTypeaheadProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const resultRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Debounce search query for performance
  const debouncedQuery = useDebounce(searchQuery, 200)

  // Filter and score artists based on search query
  const filteredArtists = useMemo(() => {
    if (!debouncedQuery) return []
    return searchArtists(debouncedQuery, artists)
  }, [debouncedQuery, artists])

  // Open/close dropdown based on query and results
  useEffect(() => {
    if (debouncedQuery && filteredArtists.length > 0) {
      setIsDropdownOpen(true)
    } else {
      setIsDropdownOpen(false)
      setSelectedIndex(-1)
    }
  }, [debouncedQuery, filteredArtists.length])

  // Scroll selected result into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultRefs.current[selectedIndex]) {
      resultRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      })
    }
  }, [selectedIndex])

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  const handleSelectArtist = (artist: ArtistCard) => {
    onArtistSelect(artist.normalizedName)
    setSearchQuery('')
    setIsDropdownOpen(false)
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  const handleClear = () => {
    setSearchQuery('')
    setIsDropdownOpen(false)
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!isDropdownOpen && filteredArtists.length > 0) {
          setIsDropdownOpen(true)
          setSelectedIndex(0)
        } else if (isDropdownOpen) {
          setSelectedIndex(prev =>
            prev < filteredArtists.length - 1 ? prev + 1 : 0
          )
        }
        break

      case 'ArrowUp':
        e.preventDefault()
        if (isDropdownOpen) {
          setSelectedIndex(prev =>
            prev > 0 ? prev - 1 : filteredArtists.length - 1
          )
        }
        break

      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && filteredArtists[selectedIndex]) {
          handleSelectArtist(filteredArtists[selectedIndex])
        }
        break

      case 'Escape':
        setIsDropdownOpen(false)
        setSearchQuery('')
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break

      case 'Tab':
        if (isDropdownOpen) {
          setIsDropdownOpen(false)
          setSelectedIndex(-1)
        }
        break
    }
  }

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Search Input */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/60"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search artists"
          aria-autocomplete="list"
          aria-controls="artist-search-results"
          aria-expanded={isDropdownOpen}
          aria-activedescendant={
            selectedIndex >= 0
              ? `artist-result-${filteredArtists[selectedIndex]?.normalizedName}`
              : undefined
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type to search artists..."
          className="w-full h-11 pl-11 pr-10 py-3 bg-gray-900/60 backdrop-blur-md border border-white/30 rounded-lg text-white placeholder-white/90 shadow-lg focus:border-purple-400 focus:ring-3 focus:ring-purple-500/30 outline-none transition-all duration-200"
          style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)' }}
        />
        {searchQuery && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
            aria-label="Clear search"
          >
            <svg
              className="w-[18px] h-[18px]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      <AnimatePresence>
        {isDropdownOpen && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            id="artist-search-results"
            role="listbox"
            aria-label="Artist search results"
            className="absolute top-full mt-2 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden z-50"
            style={{ maxHeight: '400px', overflowY: 'auto' }}
          >
            {filteredArtists.length > 0 ? (
              <ul>
                {filteredArtists.map((artist, index) => {
                  const artistImage = artistImageLoading ? undefined : getArtistImage(artist.name)

                  return (
                    <li
                      key={artist.normalizedName}
                      id={`artist-result-${artist.normalizedName}`}
                      role="option"
                      aria-selected={index === selectedIndex}
                    >
                      <button
                        ref={el => resultRefs.current[index] = el}
                        onClick={() => handleSelectArtist(artist)}
                        onPointerDown={(e) => e.preventDefault()} // Prevents input blur
                        className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                          index === selectedIndex
                            ? 'bg-purple-500/20 text-purple-300 border-l-2 border-purple-500'
                            : 'text-gray-300 hover:bg-gray-800'
                        }`}
                      >
                        {/* Artist Image (48×48px) */}
                        <div className="flex-shrink-0 w-12 h-12 overflow-hidden rounded">
                          {artistImage ? (
                            <img
                              src={artistImage}
                              alt={`${artist.name} artist photo`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 scale-[0.6]">
                              <ArtistPlaceholder
                                artistName={artist.name}
                                genre={artist.primaryGenre}
                              />
                            </div>
                          )}
                        </div>

                        {/* Artist Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">
                            {artist.name}
                          </div>
                          <div className="text-sm text-gray-400 truncate">
                            {artist.primaryGenre}
                          </div>
                        </div>

                        {/* Times Seen Badge */}
                        {artist.timesSeen > 1 && (
                          <div className="flex-shrink-0 ml-3 px-2 py-0.5 bg-violet-600 text-white text-xs font-bold rounded-full">
                            ×{artist.timesSeen}
                          </div>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center text-gray-500">
                <div className="text-lg mb-2">🎸</div>
                <div className="text-sm">No artists found</div>
                <div className="text-xs text-gray-600 mt-1">
                  Try a different search term
                </div>
              </div>
            )}

            {/* Screen reader announcements */}
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {filteredArtists.length > 0
                ? `${filteredArtists.length} artists found`
                : searchQuery
                  ? 'No artists found'
                  : ''
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
