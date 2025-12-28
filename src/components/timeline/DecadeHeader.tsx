interface DecadeHeaderProps {
  decade: string
  concertCount: number
}

export function DecadeHeader({ decade, concertCount }: DecadeHeaderProps) {
  return (
    <div className="my-12 text-center">
      <div className="inline-block">
        <div className="relative">
          <h2 className="text-6xl font-display uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400">
            {decade}
          </h2>
          <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50" />
        </div>
        <p className="mt-3 text-sm font-mono uppercase tracking-widest text-gray-500">
          {concertCount} {concertCount === 1 ? 'concert' : 'concerts'} in this decade
        </p>
      </div>
    </div>
  )
}
