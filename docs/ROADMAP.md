# Roadmap

## Current State (v3.8.1)

- **179 concerts** spanning 1984-2026
- **254 artists** (including openers)
- **77 unique venues** across 35 cities
- **5 interactive scenes**: Timeline, Venues, Geography, Genres, Artists
- **Latest improvements**: AI Fact Cards for Liner Notes with pre-computed statistics

---

## Recently Completed

### ✅ AI Fact Cards for Liner Notes (v3.7.0)

**Status**: Completed
**Spec**: [global-ai-fact-cards.md](specs/implemented/global-ai-fact-cards.md)

Pre-computed statistics displayed on /liner-notes with deep links, improving AI agent discoverability.

**Implemented Features**:

- 15 computed facts (top artists, top venues, total concerts, busiest year, etc.)
- "By the Numbers" section on /liner-notes displaying 12 fact cards
- Deep links for each fact to explore that data point
- lucide-react icons for fact categories (artist, venue, genre, timeline, geography)
- Human-friendly detail text designed to be directly quotable by AI agents
- RSS feed includes facts summary with computedAt date
- llm.txt "Pre-Computed Statistics" section with categorized facts
- 20 Vitest tests covering fact generation and validation

---

### ✅ Artist Discography Data Pipeline (v3.5.0)

**Status**: Completed
**Spec**: [artists-discography.md](specs/future/artists-discography.md)

Comprehensive artist discography enrichment using MusicBrainz API to fetch album data for all 247 artists.

**Implemented Features**:

- MusicBrainz API client with rate limiting (1 req/sec) and fuzzy artist matching
- Discography enrichment script with 90-day caching
- Integration into `npm run build-data` pipeline as Step 7
- Validation checks for discography completeness and data quality
- Generated 2.5MB discography.json with 15,000+ albums
- Support for album filtering by type (studio, live, compilation, EP)
- Prepared data structure for future UI integration in Artist Scene (v3.6.0+)

---

### ✅ Venue Cross-Scene Navigation (v3.3.0)

**Status**: Completed
**Spec**: [venues-deep-linking.md](specs/implemented/venues-deep-linking.md)

Seamless cross-scene navigation with venue+artist combined deep linking.

**Implemented Features**:

- Clickable venue names in Artist gatefold concert history
- Clickable venue names in Phone Artist Modal
- Venue+artist combined deep linking focuses both nodes in force-directed graph
- "Explore Venue" buttons use real links for better mobile UX
- Hyperlinks in gatefold content with proper navigation

---

### ✅ Venues Mobile UX (v3.3.0)

**Status**: Completed
**Spec**: [venues-mobile-ux.md](specs/implemented/venues-mobile-ux.md)

Mobile UX improvements for Venues scene including enhanced label visibility and touch interactions.

**Implemented Features**:

- Enhanced venue label visibility in force-directed graph
- Improved label opacity logic matching spotlight state
- Real link navigation for cross-scene venue exploration
- Touch-optimized venue node interactions

---

### ✅ Phone Artist Modal (v3.2.0)

**Status**: Completed
**Spec**: [artists-phone-modal.md](specs/implemented/artists-phone-modal.md)

Phone-specific modal for Artist Scene using mobile-native patterns instead of the desktop gatefold.

**Implemented Features**:

- Full-screen modal with tabbed navigation (History, Upcoming, Top Tracks)
- Swipe-down and X to dismiss
- Setlist overlay slides from right with swipe gestures
- Color-coded tabs with brand accents (violet, amber, Spotify green)
- On Tour badge with tap-to-navigate to Upcoming tab
- Deep link copy button with haptic feedback

---

### ✅ iPad Touch Support for Timeline (v3.1.0)

**Status**: Completed
**Spec**: [timeline-ipad-touch-support.md](specs/implemented/timeline-ipad-touch-support.md)

Touch-optimized interactions for exploring timeline year cards on iPad and tablets.

**Implemented Features**:

- Drag finger across timeline cards to preview concerts
- Tap-to-navigate pattern with haptic feedback
- Smart tap vs. drag detection (10px movement threshold)
- Proper touch event handling without bubbling conflicts
- Focus state persistence across interactions

---

### ✅ Interactive Timeline Exploration & Genre Journey (v3.0.0)

**Status**: Completed
**Spec**: [timeline-year-filter-spec.md](specs/implemented/timeline-year-filter-spec.md), [genre-scene-treemap-timeline-spec.md](specs/implemented/genre-scene-treemap-timeline-spec.md)

Interactive year filtering on timeline with card stack UI and animated genre treemap visualization.

**Implemented Features**:

- Click any timeline dot to see all concerts from that year
- Interactive year cards with one-tap navigation to artist details
- Animated genre treemap showing musical evolution over time
- Genre drill-down to explore artists within each style
- Timeline slider with milestone markers for genre scene
- Mobile-optimized touch interactions with haptic feedback

---

### ✅ Upcoming Tour Dates (v2.0.0)

**Status**: Completed
**Spec**: [upcoming-tour-dates.md](specs/implemented/upcoming-tour-dates.md)

Real-time tour dates with direct ticket purchase links using Ticketmaster Discovery API.

**Implemented Features**:

- Fetch upcoming tour dates for artists via Ticketmaster API
- "ON TOUR" badge in artist gatefold when dates available
- Sliding tour dates panel matching setlist design
- Direct ticket purchase links for each show
- 24-hour client-side caching with smart fallbacks
- Elegant empty state when no tours scheduled

---

### ✅ Artist Genre Enrichment (v3.0.1)

**Status**: Completed
**Spec**: [artist-genre-enrichment.md](specs/implemented/artist-genre-enrichment.md)

Genre moved to artist-level metadata with automatic enrichment from TheAudioDB.

**Implemented Features**:

- Genre as canonical artist attribute in `data/artist-metadata.json`
- Build pipeline enriches concerts with artist genres
- Validation tools for genre consistency
- 247 artists enriched with genre data
- Google Sheet source data no longer requires genre column

---

## Short-Term Roadmap

### Artist Imagery Enrichment - Add Deezer Fallback

**Status**: Planned
**Target Version**: v3.9.0
**Spec**: [global-deezer-artist-imagery.md](specs/future/global-deezer-artist-imagery.md)

Enhance artist enrichment pipeline with Deezer API as third fallback (after TheAudioDB and Last.fm) to fill imagery gaps for artists like Against Me! and Dramarama.

---

### About Page - E-E-A-T Signals

**Status**: Planned
**Spec**: [global-about-page.md](specs/future/global-about-page.md)

Static /about page surfacing creator identity and project backstory for SEO authority signals.

---

### SEO Tool v2 - Integrated Analytics & Backlink Support

**Status**: Planned
**Target Version**: v4.0.0
**Spec**: [global-seo-tool-v2.md](specs/future/global-seo-tool-v2.md)

Transform `/seo` command into comprehensive SEO intelligence platform with real data from Google Search Console, GA4, and optional backlink APIs.

**Key Features**:

- Google Search Console integration (impressions, clicks, CTR, rankings)
- Google Analytics 4 integration (engagement, bounce rate, Core Web Vitals)
- Backlink API scaffolding (Ahrefs + SEMrush support)
- Correlation insights engine (cross-source analysis)
- Portable credential management (env vars, config file, OAuth)
- Multiple output formats (CLI, Markdown, HTML, JSON)

---

### UX Polish

**Status**: In Progress
**Related Specs**:

- [mobile-optimization.md](specs/implemented/mobile-optimization.md)
- [map-popup-z-index.md](specs/future/map-popup-z-index.md)
- [map-renamed-venue-badges.md](specs/future/map-renamed-venue-badges.md)

Refinements to interaction patterns and navigation across the app.

**Remaining Improvements**:

- Improved button states and loading indicators
- Better keyboard navigation support
- Display renamed venues with ♻️ badge and new name

---

## Medium-Term Roadmap

### Artist Discography UI Panel

**Status**: Planned (Data pipeline completed in v3.5.0)
**Spec**: [artists-discography.md](specs/future/artists-discography.md)

Visual discography panel in Artist Scene gatefold showing album covers and release timeline.

**Key Features**:

- Grid layout of album covers (4-5 columns)
- Chronological ordering (newest first)
- Album filtering by type (studio albums, EPs, live, compilations)
- Hover to show album title + year
- Click to link to Spotify album (future integration)
- Fallback for missing cover art
- Data already available in `discography.json` (15k+ albums)

---

### Venue Name Change Detection & CLI Management
**Status**: Planned
**Spec**: [global-venue-name-change-detection.md](specs/future/global-venue-name-change-detection.md)

Automatically detect when venue names change and provide CLI tools to manage venue status updates.

**Key Features**:
- Automatic detection during venue enrichment (compare Google Places name vs data)
- Interactive CLI: `npm run venue-review` to process detected changes
- Manual management: `npm run venue-update` and `npm run venue-add`
- Safe CSV updates with validation and atomic writes
- Guided workflow with next-step recommendations

---

### Spotify Integration & Unified Image Sourcing
**Status**: Blocked (Spotify API not accepting new projects)
**Architecture**: [global-data-normalization-architecture.md](specs/future/global-data-normalization-architecture.md)

**Related Specs**:

- [artists-spotify-integration.md](specs/future/artists-spotify-integration.md) - Feature spec
- [runbook-global-spotify-enrichment.md](specs/future/runbook-global-spotify-enrichment.md) - Operations runbook
- [global-image-sourcing-strategy.md](specs/future/global-image-sourcing-strategy.md) - Image strategy

Consolidate image sourcing with Spotify as primary source, TheAudioDB as fallback.

**Key Goals**:

- Spotify as primary source for artist metadata (genres, images, audio previews)
- TheAudioDB as fallback for artists not on Spotify
- Consistent image quality and sizing across scenes
- Album art and track previews for Artist Scene gatefold

---

### Continued Mobile Optimizations (Gatefold)
**Status**: In Progress
**Spec**: [mobile-optimization.md](specs/future/mobile-optimization.md)

Refine mobile experience for artist gatefold interactions.

**Enhancements**:
- Improved gatefold open/close animations on mobile
- Better touch gesture handling (swipe, pinch)
- Optimized image loading for cellular connections
- Responsive liner notes layout

---

## Documentation & Processes

### Release Management
**Spec**: [global-versioned-release-deployment.md](specs/future/global-versioned-release-deployment.md)

Establish CI/CD pipeline with automated versioning and deployment to Cloudflare Pages.

---

### Data Pipeline Automation
**Spec**: [data-refresh-pipeline-orchestration.md](specs/future/data-refresh-pipeline-orchestration.md)

Scheduled data refresh workflows with validation and rollback capabilities.

---

### Visual Testing
**Spec**: [global-visual-testing-suite.md](specs/future/global-visual-testing-suite.md)

Automated visual regression testing for UI components across scenes.

---

## Navigation & Cross-References

### Related Documentation
- [Changelog](../src/data/changelog.json) - Release history with highlights
- [GitHub Releases](https://github.com/mmorper/concerts/releases) - Versioned releases with notes
- [Future Specs](specs/future/) - Detailed implementation plans
- [Implemented Specs](specs/implemented/) - Completed features with retrospectives
- [Deep Linking Guide](DEEP_LINKING.md) - URL parameters and navigation patterns

---

## How to Use This Roadmap

- **Specs marked "Planned"**: Ready for implementation, detailed spec available
- **Specs marked "In Progress"**: Active development, may be partially implemented
- **Short-term items**: Target for next 1-2 releases
- **Medium-term items**: Target for next 2-4 releases

For detailed implementation plans, see individual spec files linked above.
