# Mobile Optimization Spec

**Status:** Deferred to v1.1
**Priority:** High
**Dependencies:** None

## Overview

Mobile-specific optimizations deferred from v1.0 release.

## Deferred Items

### Artist Scene - Mobile Bottom Sheet
- Replace gatefold animation with slide-up bottom sheet on viewports <768px
- 70vh initial height, draggable to 90vh
- Swipe down or tap backdrop to close
- Concert history + Spotify panels stacked vertically
- Reference: [artist-scene.md](../implemented/artist-scene.md) (Mobile Design section)

### Map Scene - Touch Refinements
- Touch interactions enabled in code (touchZoom, dragging)
- Needs testing on actual iOS and Android devices
- May need pinch gesture indicators
- Hint prominence adjustments for no-hover state

### General Mobile Testing
- Test all 5 scenes on iOS Safari and Android Chrome
- Verify snap scrolling behavior
- Ensure touch targets meet 44px minimum
- Test landscape orientation

## Success Criteria

1. All scenes functional on mobile devices
2. Touch interactions feel native
3. No horizontal scroll or overflow issues
4. Readable text without zooming
5. Performant animations (no jank)

## References

- [Scene Design Guide](../../design/scene-design-guide.md)
- [Map Interaction Spec](../implemented/map-interaction.md)
