# Roadmap

## Current State (v3.3.0)

- **178 concerts** spanning 1984-2026
- **104 headlining artists** with 247 total artists (including openers)
- **77 unique venues** across 35 cities
- **5 interactive scenes**: Timeline, Venues, Geography, Genres, Artists
- **Latest improvements**: Cross-scene venue navigation with venue+artist combined deep linking

---

## Recently Completed

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

### UX Polish

**Status**: In Progress
**Related Specs**:

- [mobile-optimization.md](specs/implemented/mobile-optimization.md)
- [popup-z-index-fix.md](specs/future/popup-z-index-fix.md)
- [renamed-venue-display.md](specs/future/renamed-venue-display.md)

Refinements to interaction patterns and navigation across the app.

**Remaining Improvements**:

- Improved button states and loading indicators
- Better keyboard navigation support
- Display renamed venues with ♻️ badge and new name

---

## Medium-Term Roadmap

### Venue Name Change Detection & CLI Management
**Status**: Planned
**Spec**: [venue-name-change-detection.md](specs/future/venue-name-change-detection.md)

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
**Architecture**: [data-normalization-architecture.md](specs/future/data-normalization-architecture.md)

**Related Specs**:

- [spotify-artist-integration.md](specs/future/spotify-artist-integration.md) - Feature spec
- [spotify-enrichment-runbook.md](specs/future/spotify-enrichment-runbook.md) - Operations runbook
- [unified-image-sourcing-strategy.md](specs/future/unified-image-sourcing-strategy.md) - Image strategy

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
**Spec**: [versioned-release-deployment.md](specs/future/versioned-release-deployment.md)

Establish CI/CD pipeline with automated versioning and deployment to Cloudflare Pages.

---

### Data Pipeline Automation
**Spec**: [data-refresh-pipeline-orchestration.md](specs/future/data-refresh-pipeline-orchestration.md)

Scheduled data refresh workflows with validation and rollback capabilities.

---

### Visual Testing
**Spec**: [visual-testing-suite.md](specs/future/visual-testing-suite.md)

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
