# Timeline Hover Preview - Project Plan (v1.4.0)

**Status:** Ready to Execute
**Target Version:** v1.4.0
**Estimated Effort:** 8-12 hours development across 3 context windows
**Created:** 2026-01-02

---

## Executive Summary

Implementation of hover-triggered preview popups for timeline year dots, allowing users to explore concert history through a "scrubbing through time" interaction. This feature replaces the current click-to-open modal with a more fluid, non-committal preview experience.

**Key Features:**
- Hover-triggered popups (120ms delay)
- Artist imagery from TheAudioDB
- Persistent frame with crossfade between years
- Parallax image effect
- Above/below positioning logic
- Mobile disabled (<768px)

---

## Context Window Strategy

### Context Window 1: Foundation & Components
**Goal:** Set up infrastructure and build reusable components
**Duration:** ~3-4 hours
**Token Budget:** ~50K tokens

**Deliverables:**
1. Type definitions and constants
2. Hook implementations (useArtistMetadata, useTimelineHover)
3. Content component (TimelinePopupContent)
4. Unit verification (hooks load data correctly)

### Context Window 2: Integration & Animation
**Goal:** Build main popup, integrate with Scene1Hero
**Duration:** ~3-4 hours
**Token Budget:** ~50K tokens

**Deliverables:**
1. Main popup component (TimelineHoverPreview)
2. Scene1Hero modifications (remove modal, add hover)
3. D3 position tracking
4. Entry/exit animations working

### Context Window 3: Polish & Release
**Goal:** Testing, refinement, documentation
**Duration:** ~2-4 hours
**Token Budget:** ~40K tokens

**Deliverables:**
1. Manual testing (all edge cases)
2. Automated tests (basic interactions)
3. Documentation updates (STATUS.md, README.md)
4. Archive old timeline specs
5. Version bump to 1.4.0

---

## Pre-Implementation Checklist

### ✅ Verified
- [x] Artist metadata exists at `/public/data/artists-metadata.json`
- [x] TheAudioDB enrichment is active (~87 artists with images)
- [x] Scene1Hero has modal to remove (lines 296-377)
- [x] No existing hover preview conflicts
- [x] Metadata structure: `artists.{normalizedName}.image`

### ⚠️ Important Notes
- **Modal Removal:** Lines 12, 222-225, 296-377 in Scene1Hero.tsx
- **Hover Handlers:** Lines 140-190 need modification (keep animation, add popup trigger)
- **Position Tracking:** Need to store dot positions in Map for popup placement
- **Mobile:** Completely disabled for viewports <768px

---

## Detailed Implementation Plan

### Context Window 1: Foundation & Components

#### Phase 1.1: Directory Structure & Types (30 min)
```
src/components/scenes/TimelineHoverPreview/
├── index.ts                      # Barrel export
├── types.ts                      # All TypeScript interfaces
├── constants.ts                  # Timing/dimension/color constants
├── useTimelineHover.ts           # Main hover state hook
├── useArtistMetadata.ts          # Metadata loading hook
├── TimelineHoverPreview.tsx      # Main popup component (Window 2)
└── TimelinePopupContent.tsx      # Content component
```

**Files to Create:**
1. `types.ts` - 8 interfaces from spec Part 3
2. `constants.ts` - TIMING, DIMENSIONS, PARALLAX, EASING, COLORS
3. `index.ts` - Barrel exports

**Verification:**
- TypeScript compiles without errors
- Constants match spec values exactly

#### Phase 1.2: Metadata Loading Hook (45 min)
**File:** `useArtistMetadata.ts`

**Implementation:**
- Fetch `/data/artists-metadata.json` on mount
- Parse nested structure (`data.artists`)
- Return `{ metadata, isLoading, error }`
- Handle both TheAudioDB and future Spotify fields

**Testing:**
- Hook loads 240 artists
- TheAudioDB artists have `image` field
- No console errors

#### Phase 1.3: Core Hover Hook (90 min)
**File:** `useTimelineHover.ts`

**Key Functions:**
1. `normalizeArtistName()` - Match metadata keys
2. `getArtistImageUrl()` - Spotify → TheAudioDB priority
3. `selectFeaturedConcert()` - Random with image filter
4. `calculateParallax()` - Cursor-based offset

**State Management:**
- `HoverSessionState` with session persistence
- Timer refs for hover delay (120ms) and linger (300ms)
- Parallax offset state
- `prefers-reduced-motion` detection

**Testing:**
- Hover delay prevents rapid flicker
- Linger timer keeps popup visible
- Session position persists (above/below)
- Image-only filtering works

#### Phase 1.4: Content Component (60 min)
**File:** `TimelinePopupContent.tsx`

**Structure:**
- Image container (188×140px) with parallax
- Artist + Venue line (truncation on overflow)
- "+ X more" conditional
- Year · count footer with divider

**Styling:**
- Inline styles matching spec colors
- Source Sans 3 font family
- Proper text truncation
- Parallax transform on image

**Testing:**
- Parallax responds to mouse movement
- Text truncation works for long venue names
- Single concert years hide "+ X more"
- Footer shows correct plural ("show" vs "shows")

---

### Context Window 2: Integration & Animation

#### Phase 2.1: Main Popup Component (90 min)
**File:** `TimelineHoverPreview.tsx`

**Features:**
1. Position calculation (X with edge clamping)
2. Position calculation (Y above/below)
3. Arrow pointer (offset adjusts when clamped)
4. Entry animation (fade + scale + Y translate)
5. Exit animation (fade only)
6. Content crossfade with AnimatePresence
7. Position slide animation (250ms)

**Key Logic:**
- `calculatePopupX()` - Edge clamping with padding
- `calculatePopupY()` - Above/below with dot gap
- Arrow offset tracks clamping
- Framer Motion for all animations

**Testing:**
- Popup appears at correct position
- Edge clamping works on first/last dots
- Arrow points to dot even when clamped
- Animations smooth and performant

#### Phase 2.2: Scene1Hero Integration (120 min)
**File:** `src/components/scenes/Scene1Hero.tsx`

**Modifications:**
1. **Remove** (Lines 12, 222-225, 296-377):
   - `selectedYear` state
   - `selectedYearConcerts` derived state
   - Entire modal AnimatePresence block

2. **Add** (Top of component):
   - `useArtistMetadata()` hook call
   - `useTimelineHover()` hook call
   - `yearPositions` state (Map)
   - Container ref and rect tracking

3. **Modify** (D3 useEffect, lines 37-215):
   - Track dot positions in Map
   - Add `handlers.onDotEnter()` to mouseenter (line 140)
   - Add `handlers.onDotLeave()` to mouseleave (line 164)
   - **Remove** click handler (line 188-190)

4. **Add** (Render):
   - `<TimelineHoverPreview>` component below timeline SVG

**D3 Position Tracking:**
```typescript
const positions = new Map<number, YearDotPosition>()

yearArray.forEach((year, index) => {
  const x = xScale(year)
  const radius = sizeScale(count)

  positions.set(year, {
    year,
    x: x + margin.left,
    y: innerHeight / 2 + margin.top,
    radius,
    index,
  })

  touchTarget
    .on('mouseenter', function() {
      // Existing animation...
      handlers.onDotEnter(year, positions.get(year)!)
    })
    .on('mouseleave', function() {
      // Existing animation...
      handlers.onDotLeave()
    })
    // REMOVE: .on('click', () => setSelectedYear(year))
})

setYearPositions(positions)
```

**Testing:**
- Hover triggers popup after 120ms
- Moving between dots crossfades content
- Leaving dots hides popup after 300ms
- No modal on click
- Existing dot animations still work

---

### Context Window 3: Polish & Release

#### Phase 3.1: Manual Testing (60 min)

**Test Matrix:**
| Test Case | Expected Result | Status |
|-----------|----------------|--------|
| Hover dot <120ms, leave | No popup | |
| Hover dot >120ms | Popup fades in | |
| Leave dot, return <300ms | Popup stays | |
| Leave dot >300ms | Popup fades out | |
| Move between dots | Crossfade works | |
| Rapid mouse movement | No popups | |
| Year with no images | No popup, dot glows | |
| Single concert year | No "+ X more" | |
| Mouse within popup | Parallax moves | |
| Popup near left edge | Clamped, arrow points | |
| Popup near right edge | Clamped, arrow points | |
| Reduced motion | Simplified animations | |
| Resize window | Popup repositions | |

**Bug Fixes:**
- Address any issues found
- Test on multiple browsers (Chrome, Firefox, Safari)
- Verify on different viewport sizes

#### Phase 3.2: Automated Tests (45 min)

**Test File:** `src/components/scenes/TimelineHoverPreview/__tests__/TimelineHoverPreview.test.tsx`

**Test Coverage:**
1. `useArtistMetadata` loads data
2. `selectFeaturedConcert` filters to images only
3. `calculateParallax` returns correct offsets
4. Hover delay prevents immediate popup
5. Linger duration keeps popup visible
6. Session position persists

**Libraries:**
- React Testing Library
- Jest
- User-event for interactions

#### Phase 3.3: Documentation Updates (45 min)

**Files to Update:**

1. **README.md:**
   - Update "What's next" to v1.4.0
   - Mention timeline hover preview feature

2. **docs/STATUS.md:**
   - Add v1.4.0 section above v1.3.4
   - Document implementation stats
   - List files created/modified

3. **package.json:**
   - Bump version to 1.4.0

4. **Archive Old Specs:**
   - Move `timeline-wake-effect-spec.md` → `docs/specs/archive/`
   - Move `timeline-wake-effect-poc.html` → `docs/specs/archive/`
   - Update STATUS.md future roadmap

5. **Create Implementation Doc:**
   - Move these 3 spec files → `docs/specs/implemented/`
   - Create `docs/specs/implemented/timeline-hover-preview.md`
   - Link to all 3 parts

#### Phase 3.4: Final Build & Verification (30 min)

**Steps:**
1. Run `npm run build`
2. Verify TypeScript strict mode passes
3. Check bundle size impact
4. Test production build locally
5. Verify all animations work in prod
6. Test on live site (concerts.morperhaus.org)

---

## Risk Assessment

### High Risk
None identified

### Medium Risk
1. **Image Coverage:** Only ~87 artists have images
   - **Mitigation:** Spec handles this (no popup for image-less years)
   - **Future:** Spotify integration will increase coverage

2. **Performance:** Parallax on mouse move could be jank
   - **Mitigation:** Use `requestAnimationFrame` throttling
   - **Fallback:** Disable parallax if frame rate drops

### Low Risk
1. **Edge Clamping:** Complex math for arrow offset
   - **Mitigation:** Thoroughly test first/last dots

2. **Mobile Interference:** Spec disables for <768px
   - **Mitigation:** Simple media query check

---

## Success Criteria

### Must Have (v1.4.0 Release)
- ✅ Popup appears on hover after 120ms delay
- ✅ Content crossfades when moving between dots
- ✅ Parallax effect works smoothly
- ✅ No modal on click (removed)
- ✅ Above/below positioning persists per session
- ✅ Edge clamping works correctly
- ✅ Mobile disabled (<768px)
- ✅ No console errors or warnings
- ✅ TypeScript strict mode passes
- ✅ Production build successful

### Nice to Have (Future)
- Image preloading for adjacent years
- Click-to-expand to full modal
- Spotify album art integration
- Mobile alternative interaction

---

## Rollback Plan

If critical issues arise:

1. **Immediate:** Revert Scene1Hero.tsx to previous commit
2. **Short-term:** Feature flag to disable hover preview
3. **Long-term:** Fix issues, re-deploy

**Critical Issue Definition:**
- Popup crashes browser
- Performance regression >100ms frame time
- Breaks existing timeline functionality
- Blocks user from viewing concerts

---

## Post-Release

### Monitoring (Week 1)
- [ ] Check production console for errors
- [ ] Verify analytics show engagement increase
- [ ] Monitor for user feedback/issues

### Future Enhancements (v1.5.0+)
1. Spotify album art integration
2. Image preloading for smooth transitions
3. Click-to-expand to rich modal
4. Mobile bottom sheet alternative
5. Genre-specific image fallbacks

---

## Communication Plan

### Development Updates
- Commit messages follow format: `feat: timeline hover preview - {description}`
- GitHub issue tracking (if needed)
- Status updates in STATUS.md after each window

### User-Facing
- Release notes in README.md
- GitHub release v1.4.0 with feature highlight
- Social media post (optional)

---

## Files to Create/Modify

### New Files (8)
```
src/components/scenes/TimelineHoverPreview/
├── index.ts
├── types.ts
├── constants.ts
├── useArtistMetadata.ts
├── useTimelineHover.ts
├── TimelineHoverPreview.tsx
├── TimelinePopupContent.tsx
└── __tests__/TimelineHoverPreview.test.tsx

docs/specs/implemented/timeline-hover-preview.md
```

### Modified Files (4)
```
src/components/scenes/Scene1Hero.tsx
docs/STATUS.md
README.md
package.json
```

### Archived Files (2)
```
docs/specs/archive/timeline-wake-effect-spec.md (moved)
docs/specs/archive/timeline-wake-effect-poc.html (moved)
```

---

## Timeline

| Window | Phase | Duration | Completion |
|--------|-------|----------|------------|
| 1 | Foundation & Components | 3-4 hours | |
| 2 | Integration & Animation | 3-4 hours | |
| 3 | Polish & Release | 2-4 hours | |
| **Total** | | **8-12 hours** | |

---

## Sign-Off

**Reviewed By:** User
**Approved:** Pending
**Start Date:** TBD
**Target Completion:** TBD

---

*Project Plan Version: 1.0*
*Created: 2026-01-02*
*Spec References: timeline-hover-preview-spec-part{1,2,3}.md*
