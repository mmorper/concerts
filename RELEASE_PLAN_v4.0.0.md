# Release Plan: v4.0.0 - Audio Previews & Documentation Cleanup

**Target Version:** 4.0.0 (Major)
**Current Version:** 3.9.0
**Release Type:** Major release with breaking documentation changes

## 🎯 Release Objectives

1. **Ship Audio Preview Feature** - Complete implementation with 70 tests
2. **Resolve GitHub Issue #21** - Remove all misleading Spotify references
3. **Component Rename** - Rename `SpotifyPanel` to `AudioPreviewPanel` for accuracy
4. **Documentation Accuracy** - Ensure all docs reflect actual implementation

---

## 📦 Phase 1: Audio Preview Feature (Complete)

### ✅ Implementation Complete
- [x] iTunes API client with normalization
- [x] Deezer API client with top tracks support
- [x] Enrichment script with iTunes→Deezer waterfall
- [x] Preview URL validation (HEAD requests)
- [x] 40% quality bar enforcement
- [x] UI components (AudioPreviewPlayer, TrackRow, EqualizerIcon)
- [x] Integration with Artist Gatefold
- [x] Mobile responsive layout

### ✅ Testing Complete
- [x] 13 tests for iTunes client
- [x] 25 tests for Deezer client (13 original + 12 new)
- [x] 22 tests for enrichment script helpers
- [x] 10 Puppeteer tests for UI interactions
- [x] **Total: 70 tests written**

### ✅ Data Pipeline Complete
- [x] 252/254 artists enriched (99.2% coverage)
- [x] 250 with iTunes (98.8%)
- [x] 2 with Deezer (0.8%)
- [x] All preview URLs validated and working

---

## 🧹 Phase 2: Component Rename (Pre-Release)

### Rename `SpotifyPanel` → `AudioPreviewPanel`

**Rationale:** Component was originally designed for Spotify integration, but now uses iTunes/Deezer. Name should reflect actual functionality.

**Files to Update:**
1. **Rename file:**
   - `src/components/scenes/ArtistScene/SpotifyPanel.tsx` → `AudioPreviewPanel.tsx`

2. **Update imports in:**
   - `src/components/scenes/ArtistScene/ArtistGatefold.tsx`
   - Any other files importing SpotifyPanel

3. **Update component name:**
   - Export name: `SpotifyPanel` → `AudioPreviewPanel`
   - Interface name: `SpotifyPanelProps` → `AudioPreviewPanelProps`

4. **Update comments/documentation:**
   - JSDoc comments referring to "Spotify"
   - Inline comments

**Verification:**
- [ ] All TypeScript imports resolve
- [ ] No build errors
- [ ] Component renders correctly in UI
- [ ] Puppeteer tests still pass

---

## 📚 Phase 3: Documentation Cleanup (GitHub Issue #21)

### 3.1 Critical User-Facing Documentation

#### README.md
**Changes:**
- [ ] **Line 54**: Remove "Album art and tracks from Spotify (for select artists)"
  - Replace with: "Audio preview player with top tracks from iTunes/Apple Music (for 252 artists)"
- [ ] **Line 133**: Remove future Spotify integration plans from "What's Next"
  - Update to reflect actual roadmap items

**New content to add:**
```markdown
### Audio Preview Player
- **252 artists** with validated 30-second track previews
- Primary source: iTunes/Apple Music (98.8% coverage)
- Fallback source: Deezer (validated URLs only)
- Features: Play/pause, auto-advance, track info with album art
```

#### docs/DATA_PIPELINE.md
**Changes:**
- [ ] **Lines 659-716**: Remove entire Section 7 "Spotify Enrichment"
- [ ] Update pipeline flow diagram to remove Spotify step
- [ ] Add new Section 7: "Audio Preview Enrichment"

**New Section 7 content:**
```markdown
## 7. Audio Preview Enrichment

**Script:** `scripts/enrich-top-tracks.ts`
**Output:** `public/data/artists-top-tracks.json`
**Sources:** iTunes Search API (primary), Deezer API (fallback)

### Process
1. For each artist, fetch top 5 tracks from iTunes
2. Validate preview URLs with HEAD requests
3. If iTunes fails or <40% coverage, fallback to Deezer
4. Only include artists with ≥40% validated preview URLs
5. Cache results for 30 days

### Configuration
- Track limit: 5 per artist
- Quality bar: 40% preview coverage (2/5 tracks minimum)
- Rate limiting: 600ms between requests
- Preview validation: HEAD request with 5s timeout
```

#### docs/WORKFLOW.md
**Changes:**
- [ ] **Lines 610, 613, 625, 628, 678, 688, 699, 702, 739**: Remove all `--skip-spotify` references
- [ ] Update command examples to reflect actual flags
- [ ] Add `npm run enrich:tracks` to pipeline commands

#### docs/ROADMAP.md
**Changes:**
- [ ] **Line 118**: Remove "Spotify green" color reference
- [ ] **Lines 258, 279-297**: Update "Spotify Integration" section
  - Mark as "Not Planned" (instead of "Blocked")
  - Add note: "Replaced by iTunes/Deezer audio preview implementation (v4.0.0)"

### 3.2 Internal Documentation

#### .claude/commands/data-refresh.md
**Changes:**
- [ ] Remove Spotify enrichment step from pipeline
- [ ] Add `enrich:tracks` step
- [ ] Update command sequence

#### .claude/skills/api-integration/SKILL.md
**Changes:**
- [ ] Remove Spotify API documentation section
- [ ] Add iTunes Search API section
- [ ] Update Deezer API section to include top tracks

#### .claude/context.md
**Changes:**
- [ ] Remove Spotify from roadmap mentions
- [ ] Update "Current Features" to include audio previews
- [ ] Update data source list

#### Other .claude/ files
**Search and update:**
- [ ] `.claude/commands/commands.md`
- [ ] `.claude/skills/code-organization/SKILL.md`
- [ ] Any other files with Spotify references

### 3.3 Update Actual Data Sources Documentation

**Create/Update sections to clarify:**

**Current Data Sources:**
1. **Concert Data:** Google Sheets (primary source)
2. **Artist Photos:** TheAudioDB (primary) → Last.fm (fallback) → Deezer (tertiary)
3. **Discography:** MusicBrainz
4. **Audio Previews:** iTunes/Apple Music (primary) → Deezer (fallback)
5. **Venue Data:** Ticketmaster, Google Places API
6. **Setlists:** setlist.fm API

### 3.4 Verification Steps
- [ ] Search entire codebase for "Spotify" (case-insensitive)
- [ ] Verify no broken documentation cross-references
- [ ] Check all command examples are runnable
- [ ] Ensure archived specs remain archived (don't delete)

---

## 🔧 Phase 4: Code Cleanup

### Package.json Script Cleanup
**Current issues:**
- Scripts reference `enrich-spotify` and `generate-mock-spotify`
- These scripts still exist but are unused

**Decision Point:**
1. **Option A (Recommended):** Leave scripts in place but add deprecation notice
   - Pro: Maintains backward compatibility if needed
   - Pro: Shows evolution of the project
   - Con: Slight clutter

2. **Option B:** Remove unused Spotify scripts entirely
   - Pro: Cleaner codebase
   - Con: Loses historical context
   - Con: Requires removing actual script files

**Recommendation:** Option A - Leave scripts but update their comments to indicate they're deprecated and unused.

### Update Script Comments
- [ ] `scripts/enrich-spotify-metadata.ts`: Add deprecation notice
- [ ] `scripts/generate-mock-spotify-metadata.ts`: Add deprecation notice

---

## 📝 Phase 5: Changelog & Version Bump

### Changelog Entry (v4.0.0)

```markdown
## [4.0.0] - 2025-02-03

### 🎵 Major: Audio Preview Player

**New Feature: Listen to tracks before attending concerts**

Added comprehensive audio preview functionality to the Artist Gatefold, allowing users to sample tracks from 252 artists (99.2% coverage).

**Features:**
- 30-second preview playback for top 5 tracks per artist
- iTunes/Apple Music as primary source (98.8% coverage - no auth required)
- Deezer as validated fallback source
- Play/pause controls with visual feedback
- Animated equalizer during playback
- Auto-advance to next track
- Hover states and default highlighting
- Disabled state for tracks without previews
- Mobile-responsive design
- Streaming service links (Apple Music/Deezer)

**Technical Implementation:**
- iTunes Search API client for track fetching
- Deezer API client with top tracks support
- Waterfall enrichment with iTunes→Deezer fallback
- Preview URL validation via HEAD requests
- 40% quality bar (minimum 2 of 5 tracks must have working previews)
- 30-day caching to minimize API usage
- Rate limiting: 600ms between requests
- Comprehensive test coverage: 70 tests (Vitest + Puppeteer)

**Data Pipeline:**
- New script: `npm run enrich:tracks`
- New data file: `public/data/artists-top-tracks.json`
- Enriched: 252/254 artists (99.2% coverage)
  - 250 from iTunes (98.8%)
  - 2 from Deezer (0.8%)
  - All preview URLs validated

**UI Components:**
- `AudioPreviewPlayer` - Main playback controller
- `TrackRow` - Individual track with 4 states (default, hover, playing, disabled)
- `EqualizerIcon` - Animated 3-bar indicator
- `AudioPreviewPanel` (renamed from SpotifyPanel)

### 🧹 Documentation: Spotify References Cleanup

**Fixed: Misleading documentation about non-existent Spotify integration**

Removed all references to Spotify integration that was never implemented, resolving GitHub issue #21.

**Changes:**
- README: Removed claims about Spotify features, added audio preview documentation
- DATA_PIPELINE: Removed Section 7 "Spotify Enrichment", added iTunes/Deezer section
- ROADMAP: Updated Spotify integration from "Blocked" to "Not Planned"
- WORKFLOW: Removed all `--skip-spotify` command examples
- Claude context files: Updated to reflect actual data sources
- API integration docs: Removed Spotify API, added iTunes Search API

**Clarified Actual Data Sources:**
- Artist imagery: TheAudioDB → Last.fm → Deezer
- Discography: MusicBrainz
- Audio previews: iTunes → Deezer (NEW in v4.0.0)
- Venue data: Ticketmaster, Google Places API
- Setlists: setlist.fm API

### ⚠️ Breaking Changes

**Component Rename:**
- `SpotifyPanel` → `AudioPreviewPanel`
  - Reflects actual functionality (iTunes/Deezer, not Spotify)
  - File location: `src/components/scenes/ArtistScene/AudioPreviewPanel.tsx`
  - No API changes, purely cosmetic rename

**Documentation Structure:**
- Removed Spotify-related workflow steps from official documentation
- Deprecated (but retained) `enrich-spotify` npm scripts for historical reference

### 🧪 Testing

**Test Coverage Added:**
- iTunes client: 13 Vitest tests
- Deezer client getTopTracks: 12 Vitest tests (25 total)
- Enrichment script helpers: 22 Vitest tests
- Audio preview UI: 10 Puppeteer interaction tests
- **Total: 70 new tests**

All tests passing. Coverage includes API mocking, error handling, URL validation, rate limiting, and end-to-end UI interactions.

### 📊 Stats

- **179 concerts** across 77 venues
- **254 artists** (252 with audio previews)
- **250 artists** with iTunes/Apple Music integration
- **99.2% audio preview coverage**

---

### Migration Guide

**For Users:**
No action required. Audio preview player appears automatically in Artist Gatefold for supported artists.

**For Developers:**
If you have custom code importing `SpotifyPanel`:
```diff
- import { SpotifyPanel } from './components/scenes/ArtistScene/SpotifyPanel'
+ import { AudioPreviewPanel } from './components/scenes/ArtistScene/AudioPreviewPanel'
```

**For Documentation Contributors:**
Spotify is not used in this application. When documenting data sources, use:
- Audio previews: iTunes/Apple Music (primary), Deezer (fallback)
- Artist imagery: TheAudioDB (primary), Last.fm (fallback), Deezer (tertiary)
```

### Version Bump
- [ ] Update `package.json`: `3.9.0` → `4.0.0`
- [ ] Update version in relevant documentation
- [ ] Generate build-time version file

---

## ✅ Phase 6: Pre-Release Checklist

### Code Quality
- [ ] All TypeScript compiles without errors
- [ ] All 70 tests pass (existing + new)
- [ ] No console errors in browser
- [ ] Audio playback works in production build

### Component Verification
- [ ] SpotifyPanel → AudioPreviewPanel rename complete
- [ ] All imports updated
- [ ] Component renders in Artist Gatefold
- [ ] Mobile layout works correctly

### Documentation Verification
- [ ] README accurately describes features
- [ ] DATA_PIPELINE reflects actual pipeline
- [ ] ROADMAP shows realistic plans
- [ ] WORKFLOW has valid command examples
- [ ] No broken internal links

### Data Verification
- [ ] `artists-top-tracks.json` committed
- [ ] File size reasonable (<5MB)
- [ ] All preview URLs format valid
- [ ] No sensitive data in preview URLs

### Build Verification
- [ ] `npm run build` succeeds
- [ ] Production bundle size acceptable
- [ ] No build warnings
- [ ] Source maps generated

---

## 🚀 Phase 7: Release Execution

### Release Steps
1. **Commit Phase 2** (Component Rename)
   ```bash
   git add .
   git commit -m "refactor: Rename SpotifyPanel to AudioPreviewPanel

   BREAKING CHANGE: SpotifyPanel component renamed to AudioPreviewPanel
   to accurately reflect implementation using iTunes/Deezer (not Spotify).

   Refs #21"
   ```

2. **Commit Phase 3** (Documentation Cleanup)
   ```bash
   git add docs/ .claude/ README.md
   git commit -m "docs: Remove misleading Spotify references

   Resolves #21

   - Remove Spotify claims from README
   - Remove Spotify enrichment section from DATA_PIPELINE
   - Update ROADMAP to mark Spotify as 'Not Planned'
   - Remove --skip-spotify from WORKFLOW examples
   - Add iTunes/Deezer audio preview documentation
   - Clarify actual data sources in use"
   ```

3. **Create Release**
   ```bash
   # Use /release command which handles:
   # - Changelog generation
   # - Version bump
   # - Git tagging
   # - GitHub release creation
   ```

### Post-Release Verification
- [ ] GitHub release created successfully
- [ ] Tag pushed: `v4.0.0`
- [ ] Changelog rendered correctly on GitHub
- [ ] Issue #21 automatically closed
- [ ] Production deployment triggered (if automated)

### Announcement
- [ ] Update any status boards
- [ ] Notify stakeholders of major version
- [ ] Document breaking changes

---

## 📋 Summary

**Major Version Justification:**
- **Breaking Change:** Component rename (SpotifyPanel → AudioPreviewPanel)
- **Significant New Feature:** Audio preview player with 70 tests
- **Documentation Structure Changes:** Removed Spotify sections

**Issue Resolution:**
- ✅ Resolves GitHub Issue #21 (Spotify documentation cleanup)

**Test Coverage:**
- ✅ 70 new tests covering data pipeline and UI

**User Impact:**
- ✅ 252 artists now have audio previews (99.2% coverage)
- ✅ Accurate documentation reflecting actual implementation
- ⚠️ Developers must update SpotifyPanel imports (if customized)

**Timeline Estimate:**
- Phase 2 (Rename): ~30 minutes
- Phase 3 (Docs): ~45 minutes
- Phase 4-7 (Cleanup, Release): ~30 minutes
- **Total:** ~1.5-2 hours

---

## 🎯 Success Criteria

### Feature Completeness
- [x] Audio preview player fully implemented
- [x] 99.2% artist coverage achieved
- [x] All preview URLs validated
- [x] 70 tests written and passing

### Documentation Accuracy
- [ ] No misleading Spotify claims in user docs
- [ ] All data sources accurately documented
- [ ] Command examples are valid and runnable
- [ ] Roadmap reflects actual plans

### Code Quality
- [ ] Component names reflect functionality
- [ ] No TypeScript errors
- [ ] Build succeeds
- [ ] Tests pass

### Issue Resolution
- [ ] GitHub Issue #21 resolved
- [ ] All acceptance criteria met
- [ ] Issue automatically closed by commit reference

---

**Ready to proceed with Phase 2 (Component Rename)?**
