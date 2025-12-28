interface YearMarkerProps {
  year: number
  concertCount: number
}

export function YearMarker({ year, concertCount }: YearMarkerProps) {
  return (
    <div className="flex items-center gap-4 my-8">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg">
        <span className="text-2xl font-display text-purple-400 tracking-wider">{year}</span>
        <span className="text-sm font-mono text-gray-500">
          {concertCount} {concertCount === 1 ? 'show' : 'shows'}
        </span>
      </div>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
    </div>
  )
}
