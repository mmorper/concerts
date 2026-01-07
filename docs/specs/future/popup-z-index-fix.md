# Popup Z-Index Fix

> **Status**: Optional Enhancement
> **Priority**: Low
> **Effort**: Medium (requires careful testing)
> **Last Updated**: 2026-01-07

---

## Current Behavior

Venue popups in Geography Scene may appear behind navigation buttons in rare cases (e.g., markers near map edges like Las Vegas).

**Root Cause:** The map container (`z-0`) creates a stacking context that contains all Leaflet elements. No matter how high the popup's z-index is set within that context (`z-index: 9999`), it cannot escape to appear above React elements at `z-[1001]` in the parent stacking context.

---

## Impact Assessment

**Low Priority** because:
1. Most venue clusters (LA, DC) are center-map and never overlap with nav buttons
2. Navigation buttons are small and positioned at edges (top/bottom center)
3. Users can easily close popup (X button) or click elsewhere if overlap occurs
4. The photos and content remain fully visible and functional

**Affected Venues:** Edge markers in less-populated regions (Las Vegas, Boston, isolated venues)

---

## Potential Solutions

### Option 1: Increase Map Container Z-Index

Change map container from `z-0` to `z-[500]`.

**Pros:**
- Simple one-line change
- Popups would appear above all navigation

**Cons:**
- Could break other scene overlays (title, tabs, stats, hint)
- May affect navigation when map is inactive
- Requires extensive testing across all 5 scenes

**Risk:** Medium

### Option 2: React Portal for Popups

Render popup content outside Leaflet's DOM tree using React Portals.

**Pros:**
- Complete control over z-index stacking
- Popups can use React components directly

**Cons:**
- High complexity - need to replicate Leaflet's positioning logic
- May break Leaflet's built-in popup behaviors (auto-pan, close on map click)
- Significant refactor required

**Risk:** High

### Option 3: Dynamic Z-Index on Popup Open

Temporarily increase map container z-index when popup opens, reset when closed.

**Pros:**
- Only affects stacking when popup is active
- Preserves default behavior when map is inactive

**Cons:**
- Requires event listeners on all popups
- May cause z-index flickering
- Edge cases with multiple popups

**Risk:** Medium

---

## Recommendation

**Accept current behavior** as reasonable UX trade-off. If prioritized in future:

1. Try **Option 1** first (safest, easiest to revert)
2. Test exhaustively across all scenes
3. Only proceed to Option 2/3 if Option 1 breaks something critical

---

## Testing Checklist (if implemented)

- [ ] Popup appears above nav buttons (top and bottom)
- [ ] Scene title/tabs remain properly layered
- [ ] "Tap to explore" hint still visible when map inactive
- [ ] Stats overlay (bottom) not covered by map
- [ ] No z-index issues in other scenes (Timeline, Venues, Genres, Artists)
- [ ] Map activation/deactivation doesn't cause flickering
- [ ] Mobile/tablet layouts unaffected

---

*Documented: 2026-01-03*
*Decision: Accept current behavior (low priority to fix)*
