/**
 * ToastMock — Development-only visual reference
 *
 * Renders both toast variants side by side for review.
 * NOT wired into routing. Import into a dev page to preview.
 */

import { TOAST } from './constants'

const LINER_NOTES_ACCENT = '#0ea5e9' // sky-500

// Shared layout values derived from TOAST constants
const toastStyle: React.CSSProperties = {
  width: `${TOAST.WIDTH}px`,
  backgroundColor: TOAST.BG_COLOR,
  borderWidth: '2px',
  borderStyle: 'solid',
  borderRadius: '8px',
  padding: '16px',
  fontFamily: 'inherit',
}

export function ToastMock() {
  return (
    <div
      style={{
        display: 'flex',
        gap: '32px',
        padding: '48px',
        backgroundColor: '#111',
        minHeight: '100vh',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
      }}
    >
      {/* Changelog variant */}
      <div>
        <div
          style={{
            color: '#94a3b8',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '8px',
          }}
        >
          changelog variant
        </div>

        <div style={{ ...toastStyle, borderColor: TOAST.BORDER_COLOR }}>
          {/* Content row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: TOAST.TEXT_PRIMARY, marginBottom: '4px' }}>
                Liner Notes
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                A rolling feed of personal essays about concerts you've actually attended.
              </div>
            </div>
            <button
              style={{
                color: '#94a3b8',
                background: 'none',
                border: 'none',
                fontSize: '20px',
                lineHeight: 1,
                marginTop: '-4px',
                marginLeft: '12px',
                minWidth: '32px',
                minHeight: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>

          {/* CTA button */}
          <button
            style={{
              width: '100%',
              padding: '6px 0',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 500,
              color: 'white',
              backgroundColor: TOAST.BUTTON_BG,
              border: 'none',
              cursor: 'pointer',
              display: 'block',
            }}
          >
            See What's Playing →
          </button>

          {/* Progress bar */}
          <div
            style={{
              marginTop: '12px',
              height: '4px',
              backgroundColor: '#1e293b',
              borderRadius: '9999px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: '60%',
                backgroundColor: '#f59e0b',
                borderRadius: '9999px',
              }}
            />
          </div>
        </div>
      </div>

      {/* Liner notes variant */}
      <div>
        <div
          style={{
            color: '#94a3b8',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '8px',
          }}
        >
          liner-notes variant
        </div>

        <div style={{ ...toastStyle, borderColor: LINER_NOTES_ACCENT }}>
          {/* Content row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: TOAST.TEXT_PRIMARY, marginBottom: '4px' }}>
                Depeche Mode: 18 Years Between Shows
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                When a band you've seen before goes silent for nearly two decades, their return feels less like...
              </div>
            </div>
            <button
              style={{
                color: '#94a3b8',
                background: 'none',
                border: 'none',
                fontSize: '20px',
                lineHeight: 1,
                marginTop: '-4px',
                marginLeft: '12px',
                minWidth: '32px',
                minHeight: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>

          {/* CTA button */}
          <button
            style={{
              width: '100%',
              padding: '6px 0',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 500,
              color: 'white',
              backgroundColor: LINER_NOTES_ACCENT,
              border: 'none',
              cursor: 'pointer',
              display: 'block',
            }}
          >
            Read the Liner Notes →
          </button>

          {/* Progress bar */}
          <div
            style={{
              marginTop: '12px',
              height: '4px',
              backgroundColor: '#1e293b',
              borderRadius: '9999px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: '60%',
                backgroundColor: LINER_NOTES_ACCENT,
                borderRadius: '9999px',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
