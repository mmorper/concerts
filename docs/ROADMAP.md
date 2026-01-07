# Roadmap

## Current State (v3.0.0)

- **178 concerts** spanning 1984-2026
- **104 headlining artists** with 247 total artists (including openers)
- **77 unique venues** across 35 cities
- **5 interactive scenes**: Timeline, Venues, Geography, Genres, Artists
- **Latest improvements**: Interactive timeline exploration with year cards and animated genre journey

---

## Recently Completed

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

## Short-Term Roadmap

### UX Polish

**Status**: In Progress
**Related Specs**:

- [mobile-optimization.md](specs/implemented/mobile-optimization.md)
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
