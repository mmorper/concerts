import { useState, useRef, useEffect } from 'react'

interface MultiSelectFilterProps {
  label: string
  icon?: string
  options: string[]
  selectedValues: string[]
  onToggle: (value: string) => void
  onClear: () => void
}

export function MultiSelectFilter({
  label,
  icon,
  options,
  selectedValues,
  onToggle,
  onClear,
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const selectedCount = selectedValues.length

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
          selectedCount > 0
            ? 'bg-purple-500/20 border-purple-500 text-purple-300'
            : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
        }`}
      >
        {icon && <span>{icon}</span>}
        <span className="font-medium text-sm">
          {label}
          {selectedCount > 0 && ` (${selectedCount})`}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-80 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-3 border-b border-gray-700 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-300">Select {label}</span>
            {selectedCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onClear()
                }}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="overflow-y-auto flex-1">
            {options.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No options available</div>
            ) : (
              <div className="p-2">
                {options.map((option) => {
                  const isSelected = selectedValues.includes(option)
                  return (
                    <button
                      key={option}
                      onClick={() => onToggle(option)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                        isSelected
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-purple-500 border-purple-500' : 'border-gray-600'
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      <span className="flex-1 text-left truncate">{option}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
