# Error Handling & Logging Skill

**Version:** 1.0.0
**Last Updated:** 2026-01-09

---

## Overview

Error handling in the Morperhaus Concert Archives follows defensive patterns to ensure graceful degradation. The app interacts with multiple external APIs and must handle failures without breaking the user experience.

**Core Principles:**
- Fail gracefully with fallbacks
- Log errors consistently for debugging
- Don't expose technical details to users
- Provide actionable user-facing messages
- Use defensive programming for external data

---

## Error Handling Strategy

### 1. External API Errors

The app integrates with:
- **Ticketmaster API** - Tour dates
- **setlist.fm API** - Concert setlists
- **Google Places API** - Venue photos (build-time only)

**Pattern: Try → Fallback → User Message**

```typescript
// services/ticketmaster.ts
export async function searchArtistTourDates(artistName: string) {
  // Check for API key
  if (!import.meta.env.VITE_TICKETMASTER_API_KEY ||
      import.meta.env.VITE_TICKETMASTER_API_KEY === 'your_api_key_here') {
    console.warn('[Ticketmaster] Missing or placeholder API key')
    return null  // Graceful fallback
  }

  try {
    const response = await fetch(url, { signal })

    if (!response.ok) {
      console.error(`[Ticketmaster] Artist search failed: ${response.status}`)
      return null  // Return null, not throw
    }

    return response.json()
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('[Ticketmaster] Request aborted')
    } else {
      console.error('[Ticketmaster] Artist search error:', error)
    }
    return null  // Always return null on error
  }
}
```

**Key principles:**
- Return `null` on failure, not `throw`
- Log with service prefix: `[Ticketmaster]`, `[Analytics]`
- Check for missing API keys before requests
- Handle abort signals gracefully
- Provide fallback UI when data unavailable

### 2. Data Loading Errors

**Pattern: Loading → Error State → Retry Option**

```typescript
// App.tsx - Main data loading
const [data, setData] = useState<ConcertData | null>(null)
const [loading, setLoading] = useState(true)

useEffect(() => {
  fetch('/data/concerts.json')
    .then(res => res.json())
    .then(data => {
      setData(data)
      setLoading(false)
    })
    .catch(err => {
      console.error('Failed to load concert data:', err)
      setLoading(false)  // Show error state
    })
}, [])

// Loading state
if (loading) {
  return <LoadingSpinner message="Loading concert archive..." />
}

// Error state
if (!data) {
  return (
    <ErrorState
      title="Failed to load concert data"
      message="Please check the console for errors"
    />
  )
}

// Success state
return <MainScenes data={data} />
```

**Benefits:**
- Clear separation of loading/error/success states
- User sees informative message
- Console has technical details
- No app crash on data failure

### 3. Component Error Boundaries (Future Enhancement)

React Error Boundaries catch render errors:

```typescript
// Future: components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    // Future: Send to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <h2>Something went wrong</h2>
          <button onClick={() => window.location.reload()}>
            Reload App
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// Usage
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

---

## Logging Patterns

### 1. Console Logging Convention

**Service-prefixed logs:**

```typescript
// ✅ GOOD: Prefixed, categorized logs
console.log('[Analytics] Service initialized', { enabled: true })
console.warn('[Ticketmaster] Missing API key')
console.error('[Analytics] Failed to track event:', error)

// ❌ BAD: No context
console.log('initialized')
console.error(error)
```

**Log levels by environment:**

```typescript
// Development: Verbose logging
if (import.meta.env.DEV) {
  console.log('[Analytics] Tracking event:', eventName, params)
  console.log('[Ticketmaster] Searching for:', artistName)
}

// Production: Errors only
if (import.meta.env.PROD) {
  // Only log errors in production
  if (error) {
    console.error('[ServiceName] Error:', error)
  }
}
```

### 2. Analytics Service Logging

```typescript
// services/analytics.ts
trackEvent(eventName: string, params?: EventParams): void {
  // Development: Always log to console
  if (import.meta.env.DEV) {
    console.log(`[Analytics] ${eventName}`, params || '(no params)')
  }

  // Production: Send to GA4
  if (this.enabled && window.gtag) {
    try {
      window.gtag('event', eventName, { ...params })
    } catch (error) {
      console.error('[Analytics] Failed to track event:', error)
    }
  }
}
```

**Benefits:**
- Dev environment shows all analytics calls
- Production only logs failures
- Easy to debug tracking issues

### 3. API Request Logging

```typescript
// services/ticketmaster.ts
async function searchArtist(artistName: string) {
  console.log(`[Ticketmaster] Searching for: ${artistName}`)

  try {
    const response = await fetch(url)

    if (!response.ok) {
      console.error(`[Ticketmaster] Search failed: ${response.status}`)
      return null
    }

    const data = await response.json()
    console.log(`[Ticketmaster] Found ${data.length} results`)
    return data
  } catch (error) {
    console.error('[Ticketmaster] Request error:', error)
    return null
  }
}
```

---

## User-Facing Error Messages

### 1. Data Loading Failures

**Loading State:**
```typescript
<div className="text-center">
  <Spinner />
  <p className="text-gray-600">Loading concert archive...</p>
</div>
```

**Error State:**
```typescript
<div className="text-center text-red-600">
  <p className="text-xl font-semibold mb-2">Failed to load concert data</p>
  <p className="text-gray-500">Please check the console for errors</p>
</div>
```

**Guidelines:**
- Be specific but not technical
- Suggest next steps (check console, reload)
- Use friendly tone
- Avoid jargon

### 2. API Feature Unavailability

```typescript
// Tour dates unavailable
{tourDates.length === 0 && (
  <p className="text-gray-500 text-sm">
    No upcoming tour dates available
  </p>
)}

// Setlist unavailable
{!setlist && (
  <p className="text-gray-400">
    Setlist not available for this show
  </p>
)}

// Image unavailable (show placeholder)
<img
  src={imageUrl || '/images/placeholder-artist.jpg'}
  alt={artistName}
  onError={(e) => {
    e.currentTarget.src = '/images/placeholder-artist.jpg'
  }}
/>
```

**Pattern: Silent fallback with subtle message**
- Don't show error states for optional features
- Use placeholders gracefully
- Inform user only if relevant

### 3. Deep Link Errors

```typescript
// Scene4Bands.tsx - Invalid venue parameter
useEffect(() => {
  if (!pendingVenueFocus) return

  const matchingConcert = concerts.find(c => c.venueNormalized === pendingVenueFocus)
  if (!matchingConcert) {
    console.warn(`Venue "${pendingVenueFocus}" not found in concerts data`)
    onVenueFocusComplete?.()  // Clear pending state, show default view
    return
  }

  // Proceed with focus...
}, [pendingVenueFocus])
```

**User sees:**
- Default scene view (no broken state)

**Console shows:**
- Warning with specific venue name

---

## Defensive Programming Patterns

### 1. Null Checks

```typescript
// ✅ GOOD: Check for existence before access
const artistImage = metadata?.image || '/placeholder.jpg'
const concertCount = concerts?.length || 0

// ✅ GOOD: Optional chaining
onVenueFocusComplete?.()
venue.metadata?.photoUrl

// ❌ BAD: Assume existence
const image = metadata.image  // Crashes if metadata is null
```

### 2. Type Guards

```typescript
// ✅ GOOD: Validate external data
function isValidConcert(data: any): data is Concert {
  return (
    typeof data.id === 'string' &&
    typeof data.headliner === 'string' &&
    typeof data.date === 'string' &&
    typeof data.venue === 'string'
  )
}

// Use it
const concerts = rawData.filter(isValidConcert)
```

### 3. Default Values

```typescript
// ✅ GOOD: Provide defaults
function processVenue(venue: Venue = DEFAULT_VENUE) {
  // Safe to access venue properties
}

// ✅ GOOD: Default in destructuring
const { name = 'Unknown Artist', year = 2024 } = artist
```

### 4. Safe Array Operations

```typescript
// ✅ GOOD: Check length before access
const firstConcert = concerts.length > 0 ? concerts[0] : null

// ✅ GOOD: Use optional chaining with array methods
const artistNames = concerts?.map(c => c.headliner) ?? []

// ❌ BAD: Assume non-empty
const firstConcert = concerts[0]  // Undefined if empty
```

---

## External API Error Handling

### 1. Ticketmaster API

**Error scenarios:**
- Missing API key → Don't make request
- Rate limit exceeded → Return cached data
- Network failure → Return null
- Artist not found → Return empty array

```typescript
// services/ticketmaster.ts
export async function getTourDates(artistName: string) {
  // Scenario 1: Missing API key
  if (!apiKey) {
    console.warn('[Ticketmaster] Missing API key')
    return { dates: [], source: 'unavailable' }
  }

  try {
    const response = await fetch(url)

    // Scenario 2: Rate limit
    if (response.status === 429) {
      console.warn('[Ticketmaster] Rate limit exceeded')
      return getCachedDates(artistName) || { dates: [], source: 'rate-limited' }
    }

    // Scenario 3: Not found
    if (response.status === 404) {
      return { dates: [], source: 'not-found' }
    }

    // Success
    return { dates: await response.json(), source: 'api' }
  } catch (error) {
    // Scenario 4: Network failure
    console.error('[Ticketmaster] Request failed:', error)
    return getCachedDates(artistName) || { dates: [], source: 'error' }
  }
}
```

### 2. setlist.fm API

**Caching strategy for reliability:**

```typescript
// services/setlistfm.ts
const staticCache = new Map<string, Setlist[]>()

// Load static cache at import (build-time prefetched setlists)
try {
  const response = await fetch('/data/setlists-cache.json')
  const cached = await response.json()
  Object.entries(cached).forEach(([key, value]) => {
    staticCache.set(key, value)
  })
  console.log(`Loaded ${staticCache.size} setlists from static cache`)
} catch (error) {
  console.warn('Failed to load static setlist cache:', error)
  // Continue without cache
}

// Fetch with fallback to cache
export async function getSetlists(artistName: string) {
  // Try static cache first
  const cacheKey = normalizeArtistName(artistName)
  if (staticCache.has(cacheKey)) {
    return staticCache.get(cacheKey)
  }

  // Fall back to API
  try {
    const response = await fetch(apiUrl)
    if (!response.ok) {
      return []  // Silent failure
    }
    return response.json()
  } catch (error) {
    console.error('[setlist.fm] API error:', error)
    return []
  }
}
```

**Benefits:**
- Most setlists available immediately (static cache)
- API only called for new artists
- Graceful degradation on API failure

### 3. Google Places API (Build-Time Only)

```typescript
// scripts/enrich-venues.ts (build script)
try {
  const photo = await fetchVenuePhoto(venueName, location)
  venue.photoUrl = photo.url
  venue.photoAttribution = photo.attribution
} catch (error) {
  console.error(`Failed to fetch photo for ${venueName}:`, error)
  // Continue without photo - not critical
}
```

**Build-time errors don't affect runtime:**
- Missing photos use placeholders
- Script logs errors for manual review
- Data file generated even with partial failures

---

## Storage Error Handling

### 1. localStorage Failures

**Scenario: Private browsing mode disables localStorage**

```typescript
// utils/changelogStorage.ts
export function getLastSeenVersion(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY)
  } catch (e) {
    console.warn('localStorage unavailable (private browsing?):', e)
    return null  // Fall back to default behavior
  }
}

export function setLastSeenVersion(version: string): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, version)
  } catch (e) {
    console.warn('localStorage write failed:', e)
    // Fail silently - not critical
  }
}
```

**Guidelines:**
- Wrap all localStorage access in try/catch
- Provide fallback behavior
- Don't crash if storage unavailable
- Log warning for debugging

### 2. sessionStorage Failures

```typescript
export function getSessionDismissed(): boolean {
  try {
    return sessionStorage.getItem(SESSION_DISMISSED_KEY) === 'true'
  } catch (e) {
    console.warn('sessionStorage read failed:', e)
    return false
  }
}
```

---

## Network Error Handling

### 1. Abort Signals

Handle user navigation away during fetch:

```typescript
useEffect(() => {
  const controller = new AbortController()

  fetch('/api/data', { signal: controller.signal })
    .then(res => res.json())
    .then(data => setData(data))
    .catch(err => {
      if (err.name === 'AbortError') {
        console.log('Fetch aborted - user navigated away')
        // Don't treat as error
      } else {
        console.error('Fetch failed:', err)
        setError(err)
      }
    })

  return () => {
    controller.abort()
  }
}, [])
```

### 2. Timeout Handling

```typescript
async function fetchWithTimeout(url: string, timeout = 5000) {
  const controller = new AbortController()

  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('Request timeout')
    }
    throw error
  }
}
```

### 3. Retry Logic

```typescript
// services/ticketmaster.ts - Retry without "The" prefix
try {
  let response = await searchArtist(artistName)

  // If no results and name starts with "The", try without it
  if (!response && artistName.startsWith('The ')) {
    const normalized = artistName.substring(4)
    console.log(`[Ticketmaster] Retrying without "The": ${normalized}`)
    response = await searchArtist(normalized)
  }

  return response
} catch (error) {
  console.error('[Ticketmaster] Search failed:', error)
  return null
}
```

---

## Image Error Handling

### 1. Fallback Images

```typescript
<img
  src={venue.photoUrl || '/images/placeholder-venue.jpg'}
  alt={venue.name}
  onError={(e) => {
    e.currentTarget.src = '/images/placeholder-venue.jpg'
  }}
/>
```

### 2. Loading States

```typescript
const [imageLoaded, setImageLoaded] = useState(false)
const [imageError, setImageError] = useState(false)

<div className="relative">
  {!imageLoaded && !imageError && (
    <div className="absolute inset-0 bg-gray-200 animate-pulse" />
  )}

  <img
    src={imageUrl}
    onLoad={() => setImageLoaded(true)}
    onError={() => {
      setImageError(true)
      setImageLoaded(true)
    }}
    className={imageLoaded ? 'opacity-100' : 'opacity-0'}
  />

  {imageError && (
    <div className="text-gray-400">Image unavailable</div>
  )}
</div>
```

---

## Validation & Sanitization

### 1. URL Parameter Validation

```typescript
// App.tsx - Deep linking validation
const params = new URLSearchParams(location.search)
const sceneParam = params.get('scene')

if (sceneParam && !SCENE_MAP[sceneParam]) {
  console.warn('Invalid scene parameter:', sceneParam)
  // Fall back to default scene (Scene 1)
  return
}

// Valid scene - proceed
const sceneId = SCENE_MAP[sceneParam]
```

### 2. Data Normalization Validation

```typescript
// scripts/validate-normalization.ts (build-time check)
function validateNormalization(original: string, normalized: string) {
  // Check for invalid characters
  if (normalized.includes('_') || normalized.includes(' ')) {
    throw new Error(`Invalid normalization: "${original}" → "${normalized}"`)
  }

  // Check for consecutive hyphens
  if (normalized.includes('--')) {
    console.warn(`Consecutive hyphens in: "${normalized}"`)
  }

  // Check for leading/trailing hyphens
  if (normalized.startsWith('-') || normalized.endsWith('-')) {
    throw new Error(`Invalid normalization: "${normalized}" has edge hyphens`)
  }
}
```

---

## Error Logging Best Practices

### ✅ DO

**1. Log with context**
```typescript
console.error('[ServiceName] Operation failed:', {
  operation: 'fetchData',
  params: { id: 123 },
  error: error.message
})
```

**2. Use appropriate log levels**
```typescript
console.log('[Info] Normal operation')
console.warn('[Warning] Degraded functionality')
console.error('[Error] Critical failure')
```

**3. Log user actions for debugging**
```typescript
console.log('[User] Clicked artist card:', artistName)
console.log('[User] Changed view mode:', viewMode)
```

**4. Log in development only**
```typescript
if (import.meta.env.DEV) {
  console.log('[Debug] State changed:', newState)
}
```

### ❌ DON'T

**1. Log sensitive data**
```typescript
// ❌ BAD
console.log('User data:', user.email, user.password)

// ✅ GOOD
console.log('User authenticated:', { id: user.id })
```

**2. Log too verbosely in production**
```typescript
// ❌ BAD
console.log('Processing item 1 of 1000...')
console.log('Processing item 2 of 1000...')

// ✅ GOOD
console.log('Processing 1000 items...')
console.log('Processing complete')
```

**3. Swallow errors silently**
```typescript
// ❌ BAD
try {
  riskyOperation()
} catch (e) {
  // Silent failure - no one knows it failed!
}

// ✅ GOOD
try {
  riskyOperation()
} catch (e) {
  console.error('[Service] Operation failed:', e)
  return fallbackValue
}
```

---

## Debugging Tools

### 1. Console Filtering

Chrome DevTools Console filters:

```
# Show only errors
-[Info] -[Analytics]

# Show specific service
[Ticketmaster]

# Show user actions
[User]
```

### 2. Network Tab Inspection

Check for:
- Failed requests (red status codes)
- Slow requests (waterfall view)
- Canceled requests (aborted fetches)
- Response payloads

### 3. React DevTools

Inspect component errors:
- Check props/state when error occurs
- Use "Highlight updates" to find re-render issues
- Profile component render times

---

## Future Enhancements

Planned error handling improvements:

1. **Error Tracking Service**
   - Sentry or similar for production errors
   - Automated error aggregation
   - User session replay

2. **Retry Strategies**
   - Exponential backoff for API calls
   - Circuit breaker pattern for failing services
   - Queue failed analytics events

3. **User Feedback Mechanism**
   - "Report a problem" button
   - Automatic context collection
   - Screenshot capture

4. **Service Health Dashboard**
   - Real-time API status
   - Fallback mode indicators
   - Feature availability matrix

---

## Related Documentation

- [API Integration Skill](./../api-integration/SKILL.md) - API patterns
- [State Management Skill](./../state-management/SKILL.md) - State patterns
- [Analytics Skill](./../analytics/SKILL.md) - Event tracking

---

## Resources

- [Error Handling in React](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [MDN: Using Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
- [Chrome DevTools Console Reference](https://developer.chrome.com/docs/devtools/console/reference/)
