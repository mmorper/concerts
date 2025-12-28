import { useFilterStore } from '@/store/useFilterStore'
import { useState, useEffect } from 'react'

interface YearRangeSliderProps {
  minYear: number
  maxYear: number
}

export function YearRangeSlider({ minYear, maxYear }: YearRangeSliderProps) {
  const { yearRange, setYearRange } = useFilterStore()
  const [localRange, setLocalRange] = useState<[number, number]>(yearRange)

  // Update local state when external yearRange changes
  useEffect(() => {
    setLocalRange(yearRange)
  }, [yearRange])

  const handleMinChange = (value: number) => {
    const newMin = Math.min(value, localRange[1])
    setLocalRange([newMin, localRange[1]])
  }

  const handleMaxChange = (value: number) => {
    const newMax = Math.max(value, localRange[0])
    setLocalRange([localRange[0], newMax])
  }

  const handleCommit = () => {
    setYearRange(localRange)
  }

  const isFiltered = localRange[0] !== minYear || localRange[1] !== maxYear
  const percentage = {
    left: ((localRange[0] - minYear) / (maxYear - minYear)) * 100,
    right: ((maxYear - localRange[1]) / (maxYear - minYear)) * 100,
  }

  return (
    <div className={`p-4 rounded-lg border transition-colors ${
      isFiltered
        ? 'bg-purple-500/20 border-purple-500'
        : 'bg-gray-800 border-gray-700'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
          📅 Years
        </span>
        {isFiltered && (
          <button
            onClick={() => {
              const resetRange: [number, number] = [minYear, maxYear]
              setLocalRange(resetRange)
              setYearRange(resetRange)
            }}
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Year display */}
        <div className="flex items-center justify-between text-lg font-mono font-bold">
          <span className={isFiltered ? 'text-purple-300' : 'text-gray-400'}>{localRange[0]}</span>
          <span className="text-gray-600">—</span>
          <span className={isFiltered ? 'text-purple-300' : 'text-gray-400'}>{localRange[1]}</span>
        </div>

        {/* Range slider track */}
        <div className="relative h-2">
          {/* Background track */}
          <div className="absolute w-full h-2 bg-gray-700 rounded-full" />

          {/* Active track */}
          <div
            className="absolute h-2 bg-purple-500 rounded-full"
            style={{
              left: `${percentage.left}%`,
              right: `${percentage.right}%`,
            }}
          />

          {/* Min thumb */}
          <input
            type="range"
            min={minYear}
            max={maxYear}
            value={localRange[0]}
            onChange={(e) => handleMinChange(parseInt(e.target.value))}
            onMouseUp={handleCommit}
            onTouchEnd={handleCommit}
            className="absolute w-full h-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-purple-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-purple-500 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-lg"
          />

          {/* Max thumb */}
          <input
            type="range"
            min={minYear}
            max={maxYear}
            value={localRange[1]}
            onChange={(e) => handleMaxChange(parseInt(e.target.value))}
            onMouseUp={handleCommit}
            onTouchEnd={handleCommit}
            className="absolute w-full h-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-purple-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-purple-500 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-lg"
          />
        </div>

        {/* Min/max labels */}
        <div className="flex items-center justify-between text-xs font-mono text-gray-500">
          <span>{minYear}</span>
          <span>{maxYear}</span>
        </div>
      </div>
    </div>
  )
}
