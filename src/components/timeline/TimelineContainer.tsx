import { useMemo } from 'react'
import type { Concert } from '@/types/concert'
import { ConcertCard } from './ConcertCard'
import { YearMarker } from './YearMarker'
import { DecadeHeader } from './DecadeHeader'

interface TimelineContainerProps {
  concerts: Concert[]
}

interface GroupedConcerts {
  decade: string
  years: {
    year: number
    concerts: Concert[]
  }[]
}

export function TimelineContainer({ concerts }: TimelineContainerProps) {
  // Group concerts by decade and year
  const groupedConcerts = useMemo(() => {
    const decadeMap = new Map<string, Map<number, Concert[]>>()

    // Sort concerts by date (newest first)
    const sortedConcerts = [...concerts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    // Group by decade and year
    sortedConcerts.forEach((concert) => {
      const decade = concert.decade

      if (!decadeMap.has(decade)) {
        decadeMap.set(decade, new Map())
      }

      const yearMap = decadeMap.get(decade)!
      if (!yearMap.has(concert.year)) {
        yearMap.set(concert.year, [])
      }

      yearMap.get(concert.year)!.push(concert)
    })

    // Convert to array and sort
    const grouped: GroupedConcerts[] = []

    // Get decades sorted (newest first)
    const sortedDecades = Array.from(decadeMap.keys()).sort().reverse()

    sortedDecades.forEach((decade) => {
      const yearMap = decadeMap.get(decade)!
      const years = Array.from(yearMap.entries())
        .map(([year, concerts]) => ({
          year,
          concerts,
        }))
        .sort((a, b) => b.year - a.year) // Newest year first

      grouped.push({ decade, years })
    })

    return grouped
  }, [concerts])

  if (concerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <svg
          className="w-20 h-20 text-gray-700 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
          />
        </svg>
        <h3 className="text-xl font-display uppercase text-gray-400 mb-2">
          No concerts found
        </h3>
        <p className="text-gray-500 text-sm">
          Try adjusting your filters to see more results
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {groupedConcerts.map((decadeGroup) => {
        const decadeConcertCount = decadeGroup.years.reduce(
          (sum, year) => sum + year.concerts.length,
          0
        )

        return (
          <div key={decadeGroup.decade}>
            <DecadeHeader decade={decadeGroup.decade} concertCount={decadeConcertCount} />

            {decadeGroup.years.map((yearGroup) => (
              <div key={yearGroup.year} className="mb-8">
                <YearMarker year={yearGroup.year} concertCount={yearGroup.concerts.length} />

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-6">
                  {yearGroup.concerts.map((concert) => (
                    <ConcertCard key={concert.id} concert={concert} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
