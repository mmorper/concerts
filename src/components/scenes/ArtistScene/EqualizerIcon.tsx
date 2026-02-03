/**
 * Animated equalizer icon (3 bouncing bars)
 * Shows when a track is currently playing
 */
export function EqualizerIcon({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-end gap-0.5 h-4 ${className}`}>
      {/* Bar 1 */}
      <div
        className="w-0.5 bg-white animate-bounce"
        style={{
          animationDelay: '0ms',
          animationDuration: '800ms',
          height: '4px'
        }}
      />
      {/* Bar 2 */}
      <div
        className="w-0.5 bg-white animate-bounce"
        style={{
          animationDelay: '200ms',
          animationDuration: '900ms',
          height: '8px'
        }}
      />
      {/* Bar 3 */}
      <div
        className="w-0.5 bg-white animate-bounce"
        style={{
          animationDelay: '400ms',
          animationDuration: '850ms',
          height: '6px'
        }}
      />
    </div>
  )
}
