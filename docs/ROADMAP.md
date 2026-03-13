# Roadmap

## Current State (v4.6.0)

- **181 concerts** spanning 1984-2026
- **256 artists** (including openers) with 100% imagery coverage
- **77 unique venues** across 35 cities
- **5 interactive scenes**: Timeline, Venues, Geography, Genres, Artists
- **Standalone pages**: /liner-notes, /whats-playing, /how-it-works, /about
- **Latest**: How It Works — interactive 7-tier data enrichment cascade at /how-it-works

---

## Recently Completed

### ✅ Cascade Progressive Disclosure — How It Works (v4.6.0)

**Status**: Completed
**Spec**: [how-it-works.md](specs/implemented/how-it-works.md)

Interactive animated cascade showing how three raw data points become a richly enriched concert archive. Seven tiers pour top to bottom, each tier revealing a different enrichment layer — geographic, artist identity, audio, and performance data — with slot-machine counters and a post-build glow.

---

### ✅ Deep Cuts — Liner Notes in Gatefold + Mobile (v4.5.0–v4.5.1)

**Status**: Completed

Liner Notes tab in artist gatefold, year deep links (`/?scene=timeline&year=YYYY`), mobile bottom nav bar, unified toast for liner notes + changelog notifications, and mobile layout polish.

---

### ✅ Liner Notes (v4.4.0)

**Status**: Completed

Agentic AI-written weekly stories from the archive. Blog feed at /liner-notes with category chips and tag filters, individual post permalinks, /whats-playing changelog page, RSS feed, Cloudflare Worker for dynamic OG tag injection.

---

### ✅ Audio Preview Player — iTunes (v4.0.0–v4.3.2)

**Status**: Completed

30-second iTunes previews for 256 artists (100% coverage). Dropped Deezer (15-min CDN token TTL incompatible with static pipeline). Auto-enrichment on every `build-data` run. Upcoming concert badges on Timeline and Artist profiles.

---

### ✅ About Page (v4.x)

**Status**: Completed
**Spec**: [global-about-page.md](specs/implemented/global-about-page.md)

Static /about page surfacing creator identity and project backstory for SEO authority signals.

---

### ✅ SEO Tool v2 - Integrated Analytics & Backlink Support (v4.2.0)

**Status**: Completed
**Spec**: [global-seo-tool-v2.md](specs/implemented/global-seo-tool-v2.md)

Comprehensive SEO intelligence with Google Search Console integration, GA4 integration, and correlation insights engine.

---

### ✅ Artist Imagery Enrichment - Deezer Fallback (v3.9.0)

**Status**: Completed
**Spec**: [global-deezer-artist-imagery.md](specs/implemented/global-deezer-artist-imagery.md)

Enhanced enrichment pipeline with Deezer API as third fallback source, achieving 100% artist imagery coverage for headliners and openers.

---

### ✅ Artist Discography Data Pipeline (v3.5.0)

**Status**: Completed (UI integration planned — see Medium-Term)
**Spec**: [artists-discography.md](specs/future/artists-discography.md)

MusicBrainz API enrichment for 15,000+ albums across all artists. Data available in `discography.json`.

---

### ✅ Venue Cross-Scene Navigation (v3.3.0)

**Status**: Completed
**Spec**: [venues-deep-linking.md](specs/implemented/venues-deep-linking.md)

Clickable venue names in Artist gatefold and phone modal; venue+artist combined deep linking focuses both nodes in force-directed graph.

---

### ✅ Interactive Timeline Exploration & Genre Journey (v3.0.0)

**Status**: Completed

Click-to-filter year cards, animated genre treemap with timeline slider, mobile-optimized touch interactions.

---

## Short-Term Roadmap

### How It Works — Interactive Thumbnails (#88)

**Status**: Planned
**Issue**: [#88](https://github.com/mmorper/concerts/issues/88)

Make the T2 (venue photo), T3 (artist photo), and T4 (album art) thumbnails in the cascade interactive — clickable within the cascade rather than purely cosmetic.

---

### Genre Coverage for Opener Artists (#69)

**Status**: Planned
**Issue**: [#69](https://github.com/mmorper/concerts/issues/69)

Opener artist genre coverage is 62% vs 93% for headliners. Root cause: opener artists are present in `artists-metadata.json` but not enriched at the same level. Affects `genre-outlier` detector and any future genre-based analysis.

---

### llm.txt — Page Structure & Semantic Hierarchy (#30)

**Status**: Planned
**Issue**: [#30](https://github.com/mmorper/concerts/issues/30)

Add page structure and H1/H2 hierarchy documentation to `llm.txt` to help AI assistants better understand the site's organization. Low-effort (~15 min).

---

### UX Polish

**Status**: In Progress
**Related Specs**:

- [mobile-optimization.md](specs/implemented/mobile-optimization.md)
- [map-popup-z-index.md](specs/future/map-popup-z-index.md)
- [map-renamed-venue-badges.md](specs/future/map-renamed-venue-badges.md)

**Remaining Improvements**:

- Display renamed venues with ♻️ badge and new name on map popups (#8)
- Improved button states and loading indicators
- Better keyboard navigation support

---

## Medium-Term Roadmap

### Deferred Liner Notes Generators (#68)

**Status**: Planned
**Issue**: [#68](https://github.com/mmorper/concerts/issues/68)

Four pattern detectors scoped but deferred during v4.4.x: `genreOutlier` (statistical genre anomalies), `doubleHeader` (same-venue multi-artist nights), `discographyCrossref` (albums released around concert dates), `temporalPattern` (multi-decade return patterns). Some require improved genre data (#69) first.

---

### Audio Preview in Setlist Items (#22)

**Status**: Planned
**Issue**: [#22](https://github.com/mmorper/concerts/issues/22)

Clickable song previews directly in the setlist panel. Users open a concert setlist, click a song, and hear the iTunes preview inline — without switching to the artist gatefold.

---

### Artist Discography UI Panel (#5)

**Status**: Planned (data pipeline completed in v3.5.0)
**Spec**: [artists-discography.md](specs/future/artists-discography.md)

Visual discography panel in Artist Scene gatefold showing album covers and release timeline. Data already available in `discography.json` (15k+ albums).

**Key Features**:

- Grid layout of album covers (4-5 columns), chronological ordering (newest first)
- Album type filtering (studio, live, EP, compilations)
- Hover to show album title + year

---

### Analytics Suite (#37–#41)

**Status**: Planned
**Issues**: [#37](https://github.com/mmorper/concerts/issues/37), [#38](https://github.com/mmorper/concerts/issues/38), [#39](https://github.com/mmorper/concerts/issues/39), [#40](https://github.com/mmorper/concerts/issues/40), [#41](https://github.com/mmorper/concerts/issues/41)

GA4 Explore reports across five suites: scene navigation & engagement, artist content analysis, setlist & venue exploration, user behavior & device optimization, temporal patterns & retention.

---

### Venue Name Change Detection & CLI Management (#7)

**Status**: Planned
**Spec**: [global-venue-name-change-detection.md](specs/future/global-venue-name-change-detection.md)

Automatically detect when venue names change during enrichment; `npm run venue-review` CLI for guided review workflow.

---

### Validation Architecture Refactor (#14)

**Status**: Planned
**Issue**: [#14](https://github.com/mmorper/concerts/issues/14)

Centralize validation logic currently scattered across scripts; improve error messages and recovery paths.

---

### Spotify Integration

**Status**: Not Planned (Replaced by iTunes implementation in v4.0.0)

Original vision was blocked by Spotify API not accepting new projects. iTunes/Apple Music provides equivalent capability with no auth requirements and stable CDN URLs.

---

## Documentation & Processes

### Release Management (#13)

**Spec**: [global-versioned-release-deployment.md](specs/future/global-versioned-release-deployment.md)

CI/CD pipeline with automated versioning and deployment to Cloudflare Pages.

---

### Data Pipeline Automation

**Spec**: [data-refresh-pipeline-orchestration.md](specs/future/data-refresh-pipeline-orchestration.md)

Scheduled data refresh workflows with validation and rollback capabilities.

---

### Visual Testing (#10)

**Spec**: [global-visual-testing-suite.md](specs/future/global-visual-testing-suite.md)

Automated visual regression testing for UI components across scenes.

---

## Navigation & Cross-References

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
