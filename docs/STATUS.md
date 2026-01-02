# Morperhaus Concert Archives - Status

**Version:** v1.2.4 (Ready for Release)
**Last Updated:** 2026-01-02
**Current Phase:** Flexible Column Parsing Implementation
**Last Commit:** TBD - "feat: Add flexible header-based column parsing (v1.2.4)"
**Live URL:** https://concerts.morperhaus.org

---

## Release Status

### v1.0.0 Production 🎉
- ✅ Feature complete (all 5 scenes implemented)
- ✅ Desktop experience polished
- ✅ Documentation cleanup complete
- ✅ CI/CD setup (GitHub → Cloudflare Pages)
- ✅ Production deployment at concerts.morperhaus.org
- ✅ Custom domain configured
- ✅ v1.0.0 GitHub release published
- ✅ Custom concert ticket favicon implemented
- ✅ Geography Scene venue marker fixes
- ✅ API documentation cleanup (removed unused services)

### v1.1.0 iPad Optimization 🎉
- ✅ iPad support complete (all scenes functional)
- ✅ 44px touch targets across all interactive elements
- ✅ Timeline portrait load bug fixed
- ✅ Venues scene re-centering bug fixed
- ✅ Build version tracking system implemented
- ✅ v1.1.0 GitHub release published

### v1.2.0 Data Pipeline Enhancement 🎉

- ✅ Google Sheets Phase 1 Core complete (OAuth 2.0, fetch, process, geocode)
- ✅ Phase 1 Enhancement 1.1: Pre-build validation (`npm run validate-data`)
- ✅ Phase 1 Enhancement 1.2: Detailed logging and statistics
- ✅ Phase 1 Enhancement 1.3: Change comparison (`npm run diff-data`)
- ✅ Complete documentation ([DATA_PIPELINE.md](DATA_PIPELINE.md))
- ✅ Implementation notes ([specs/implemented/google-sheets-phase1-implementation.md](specs/implemented/google-sheets-phase1-implementation.md))
- 📝 Phase 2 (webhook automation) out of scope for v1.2.0, spec'd for future

### v1.2.1 Safety Features 🎉

- ✅ Automatic timestamped backups before all file writes
- ✅ Backup retention management (keeps last 10, automatic cleanup)
- ✅ Dry-run mode for safe testing (`--dry-run` flag)
- ✅ Reusable backup utility module (`scripts/utils/backup.ts`)
- ✅ Updated documentation with comprehensive safety features section
- ✅ Backup files excluded from git (`.gitignore` updated)

### v1.2.2 Critical Bug Fixes 🎉

- ✅ **CRITICAL FIX:** Restored venue-specific geocoding from cache
  - Fixed Geography scene showing all concerts in Denver, Colorado
  - Integrated geocode cache (77 venue locations) into fetch pipeline
  - All 174 concerts now have correct venue-specific coordinates
- ✅ **TheAudioDB Documentation:** Comprehensive artist enrichment documentation
  - Documented metadata fields (name, image, bio, genres, formed, website)
  - Added caching strategy (30-day retention) and rate limiting details
  - Explained why some artists fail to enrich
- ✅ **Gitignore Fix:** Updated backup exclusion pattern
  - Fixed pattern to exclude timestamped backups (`*.backup.*`)
  - Prevents backup files from being committed to git
- ✅ **Data Quality:** Fixed duplicate venue entries
  - Corrected Fillmore Silver Spring appearing as two locations on map
  - Fixed 2 concerts with wrong city/state in Google Sheet

**Files Modified:**

- `scripts/fetch-google-sheet.ts` - Added geocode cache integration
- `docs/DATA_PIPELINE.md` - Added TheAudioDB enrichment section
- `.gitignore` - Updated backup exclusion patterns
- `public/data/concerts.json` - Regenerated with correct coordinates

### v1.2.3 Geocoding Robustness 🎉

- ✅ **Whitespace Handling:** Made geocode cache lookup robust to whitespace
  - Fixed 21st Amendment and Universal Amphitheater showing Denver coordinates
  - Added `.trim()` to venue, city, state before building cache key
  - Handles trailing/leading spaces in Google Sheet data
  - 6 concerts now have correct venue-specific coordinates

**Root Cause:** Venue names with trailing spaces in Google Sheet (e.g., `"Universal Amphitheater  "`) caused cache key mismatches because keys weren't trimmed before lookup.

**Impact:**

- 21st Amendment: New Orleans (29.95, -90.07) ✅
- Universal Amphitheater: Los Angeles (34.18, -118.47) ✅

**Files Modified:**

- `scripts/fetch-google-sheet.ts` - Added whitespace trimming to cache key generation (line 77)
- `public/data/concerts.json` - Regenerated with corrected coordinates

### v1.2.4 Flexible Column Parsing (Current) 🎉

- ✅ **Header-Based Column Detection:** Refactored Google Sheets parser to use headers instead of hardcoded indices
  - Columns can now be reordered without breaking the pipeline
  - Supports multiple column name variations (e.g., "City/State", "citystate")
  - Handles both combined `City/State` and separate `City` + `State` columns
  - Genre column now optional (prepares for Phase 2 genre removal)
  - Whitespace trimming applied to ALL fields (date, headliner, genre, venue, city, state)
  - Clear error messages showing available columns when required columns missing

**Why This Matters:**

- Enables safe removal of genre column in Phase 2 (Roadmap v1.2.4)
- Makes Google Sheet structure more flexible for future changes
- Prevents whitespace-related bugs across all fields (not just geocode keys)
- Reduces brittleness - no more "column 2 must be genre" hardcoding

**Implementation Details:**

- Added `parseHeaders()` and `getColumnIndex()` helper methods
- Updated range fetching to include header row (A1 instead of A2)
- Modified `fetch-google-sheet.ts` to adjust range automatically
- All field values trimmed on parse (prevents cache mismatches)

**Files Modified:**

- `scripts/utils/google-sheets-client.ts` - Header-based parsing logic
- `scripts/fetch-google-sheet.ts` - Range adjustment for header row
- `docs/DATA_PIPELINE.md` - Added "Flexible Column Support" section
- `docs/specs/future/google-sheets-data-integration.md` - Updated column mapping table

**Success Criteria Met:**

- ✅ Pipeline runs with genre column present
- ✅ Parser warns (non-blocking) when genre column missing
- ✅ concerts.json maintains backward compatibility
- ✅ All 174 concerts processed successfully
- ✅ Whitespace in cityState fixed (single space, not double)

### v1.3.2 Venue Photos Backend (Current - 80% Complete) 🎯

**Status:** Backend complete, frontend integration pending
**Started:** 2026-01-02
**Focus:** Google Places API integration for venue photos

**Completed (Context Windows 1-4):**

- ✅ **Venue Classification System** - 76 venues manually researched and classified
  - Created `scripts/export-venues.ts` to generate CSV for manual research
  - Classified all venues as active/closed/demolished/renamed in `data/venue-status.csv`
  - Added closed dates and historical notes

- ✅ **Google Places API Integration** - Full Places API (New) client implementation
  - Created `scripts/utils/google-places-client.ts` with Text Search and Place Details
  - Photo URL generation (thumbnail 400px, medium 800px, large 1200px)
  - Cache-first strategy with 90-day TTL for active venues
  - Rate limiting with 20ms delays (50 req/sec max)
  - Enabled Places API (New) in Google Cloud Console

- ✅ **Venue Enrichment Script** - Automated photo fetching and metadata generation
  - Created `scripts/enrich-venues.ts` to process all venues
  - Fetches photos from Google Places API for 66 active venues
  - Checks for manual photos in `/public/images/venues/` for 10 legacy venues
  - Computes venue statistics (totalConcerts, uniqueArtists, date ranges)
  - Generates `public/data/venues-metadata.json` (76 venues, 62KB)

- ✅ **Fallback Image System** - 5-tier hierarchy for missing photos
  - Created `fallback-active.jpg` for active venues without API photos
  - Created `fallback.jpg` for legacy venues without manual photos
  - Implemented smart fallback logic in enrichment script
  - All venues have photoUrls (real photos or fallbacks)

- ✅ **Manual Photo Curation** - Historical venue photos (exceeded target!)
  - User curated 8 manual photos for legacy venues:
    - Irvine Meadows Amphitheatre, Universal Amphitheater, Nokia Center
    - Staples Center, RFK Stadium, The Galaxy Theatre
    - Crawford Hall, Hollywood Park Race Track
  - Stored in `/public/images/venues/{normalizedName}-{number}.jpg`
  - Photos integrated into venues-metadata.json

- ✅ **Photo Review Tool** - Quality control script
  - Created `scripts/review-venue-photos.ts` to list all photo URLs
  - Shows photographer attribution from Google Places API
  - Identifies venues using fallback images
  - Added npm script `review-venue-photos`

- ✅ **Comprehensive Documentation** - Complete API setup and pipeline docs
  - Updated `docs/DATA_PIPELINE.md` with Section 5 "Venue Enrichment"
  - Added photo quality, sources, and attribution documentation
  - Updated `docs/api-setup.md` with Google Places API setup instructions
  - Documented cost analysis (~$15/year, within free tier)
  - Explained 5-tier fallback hierarchy

**Results:**

- 76 venues processed (66 active, 10 legacy)
- 73 venues (96%) have real photos
- 3 venues use fallback images
- API costs: $4.26 initial, ~$15/year ongoing
- venues-metadata.json: 62KB with full venue details
- venue-photos-cache.json: 14KB API response cache

**Remaining Work (Context Window 5 - Frontend Integration):**

- [ ] Load venues-metadata.json in Scene3Map.tsx
- [ ] Update marker popups to show venue photos
- [ ] Display legacy venue badges (Closed/Demolished)
- [ ] Create normalizeVenueName utility function
- [ ] Add TypeScript interface for VenueMetadata
- [ ] Test on desktop and mobile
- [ ] Update README.md with new feature

**Files Created:**

- `scripts/export-venues.ts` - Venue extraction script
- `scripts/utils/google-places-client.ts` - Places API client
- `scripts/enrich-venues.ts` - Main enrichment script
- `scripts/review-venue-photos.ts` - Photo review tool
- `data/venue-status.csv` - Manual venue classifications
- `public/data/venues-metadata.json` - Enriched venue data
- `public/data/venue-photos-cache.json` - API response cache
- `public/images/venues/fallback-active.jpg` - Active venue fallback
- `public/images/venues/fallback.jpg` - Legacy venue fallback
- `public/images/venues/{venue}-1.jpg` - 8 manual photos
- `docs/specs/NEXT_CONTEXT_WINDOW.md` - Frontend integration plan

**Next Session:** Focus on Scene3Map.tsx frontend integration (Context Window 5)

### v1.3.0+ Future

See [docs/specs/future/](specs/future/) for complete specifications:

1. **Phone Optimization** ([mobile-optimization.md](specs/future/mobile-optimization.md)) - Bottom sheets, smaller viewport refinements (<768px)
2. **Spotify Artist Integration** ([spotify-artist-integration.md](specs/future/spotify-artist-integration.md)) - Album art, gatefold mini-player, 30s previews
3. **Timeline Artist Display** ([timeline-artist-display-enhancement.md](specs/future/timeline-artist-display-enhancement.md)) - Rich artist modals on timeline
4. **Google Sheets Phase 2** ([google-sheets-data-integration.md](specs/future/google-sheets-data-integration.md)) - Webhook automation (Google Apps Script → GitHub Action)
5. **Genre Scene Opener Inclusion** ([genre-scene-opener-inclusion.md](specs/future/genre-scene-opener-inclusion.md)) - Include opener appearances (under review)
6. **Venue Cross-Navigation** ([venue-cross-navigation.md](specs/future/venue-cross-navigation.md)) - Map popup → Venue scene linking
7. **Visual Testing Suite** ([visual-testing-suite.md](specs/future/visual-testing-suite.md)) - Automated screenshot testing
8. **Timeline Wake Effect** ([timeline-wake-effect-spec.md](specs/future/timeline-wake-effect-spec.md)) - Interactive cursor wake effect

---

## Quick Overview

Interactive Jamstack SPA showcasing 175+ concerts (1984-2026) through 5 full-viewport scrolling scenes with D3.js visualizations, Leaflet maps, and Framer Motion animations.

**Live Production:** https://concerts.morperhaus.org
**Development:** `npm run dev`
**Build:** `npm run build`
**Repository:** https://github.com/mmorper/concerts

---

## v1.0.0 Implementation Status

### ✅ Completed Phases (0-5)

All major implementation phases are complete:
- **Phase 0:** Project infrastructure (git, docs, .claude config)
- **Phase 1:** Foundation (Vite, React, TypeScript, Tailwind)
- **Phase 2:** Data pipeline (Google Sheets API, enrichment scripts)
- **Phase 3:** Core features (filters, timeline, search)
- **Phase 4:** Map integration (Leaflet, clustering, sync)
- **Phase 5:** Polish (Framer Motion, scrolling scenes, D3.js visualizations, sunburst sizing, 270° artist arc)

### 🔄 Phase 6: Design Conformance (In Progress)

**Completed Items:**

- ✅ Typography updated to Playfair Display (titles) + Source Sans 3 (body)
- ✅ Genre color constants created ([src/constants/colors.ts](../src/constants/colors.ts))
- ✅ Color palette applied throughout (using getGenreColor function)
- ✅ Scene-specific backgrounds implemented
- ✅ Consistent animation timing (Framer Motion 0.8-1.2s transitions)

**Remaining Items:**

- ⚠️ Scene background rhythm - Currently LIGHT→DARK→DARK→DARK→DARK, target is LIGHT→DARK→DARK→LIGHT→LIGHT
  - Scene 1 (Hero): ✅ LIGHT (`bg-white`)
  - Scene 2 (Artists): ❌ DARK (should be LIGHT) - `from-indigo-950 to-purple-950`
  - Scene 3 (Map): ✅ DARK (`bg-gray-900`)
  - Scene 4 (Venue Network): ✅ DARK (`from-indigo-950 to-purple-950`)
  - Scene 5 (Genres): ⚠️ Light violet (`#ede9fe`) but could be lighter for contrast
- ⚠️ Apply consistent spacing per design guide
- ⚠️ Validate "One Thing" rule per scene

**Recent Bug Fixes (December 28-29, 2025):**

1. ✅ Navigation dots - Fixed scroll tracking to use `.snap-y` container
2. ✅ Scene order - Reordered to Timeline→Bands→Map→Genres→Artists
3. ✅ Venue network - Redesigned as radial hierarchy (venue→headliner→opener)
4. ✅ Map z-index - Fixed header overlay layering (z-20 over z-0 map)
5. ✅ Artist list - Converted Scene2 to show top 20 artists
6. ✅ Sunburst sizing - Updated to `min(85vw, 85vh)` with 800px max
7. ✅ Sunburst artist arc - Implemented 270° arc centered at left (9 o'clock) for drill-down view

### ✅ Phase 7: Geography Scene Enhancement (Complete)

**Completed Items:**

- ✅ Tighter zoom levels: California (zoom 9) and DC (zoom 11)
- ✅ Region-based filtering with state filters
- ✅ Z-index layering fix (UI overlays z-[1000])
- ✅ DC data quality issue resolved:
  - Root cause identified: CSV parser wasn't handling quoted "City, State" fields
  - Installed csv-parse library for proper CSV parsing
  - Added all DC metro area coordinates to mapping (8 cities)
  - Regenerated concerts.json with valid coordinates
  - All 32 DC area concerts now display correctly on map
  - Data quality improvements: 54→34 cities (deduplicated), 305→240 artists (deduplicated)

### ✅ Phase 8: Map Interaction Enhancements (Complete - Desktop)

**Implementation Date:** December 29, 2025

**Completed Items:**

- ✅ **Interactive map exploration mode** - Click-to-activate pattern that preserves scene navigation
  - Two-state system: Locked (default) and Active (exploration mode)
  - Click on map tiles activates exploration mode (markers still show popups without activating)
  - Scroll wheel zoom and drag panning enabled when active
  - ESC key deactivates and returns to locked state
  - Scroll event trapping prevents scene navigation when map is active
  - Reference: [docs/specs/implemented/map-interaction.md](specs/implemented/map-interaction.md)
  - Component: [src/components/scenes/Scene3Map.tsx](../src/components/scenes/Scene3Map.tsx)

- ✅ **Scene navigation buttons** - Contextual exit controls appear when map is active
  - Top button: "↑ The Venues" (navigates to Scene 2 - Bands)
  - Bottom button: "The Music ↓" (navigates to Scene 4 - Genres)
  - Styled with semi-transparent pills, backdrop blur, smooth animations
  - Buttons sized for touch (44px min-height)
  - AnimatePresence for smooth enter/exit transitions

- ✅ **Visual feedback and hints**
  - "Click to explore map" hint appears after 1s delay, fades out after 3s
  - Hint also disappears when user activates the map
  - Zoom bounds enforced: min 4 (continental), max 16 (street-level)

- ✅ **Accessibility support**
  - Dynamic aria-label on section describes current state
  - aria-live region announces "Map exploration mode activated" to screen readers
  - ESC key support for keyboard users
  - Scene nav buttons have proper aria-labels

- ✅ **California venue popups** - Now show venue names like DC region
  - Changed aggregation logic to show venues for both CA and DC regions
  - Popup format: Venue name (large) + city/state (small gray text)

- ✅ **Genres scene centering fix** - Donut chart now properly centered on initial load
  - Changed container from `absolute inset-0` to `w-full h-full`
  - Component: [src/components/scenes/Scene5Genres.tsx](../src/components/scenes/Scene5Genres.tsx)

### ✅ Phase 9: Venue-Level Geocoding (Complete)

**Completed Items:**

- ✅ Google Maps Geocoding API integration with cache-first approach
- ✅ Created `scripts/services/geocoding.ts` - Core geocoding service module
- ✅ Created `scripts/geocode-venues.ts` - Manual batch geocoding script
- ✅ Integrated into `scripts/convert-csv-to-json.ts` data pipeline
- ✅ Added `dotenv` package and environment variable loading
- ✅ Documented Google Maps API setup in [docs/api-setup.md](api-setup.md)
- ✅ Created persistent cache at `public/data/geocode-cache.json`
- ✅ Geocoded 77 unique venues with accurate coordinates
- ✅ DC map adjustments: center [39.00, -77.03], zoom 10.5
- ✅ Popup z-index fix: custom pane with z-index 9999
- ✅ Cost optimization: $0.00 (within $200/month free tier)

**Technical Implementation:**

- **Geocoding Strategy**: "{venue}, {city}, {state}" format using Google Maps venue recognition
- **Fallback Chain**: Venue-specific geocoding → City-level static → Zero coordinates
- **Cache Structure**: `{venue}|{city}|{state}` as key, with lat/lng/formattedAddress/geocodedAt
- **Rate Limiting**: 20ms delay between API calls (50 requests/second limit)
- **API Usage**: Initial run 77 venues × $0.005 = $0.385 (covered by free tier)

**Files Created/Modified:**

- NEW: `scripts/services/geocoding.ts` - Core service with cache management
- NEW: `scripts/geocode-venues.ts` - Batch script for manual geocoding
- NEW: `.env` - Google Maps API key storage
- NEW: `public/data/geocode-cache.json` - Persistent coordinate cache (77 venues)
- MODIFIED: `scripts/convert-csv-to-json.ts` - Made async, integrated geocoding
- MODIFIED: `package.json` - Added dotenv dependency and "geocode" script
- MODIFIED: `docs/api-setup.md` - Added Google Maps Geocoding API section
- MODIFIED: `src/components/scenes/Scene3Map.tsx` - DC zoom/center and popup z-index

**Post-Implementation Cleanup:**

- ✅ Removed jitter logic from Scene3Map.tsx - no longer needed with venue-specific coordinates

### ✅ Phase 9b: Venue Scene Enhancement (Complete)

**Implementation Date:** December 29, 2025

**Completed Items:**

- ✅ **Click-to-expand interaction in "All" view** - Venue dots animate to center and expand children
  - Clicking a venue dot in All view now moves it to horizontal center at y=380 (below exclusion zone)
  - Smooth physics-based animation using D3 force simulation
  - Child nodes (headliners and openers) automatically expand radially around centered venue
  - Headliners positioned at 120px radius, openers at 180px radius from centered venue
  - All child node labels become visible when venue is expanded
  - Click again to collapse back to dot and return to original position
  - Component: [src/components/scenes/Scene4Bands.tsx](../src/components/scenes/Scene4Bands.tsx)
  - Reference: [docs/specs/implemented/venue-scene.md](specs/implemented/venue-scene.md)

- ✅ **Removed fade effects** - Eliminated screen-wide dimming on node clicks
  - All nodes maintain constant opacity (0.85 fill, 1.0 stroke)
  - Links maintain constant opacity (0.5 hierarchy, 0.3 cross-venue)
  - No more ghosting or fading of unrelated nodes when clicking
  - Hover effects simplified to work uniformly for all nodes
  - Cleaner, less distracting visual experience

**Technical Implementation:**

- **Positioning Forces**: Added `centerVenue` and `centerVenueY` forces with 1.0 strength for decisive movement
- **Radial Layout**: Updated radial force to center children around y=380 when venue is centered
- **Label Display**: Modified band label filter to show labels for expanded venues in "all" mode
- **State Management**: Uses `expandedVenues` Set and `centeredVenue` string to track expansion state
- **Exclusion Zone**: Positioned venue at y=380, just below the exclusion zone boundary (ends at y=360)

**Files Modified:**

- MODIFIED: `src/components/scenes/Scene4Bands.tsx` - Click interaction, force simulation, and label visibility

### ✅ Phase 10: Artists Scene Gatefold Animation (Complete - Desktop)

**Implementation Date:** December 30, 2025

**Completed Items:**

- ✅ **Artist mosaic grid layout** - Album cover mosaic with uniform 200px cards
  - Flexbox-based responsive grid that centers horizontally
  - Lazy loading with Intersection Observer (100 initial, batch 50)
  - Three sort modes: A-Z (alphabetical), Genre, Weighted (by times seen)
  - Frequency badges show ×N for artists seen multiple times (Weighted mode only)
  - Component: [src/components/scenes/ArtistScene/](../src/components/scenes/ArtistScene/)

- ✅ **Gatefold animation** - Vinyl album-inspired opening interaction
  - **Flying tile animation**: Clicked tile flies from grid to center of viewport (500ms)
  - **Book-opening effect**: Tile becomes album cover that swings open hinged on LEFT edge (800ms)
  - **V-angle "vinyl on lap" tilt**: Both panels tilt ±15° with spine as lowest point
  - **Two 400×400px panels** side-by-side with 12px spine = 812px total width
  - Pure CSS transitions (more performant than Framer Motion for complex 3D transforms)
  - ESC key or click anywhere to close
  - Reduced motion support (skips animations, maintains layout)
  - Reference: [docs/specs/implemented/artist-scene.md](specs/implemented/artist-scene.md)
  - Prototype: [docs/specs/archive/prototypes/gatefold-centered.html](specs/archive/prototypes/gatefold-centered.html)

- ✅ **Left panel (Concert History)** - Dark gradient background with artist info
  - Background: `linear-gradient(145deg, #181818 0%, #121212 100%)`
  - 100×100px genre-colored album art placeholder with initials
  - Artist name (Playfair Display, 1.875rem) + genre/show count
  - Scrollable concert list with dates (tabular-nums) and venues
  - Spotify green section labels (#1DB954)
  - White text on dark background

- ✅ **Right panel (Spotify Player)** - Phase 1 "Coming Soon" skeleton
  - Same dark gradient background as left panel
  - Spotify icon with "Top Tracks" label
  - Muted play button (50% opacity)
  - 4 skeleton track rows with genre-colored placeholders
  - "Spotify Integration Coming Soon" messaging
  - Skeleton bars (#2a2a2a) for track names/artists

**Remaining Items:**

- ⚠️ **Mobile bottom sheet** - For viewports <768px (v1.1 deferred)
  - Slide-up sheet instead of gatefold (no flying animation)
  - 70vh initial height, draggable to 90vh
  - Swipe down or tap backdrop to close
  - Concert history + Spotify stacked vertically
  - Reference: [docs/specs/implemented/artist-scene.md](specs/implemented/artist-scene.md) (Mobile Design section)

- ⚠️ **Spotify integration** - Connect to Spotify API (v1.1 deferred)
  - Album cover images from Spotify API
  - Artist profile links and top tracks
  - 30-second preview playback
  - Replace skeleton with live data
  - See: [docs/specs/future/spotify-enrichment-runbook.md](specs/future/spotify-enrichment-runbook.md)

- ⚠️ **Scene background** - Change from DARK to LIGHT
  - Current: `from-indigo-950 to-purple-950` (DARK)
  - Target: Light background for LIGHT→DARK→DARK→LIGHT→LIGHT rhythm

**Technical Implementation:**

- **Animation Strategy**: Pure CSS transitions with JavaScript positioning
  - `perspective: 2000px` on overlay for 3D depth
  - Cover hinged on left edge: `transform-origin: left center`
  - Cover opens: `rotateY(-165deg)` = -180° flip + 15° V-angle
  - Right panel tilts: `rotateY(-15deg)` for matching V-angle
  - Timing: cubic-bezier(0.4, 0, 0.2, 1) for smooth easing

- **Positioning Logic**: Dynamic centering calculations
  - Closed position: Center 400×400px cover in viewport
  - Open position: Center full 812px gatefold, accounting for cover swing
  - Flying tile tracks getBoundingClientRect() of clicked tile
  - Window resize handler repositions gatefold if open

- **State Management**:
  - `openArtist` tracks which artist gatefold is open (null when closed)
  - `clickedTileRect` stores original tile position for return animation
  - Original tile hidden (visibility: hidden) while gatefold is open
  - Grid dimmed (opacity: 0.3, blur: 6px) when gatefold active

- **Z-Index Layering Fix** (Critical):
  - **Problem**: Gatefold was trapped in stacking context created by motion.div with transforms
  - **Solution**: Lifted gatefold rendering to scene level (ArtistScene.tsx) outside motion.div containers
  - **Z-Index Values**: Gatefold overlay (99998), Flying tile (99999), Close hint (100000)
  - **Result**: Gatefold now properly appears above all scene elements including header buttons

**Files Created/Modified:**

- NEW: `src/components/scenes/ArtistScene/ArtistGatefold.tsx` - Main gatefold overlay with animations
- NEW: `src/components/scenes/ArtistScene/ConcertHistoryPanel.tsx` - Left panel (dark theme)
- NEW: `src/components/scenes/ArtistScene/SpotifyPanel.tsx` - Right panel (skeleton state)
- MODIFIED: `src/components/scenes/ArtistScene/ArtistScene.tsx` - Lifted gatefold state, renders gatefold at scene level
- MODIFIED: `src/components/scenes/ArtistScene/ArtistCard.tsx` - Simplified to clickable tile
- MODIFIED: `src/components/scenes/ArtistScene/ArtistMosaic.tsx` - Removed gatefold state, accepts callbacks
- MODIFIED: `src/index.css` - Added 3D transform utility classes
- Complete artist scene component tree:
  - `ArtistScene.tsx` - Main container with sort controls and gatefold state
  - `ArtistMosaic.tsx` - Grid layout with lazy loading
  - `ArtistCard.tsx` - Clickable tile that triggers gatefold
  - `ArtistCardFront.tsx` - Album cover display
  - `ArtistCardBack.tsx` - Concert history list (deprecated - replaced by gatefold)
  - `ArtistPlaceholder.tsx` - Colored placeholder for missing covers
  - `ArtistGatefold.tsx` - Overlay with flying tile and 3D animation
  - `ConcertHistoryPanel.tsx` - Left gatefold panel
  - `SpotifyPanel.tsx` - Right gatefold panel
  - `useArtistData.ts` - Data processing and sorting
  - `types.ts` - TypeScript interfaces

### ✅ Phase 11: Production Deployment (Complete)

**Implementation Date:** January 1, 2026

**Completed Items:**

- ✅ **Cloudflare Pages setup** - Repository connected to GitHub
- ✅ **Custom domain configuration** - concerts.morperhaus.org live
- ✅ **Build optimization** - Automatic deployments on push to main
- ✅ **DNS configuration** - Custom domain with SSL certificate
- ✅ **v1.0.0 GitHub release** - "🎸 The Grand Opening - Live at concerts.morperhaus.org"
- ✅ **Production validation** - All 5 scenes functional in production

### 📋 Phase 12: Post-Launch Enhancements (Active)

**Implementation Period:** January 2026+

**Completed Items:**

- ✅ **Custom favicon implementation** - Concert ticket stub design in brand colors
- ✅ **Geography Scene marker fixes** - Individual venue markers visible when zoomed
- ✅ **Boston venue verification** - Paradise Rock Club and MGM Music Hall geocoded
- ✅ **API documentation cleanup** - Removed unused Last.fm and TheAudioDB references
- ✅ **Claude Code configuration** - Removed .claude/ from git tracking

**Active Planning:**

- 📋 **Future enhancement specifications** - Timeline artist display, genre opener inclusion
- 📋 **Mobile optimization roadmap** - iPad support requirements added
- 📋 **Documentation maintenance** - STATUS.md updates for production state

---

## v1.1.0 Completed

**Status:** Complete (2025-12-31)
**GitHub Release:** v1.1.0

**iPad Optimization:**
- ✅ All scenes functional on iPad (landscape & portrait)
- ✅ 44px minimum touch targets throughout
- ✅ Timeline portrait mode load bug fixed
- ✅ Venues scene persistent re-centering bug fixed
- ✅ Build version tracking system added
- ✅ Version display in footer

## v1.2.0 Complete (Data Pipeline Enhancement)

**Status:** Complete (2026-01-01)
**Focus:** Improve data pipeline reliability, validation, and automation

**Delivered:**

1. ✅ **Google Sheets Phase 1 Core** - Build-time integration (OAuth 2.0, fetch, geocode)
2. ✅ **Enhancement 1.1: Validation** - `npm run validate-data` with 8 checks
3. ✅ **Enhancement 1.2: Logging** - Detailed statistics and formatted output
4. ✅ **Enhancement 1.3: Diff Reports** - `npm run diff-data` for change tracking
5. ✅ **Complete Documentation** - User guide ([DATA_PIPELINE.md](DATA_PIPELINE.md)) and implementation notes
6. 📝 **Phase 2 (Webhook Automation)** - Out of scope for v1.2.0, spec'd for future

**New Commands:**
- `npm run build-data` - Fetch + validate + enrich
- `npm run validate-data` - Pre-commit data quality checks
- `npm run diff-data` - Compare data changes

See [specs/implemented/google-sheets-phase1-implementation.md](specs/implemented/google-sheets-phase1-implementation.md) for implementation details.

---

## v1.3.0+ Roadmap (User Experience Enhancements)

Planned feature enhancements with detailed specifications in [docs/specs/future/](specs/future/):

### 1. Google Sheets Data Integration

**Status:** Phase 1 Complete ✅, Phase 2 Planned for Future
**Spec:** [Google Sheets Data Integration](specs/future/google-sheets-data-integration.md)
**Implementation:** [Phase 1 Implementation Details](specs/implemented/google-sheets-phase1-implementation.md)
**User Guide:** [DATA_PIPELINE.md](DATA_PIPELINE.md)

**Phase 1 Complete (v1.2.0):**

- ✅ Build-time data fetching from Google Sheets (OAuth 2.0)
- ✅ Cached fallback strategy with committed JSON files
- ✅ Pre-build validation with error/warning classification
- ✅ Detailed logging with statistics and formatted output
- ✅ Change comparison (diff reports)
- ✅ Complete documentation

**Phase 2 (Future):**
- Webhook automation (Google Apps Script → GitHub Action → auto-deploy)
- See spec for details

**Prerequisites:** Google Sheets API and OAuth 2.0 setup (see [api-setup.md](api-setup.md))

**Related:**

- [api-setup.md](api-setup.md) — Complete API credential configuration
- [BUILD.md](BUILD.md) — Build process and deployment workflow

### 2. Phone Optimization (v1.3.0+)

**Status:** Planned
**Spec:** [Mobile Optimization](specs/future/mobile-optimization.md)

**Scope:**

- Artist scene: Bottom sheet instead of gatefold (<768px viewports)
- Map scene: Further touch refinements for small screens
- General: Phone-specific gesture indicators, responsive improvements

### 3. Timeline Artist Display Enhancement (v1.3.0+)

**Status:** Planned
**Spec:** [Timeline Artist Display Enhancement](specs/future/timeline-artist-display-enhancement.md)

**Scope:**

- Rich artist modals on timeline dot clicks
- Artist photos, biography, genre evolution
- Full concert history for selected artist

### 4. Spotify Artist Integration (v1.3.0+)

**Status:** Planned
**Spec:** [Spotify Artist Integration](specs/future/spotify-artist-integration.md)

**Scope:**

- Album cover art on Artist Scene card fronts
- Gatefold right panel: mini-player with 30-second previews
- Top tracks display with play/pause controls
- Build-time Spotify API enrichment (no runtime calls)
- Graceful fallbacks (no album → single → artist image → placeholder)

**Prerequisites:** Gatefold animation (✅ complete)

**Related:**

- [spotify-enrichment-runbook.md](specs/future/spotify-enrichment-runbook.md) — Enrichment script runbook
- [mobile-optimization.md](specs/future/mobile-optimization.md) — Mobile bottom sheet layout

### 4.5. Venue Photos Integration (v1.3.2)

**Status:** Planned
**Spec:** [Venue Photos Integration](specs/future/venue-photos-integration.md)

**Scope:**

- Google Places API integration for venue photos
- Three-tier fallback: Places API → Manual curation → No photo
- Handle legacy venues (closed/demolished) with manual photo curation
- venues-metadata.json with photos, stats, and concert references
- Display venue photos in Map (popups) and Venue Network (detail modals)
- Cache-first approach with 90-day TTL
- ~$15/year API costs (within $200/month free tier)

**Prerequisites:** None (can run independently)

**Related:**

- [data-normalization-architecture.md](specs/future/data-normalization-architecture.md) — Parent architecture spec
- [api-setup.md](api-setup.md) — API credentials setup

### 5. Genre Scene Opener Inclusion (v1.3.0+)

**Status:** Under Review
**Spec:** [Genre Scene Opener Inclusion](specs/future/genre-scene-opener-inclusion.md)

**Scope:**

- Include opener band appearances in genre chart
- Adjustable weighting (headliner vs opener)
- Updated data model to track performance types

### 6. Venue Cross-Navigation (v1.3.0+)

**Status:** Planned
**Spec:** [Venue Cross-Navigation](specs/future/venue-cross-navigation.md)

**Scope:**
- Map popup → Venue scene linking
- Smooth transitions between scenes
- Venue focus and expansion on arrival

### 7. Visual Testing Suite (v1.3.0+)

**Status:** Planned
**Spec:** [Visual Testing Suite](specs/future/visual-testing-suite.md)

**Scope:**
- Automated screenshot testing
- Visual regression detection
- Scene rendering validation

### 8. Timeline Wake Effect (v1.3.0+)

**Status:** Future
**Spec:** [Timeline Wake Effect](specs/future/timeline-wake-effect-spec.md) | [Prototype](specs/future/timeline-wake-effect-poc.html)

**Scope:**
- Interactive wake effect for Timeline scene (Scene1Hero)
- Cursor movement spawns concert labels (artists up, venues down)
- Physics-based Bezier curve arcs trailing backward
- Velocity-responsive: fast cursor = dramatic curves, slow = gentle arcs
- Sequential chronological spawning within each year

### Additional Enhancements

**Design Polish (Optional):**
- Scene background rhythm alignment (current: LIGHT→DARK→DARK→LIGHT→DARK)
- Consistent spacing per design guide

**Infrastructure & Security (Nice to Have):**
- Security headers via Cloudflare Pages `_headers` file
- Content-Security-Policy, X-Frame-Options, X-Content-Type-Options
- Referrer-Policy, Permissions-Policy


---

## Architecture

### 5 Full-Viewport Scenes

**Scene Flow:** Timeline → Venue Network → Map → Genres → Artists

| Scene | Component | Technology | Purpose |
|-------|-----------|------------|---------|
| **1. Timeline** | Scene1Hero.tsx | D3.js | Interactive timeline with year dots sized by concert count |
| **2. Venue Network** | Scene4Bands.tsx | D3.js force simulation | Radial hierarchy: venues→headliners→openers |
| **3. Map** | Scene3Map.tsx | Leaflet + React Leaflet | Dark monochromatic map with region filters |
| **4. Genres** | Scene5Genres.tsx | D3.js sunburst | Hierarchical genre chart with drill-down zoom, 270° artist arc |
| **5. Artists** | Scene2Venues.tsx | Framer Motion | Top 20 artists in 4-column grid |

### Tech Stack

**Core:**
- Vite 6.0.7
- React 18.3.1
- TypeScript 5.7.2
- Tailwind CSS 4.1.18

**Visualization & Animation:**
- D3.js 7.9.0 (timeline, force graph, sunburst)
- Framer Motion 11.18.2 (scroll animations, parallax)
- React Leaflet 4.2.1 (map integration)
- Leaflet 1.9.4 (mapping library)

**Data:**
- 175 concerts (1984-2026, 42 years)
- 305 unique artists
- Top venues: Irvine Meadows (14x), Pacific Amphitheatre (12x)
- Top genres: New Wave (46), Punk (15), Alternative (14)
- Geographic: California ~65%, DC cluster, Boston, New Orleans, UK

---

## Documentation

### Core Documents

| Document | Purpose |
|----------|---------|
| [STATUS.md](STATUS.md) | Current state, active work (source of truth) |
| [planning.md](planning.md) | Historical implementation plan (archive) |
| [api-setup.md](api-setup.md) | Google Sheets, Maps, and music API configuration |

### Design System

| Document | Purpose |
|----------|---------|
| [Scene Design Guide](design/scene-design-guide.md) | Scene flow, typography, spacing, animation |
| [Color Specification](design/color-specification.md) | Genre colors, backgrounds, CSS variables |

### Feature Specs

**Implemented (v1.0):**

- [Artist Scene](specs/implemented/artist-scene.md) - Gatefold animation, mosaic grid
- [Map Interaction](specs/implemented/map-interaction.md) - Click-to-explore, navigation
- [Venue Scene](specs/implemented/venue-scene.md) - Click-to-expand, force layout

**Future (v1.1+):**

- [Mobile Optimization](specs/future/mobile-optimization.md) - Touch refinements, iPad support
- [Timeline Artist Display Enhancement](specs/future/timeline-artist-display-enhancement.md) - Rich artist modals
- [Genre Scene Opener Inclusion](specs/future/genre-scene-opener-inclusion.md) - Include opener appearances (under review)
- [Spotify Enrichment Runbook](specs/future/spotify-enrichment-runbook.md) - API setup and data enrichment
- [Venue Cross-Navigation](specs/future/venue-cross-navigation.md) - Map→Venue linking
- [Visual Testing Suite](specs/future/visual-testing-suite.md) - Automated testing

**Archive:**

- [specs/archive/](specs/archive/) - Superseded specs and prototypes

---

## Project Structure

```
concerts/
├── src/
│   ├── components/
│   │   ├── scenes/          # 5 full-viewport scenes
│   │   │   ├── Scene1Hero.tsx
│   │   │   ├── Scene2Venues.tsx
│   │   │   ├── Scene3Map.tsx
│   │   │   ├── Scene4Bands.tsx
│   │   │   └── Scene5Genres.tsx
│   │   └── SceneNavigation.tsx  # Dot navigation
│   ├── types/
│   │   └── concert.ts       # TypeScript interfaces
│   └── App.tsx              # Main app with snap scroll
├── public/data/
│   └── concerts.json        # Static concert data (175 concerts)
├── docs/
│   ├── STATUS.md           # This file (current state)
│   ├── planning.md         # Complete historical implementation plan
│   ├── api-setup.md        # API configuration guide
│   ├── design/             # Visual design framework
│   │   ├── scene-design-guide.md
│   │   └── color-specification.md
│   └── specs/
│       ├── implemented/    # v1.0 feature specs
│       ├── future/         # v1.1+ roadmap
│       └── archive/        # Superseded specs
└── .claude/
    ├── config.json         # Project metadata & phase tracking
    └── context.md          # Quick-start context for new sessions
```

---

## Key Features

### Scroll-Based Navigation
- Full-viewport scenes (100vh) with snap scrolling
- Framer Motion scroll-triggered animations
- Dot navigation on right side (desktop)
- Smooth scroll between scenes

### D3.js Visualizations
1. **Timeline (Scene 1):** Year dots sized by concert density
2. **Venue Network (Scene 4):** Radial force layout showing venue→artist relationships
3. **Genre Sunburst (Scene 5):** Hierarchical chart with click-to-zoom, 270° artist arc in drill-down view

### Leaflet Map (Scene 3)
- Dark CartoDB tile layer
- Circle markers sized by concert count
- Region filters: All, California, DC Area, Boston
- Static map (no scroll hijacking)

### Design System

**Framework Documents:**

- [Scene Design Guide](design/scene-design-guide.md) - Scene flow, typography, spacing, animation
- [Color Specification Guide](design/color-specification.md) - Genre colors, backgrounds, CSS variables

**Current Implementation:**

- Typography: Inter font family (to be updated to Playfair Display + Source Sans 3)
- Scene backgrounds: Custom per scene (to be aligned with LIGHT→DARK→DARK→LIGHT→LIGHT rhythm)
- Animations: Framer Motion with 0.8-1.2s transitions

---

## Build Status

**Latest Build:** ✅ Successful
**TypeScript:** ✅ Strict mode passing
**Bundle Size:** 516.97 kB JS (gzipped: 163.76 kB), 61.36 kB CSS (gzipped: 14.30 kB)

---

## Documentation Maintenance

### Source of Truth Hierarchy

1. **`docs/STATUS.md`** (this file) - Current state, active work, pending tasks
2. **`docs/planning.md`** - Complete historical implementation plan (all phases)
3. **`.claude/context.md`** - Quick-start context synced from STATUS.md

### Context Sync Policy

`.claude/context.md` must be refreshed:
- ✅ With each commit and push (user preference)
- ✅ At start of each major phase
- ✅ After significant architectural changes
- ✅ When context drifts >5 bugs/features

**Sync Process:**
1. Read current state from `docs/STATUS.md`
2. Update `.claude/context.md` with: current phase, recent work, pending tasks, last commit
3. Keep context.md concise (<2000 tokens)

---

## Quick Reference

### Development Commands

```bash
npm run dev          # Start development server (Vite)
npm run build        # Production build
npm run preview      # Preview production build
npm run build-data   # Fetch & enrich concert data from Google Sheets
```

### Key Files to Know

- **[src/App.tsx](../src/App.tsx)** - Main app with 5 scenes and snap scroll
- **[src/components/SceneNavigation.tsx](../src/components/SceneNavigation.tsx)** - Dot navigation
- **[public/data/concerts.json](../public/data/concerts.json)** - Concert data (175 records)
- **[docs/planning.md](planning.md)** - Full implementation history
- **[docs/api-setup.md](api-setup.md)** - Google Sheets & music API setup

### Scene Background Colors

For visual reference (actual order):

- Scene 1 (Timeline): `bg-white` - LIGHT
- Scene 2 (Venue Network): `from-indigo-950 to-purple-950` - DARK
- Scene 3 (Map): `bg-gray-900` - DARK
- Scene 4 (Genres): `#ede9fe` (light violet) - LIGHT
- Scene 5 (Artists): `from-indigo-950 to-purple-950` - DARK (should be LIGHT)

---

## Recent Commits (v1.1.0+)

- `2619946` - feat: Implement v1.1.0 iPad optimization and version tracking
- `b822de6` - docs: Add Timeline Wake Effect spec and update mobile optimization
- `7d3dfc0` - docs: Update documentation structure to v1.0.0 production state
- `f3a5554` - docs: Update STATUS.md to reflect v1.0.0 production state
- `9b541af` - docs: Add iPad support requirements to mobile optimization spec
- `607a80f` - docs: Add genre scene opener inclusion enhancement specification
- `1b474c6` - feat: Add custom concert ticket stub favicon
- `78bf3cd` - fix: Show individual venue markers in all Geography Scene regions

---

## Support Resources

- **GitHub Issues:** https://github.com/mmorper/concerts/issues
- **Historical Planning:** [docs/planning.md](planning.md)
- **API Setup:** [docs/api-setup.md](api-setup.md)
- **README:** [../README.md](../README.md)
