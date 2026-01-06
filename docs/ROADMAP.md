# Roadmap

## Current State (v2.0.0)

- **178 concerts** spanning 1984-2026
- **104 headlining artists** with 247 total artists (including openers)
- **77 unique venues** across 35 cities
- **5 interactive scenes**: Timeline, Venues, Geography, Genres, Artists
- **Latest improvements**: Real-time tour dates with Ticketmaster API integration

---

## Recently Completed

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

## Short-Term Roadmap

---

### UX Polish
**Status**: In Progress
**Related Specs**:
- [mobile-optimization.md](specs/future/mobile-optimization.md)
- [popup-z-index-fix.md](specs/future/popup-z-index-fix.md)
- [renamed-venue-display.md](specs/future/renamed-venue-display.md)

Refinements to interaction patterns and navigation across the app.

**Improvements**:
- Enhanced touch and click feedback (haptic + visual)
- Add hyperlinks in gatefold content (venue names, related artists)
- Improved button states and loading indicators
- Better keyboard navigation support
- Display renamed venues with ♻️ badge and new name

---

### Timeline Artist Display Enhancement
**Status**: Planned
**Spec**: [timeline-artist-display-enhancement.md](specs/future/timeline-artist-display-enhancement.md)

Improve artist imagery and information presentation in the Timeline scene.

**Features**:
- Enhanced hover preview with larger artist images
- Show artist metadata (genre, concert count) on hover
- Improved parallax effects and animations
- Better handling of artists without images

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
**Status**: Planned
**Related Specs**:
- [spotify-artist-integration.md](specs/future/spotify-artist-integration.md)
- [unified-image-sourcing-strategy.md](specs/future/unified-image-sourcing-strategy.md)
- [spotify-enrichment-runbook.md](specs/future/spotify-enrichment-runbook.md)

Consolidate image sourcing from multiple providers (Spotify, AudioDB, Last.fm) with priority-based fallback hierarchy.

**Key Goals**:
- Single image pipeline for all artist metadata
- Consistent image quality and sizing across scenes
- Spotify as primary source with graceful fallbacks
- Automated image validation and refresh

---

### Genre Scene Refactor (Sunburst Control for Mobile)
**Status**: Planned
**Related Specs**:
- [genre-scene-treemap-visualization.md](specs/future/genre-scene-treemap-visualization.md)
- [genre-scene-opener-inclusion.md](specs/future/genre-scene-opener-inclusion.md)

Redesign Genre scene controls for better mobile experience and add support for opener artists.

**Improvements**:
- Mobile-optimized sunburst interaction
- Touch-friendly zoom and pan controls
- Include opener artists in genre hierarchy
- Alternative treemap visualization option

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
