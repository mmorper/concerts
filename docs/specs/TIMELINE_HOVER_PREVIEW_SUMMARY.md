# Timeline Hover Preview - Executive Summary

**Version:** v1.4.0
**Status:** Ready for Implementation
**Estimated Duration:** 8-12 hours across 3 context windows

---

## What We're Building

A hover-triggered preview popup system for the timeline that lets users "scrub through time" by moving their cursor across year dots. When hovering over a year, a beautiful popup appears showing:

- A random artist's image (from that year's concerts)
- Artist name + venue
- "X more concerts" indicator
- Year and total show count

The popup follows the cursor smoothly between dots with crossfading content and includes a subtle parallax effect on the artist image.

---

## Key Decisions Made

### ✅ Confirmed
1. **Artist Images:** Using existing TheAudioDB data (~87 artists with images)
2. **Modal Removal:** Current click-to-open modal will be removed
3. **Mobile Strategy:** Completely disabled for <768px (defer to v1.5.0)
4. **Testing:** Manual testing with guidance + basic automated tests
5. **Context Windows:** 3-window implementation (Foundation → Integration → Polish)
6. **Priority:** This replaces timeline-wake-effect as next feature

### 📋 Specifications
- **Part 1:** Visual Design & Content (377 lines)
- **Part 2:** Interaction & Animation (668 lines)
- **Part 3:** Technical Implementation (1,064 lines)
- **Total:** 2,109 lines of detailed specifications

---

## Implementation Strategy

### Context Window 1: Foundation (3-4 hours)
**Create:**
- Type definitions (8 interfaces)
- Constants (timing, dimensions, colors)
- `useArtistMetadata` hook (loads JSON data)
- `useTimelineHover` hook (state management)
- `TimelinePopupContent` component (image + text)

**Verify:**
- Hooks load artist metadata correctly
- Types compile without errors
- Content component renders properly

### Context Window 2: Integration (3-4 hours)
**Create:**
- `TimelineHoverPreview` main component
- Position calculation logic (with edge clamping)
- Animation system (entry, exit, crossfade)

**Modify:**
- `Scene1Hero.tsx` - Remove modal, add hover hooks
- D3 useEffect - Track dot positions, wire up handlers

**Verify:**
- Popup appears/disappears correctly
- Crossfade works between years
- Animations are smooth

### Context Window 3: Polish (2-4 hours)
**Tasks:**
- Manual testing (13 test scenarios)
- Automated tests (6 core behaviors)
- Documentation updates (STATUS.md, README.md)
- Archive old timeline specs
- Version bump to 1.4.0
- Production build verification

---

## What Gets Removed

From `Scene1Hero.tsx`:
- Line 12: `selectedYear` state
- Lines 222-225: `selectedYearConcerts` calculation
- Lines 188-190: Click handler on dots
- Lines 296-377: Entire modal AnimatePresence block

**Net Result:** ~90 lines removed, cleaner component

---

## What Gets Added

```
src/components/scenes/TimelineHoverPreview/
├── index.ts                      # Barrel export
├── types.ts                      # TypeScript interfaces
├── constants.ts                  # Configuration values
├── useArtistMetadata.ts          # Metadata loading hook
├── useTimelineHover.ts           # Hover state management
├── TimelineHoverPreview.tsx      # Main popup component
├── TimelinePopupContent.tsx      # Content display
└── __tests__/                    # Test files
    └── TimelineHoverPreview.test.tsx
```

**Net Result:** ~500-600 lines of new code

---

## User Experience

### Before (Current)
1. User hovers year dot → dot glows
2. User clicks dot → modal opens with full concert list
3. User clicks X or backdrop → modal closes
4. **Friction:** Requires commitment (click), blocks view, slow to explore

### After (v1.4.0)
1. User hovers year dot → popup appears after 120ms with artist preview
2. User moves to adjacent dot → content crossfades, popup follows
3. User moves mouse within popup → image parallax responds
4. User leaves dot → popup lingers 300ms, then fades out
5. **Delight:** No commitment, fluid exploration, "scrubbing through time"

---

## Technical Highlights

### Interaction Patterns
- **Hover Delay:** 120ms prevents flicker on rapid movement
- **Linger Duration:** 300ms allows reading + smooth transitions
- **Session Persistence:** Above/below alternates but persists per session
- **Crossfade:** 180ms content swap (90ms out + 90ms in)
- **Parallax:** ±6px image shift, immediate response

### Edge Cases Handled
- Years with no artist images → no popup appears
- Single concert years → no "+ X more" text
- Edge dots → popup clamped, arrow offset adjusts
- Reduced motion → simplified animations, no parallax
- Mobile → completely disabled

### Performance
- `requestAnimationFrame` for parallax throttling
- Single popup instance (content swaps, no DOM churn)
- Memoized content calculation by year
- `will-change` hints for GPU acceleration

---

## Risk Assessment

### ✅ Low Risk
- Well-specified (2,109 lines of detailed specs)
- Artist images already available (87 enriched)
- No new dependencies required
- Straightforward React + Framer Motion patterns

### ⚠️ Medium Risk
- Performance on parallax mouse movement
  - **Mitigation:** RAF throttling implemented
- Edge clamping arrow math complexity
  - **Mitigation:** Thoroughly test first/last dots

### 🟢 Success Factors
- Existing modal removal simplifies Scene1Hero
- Specs include complete TypeScript interfaces
- 3-window strategy prevents context overflow
- Clear testing criteria (13 manual + 6 automated)

---

## Success Criteria

**Must Have (v1.4.0 Release):**
- [ ] Popup appears on hover after 120ms
- [ ] Content crossfades between years
- [ ] Parallax effect works smoothly
- [ ] Modal completely removed
- [ ] No console errors
- [ ] TypeScript strict passes
- [ ] Production build successful
- [ ] All 13 manual tests pass

**Nice to Have (Future):**
- Image preloading for adjacent years
- Click-to-expand to rich modal (v1.5.0+)
- Spotify album art integration (v1.5.0+)
- Mobile alternative (v1.5.0+)

---

## Documentation Updates

### STATUS.md
- [x] Add v1.4.0 section above v1.3.4
- [x] Update future roadmap with version targets
- [x] Note timeline-wake-effect archived

### README.md
- [ ] Update "What's next" to v1.4.0
- [ ] Add timeline hover preview description

### Archive
- [ ] Move `timeline-wake-effect-spec.md` to `specs/archive/`
- [ ] Move `timeline-wake-effect-poc.html` to `specs/archive/`

### New Docs
- [ ] Create `specs/implemented/timeline-hover-preview.md`
- [ ] Link to all 3 spec parts

---

## Next Steps

1. **Review This Summary** - Confirm understanding and approach
2. **Begin Window 1** - Foundation & Components
3. **User Approval** - Check in before Window 2
4. **Continue Windows 2-3** - Complete implementation
5. **Release v1.4.0** - Deploy to production

---

## Questions Before Starting?

- Any concerns about the 3-window strategy?
- Want to adjust priorities or scope?
- Need clarification on any technical approach?
- Ready to begin Window 1?

---

*Summary Version: 1.0*
*Created: 2026-01-02*
*Project Plan: [TIMELINE_HOVER_PREVIEW_PROJECT_PLAN.md](TIMELINE_HOVER_PREVIEW_PROJECT_PLAN.md)*
*Specifications: [Part 1](future/timeline-hover-preview-spec-part1.md) | [Part 2](future/timeline-hover-preview-spec-part2.md) | [Part 3](future/timeline-hover-preview-spec-part3.md)*
