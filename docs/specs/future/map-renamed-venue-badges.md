# Renamed Venue Display Enhancement

> **Status**: Planned
> **Priority**: Medium
> **Effort**: Small (frontend-only change)
> **Target Scene**: Geography (Scene 3 - Map)
> **Last Updated**: 2026-01-07

---

## Problem Statement

Venues that have been renamed (e.g., "Staples Center" → "Crypto.com Arena") currently display with the same badge as closed venues (🏛️ **Closed YYYY**), which is misleading since they're still operating under a new name.

The venue metadata already includes:
- `status: "renamed"`
- `closedDate: "YYYY-MM-DD"` (date of rename)
- `notes: "Renamed New Name"` (new venue name)

However, this information is not surfaced in the UI, causing confusion about the venue's current status.

---

## Current Behavior

**Example: Staples Center (renamed 2021-12-25)**

Map popup shows:
- **Staples Center**
- Los Angeles, California
- 🏛️ **Closed 2021**
- 1 concert

**Issues:**
1. ❌ "Closed" badge implies venue no longer operates
2. ❌ New name (Crypto.com Arena) is stored in `notes` but hidden
3. ❌ Users cannot discover what happened to the venue

---

## Proposed Solution

### Display Pattern: Two-Line Badge with New Name

Update map popups for `status: "renamed"` venues to show:

- **Staples Center**
- Los Angeles, California
- ♻️ **Renamed 2021**
  - _Now: Crypto.com Arena_
- 1 concert

**Key Changes:**
1. ✅ Use ♻️ icon (recycle/refresh) to indicate name change
2. ✅ Show "Renamed YYYY" label (not "Closed")
3. ✅ Parse and display new name from `notes` field on second line
4. ✅ Use "Now:" prefix with italic/muted styling for clarity
5. ✅ Prevent text wrapping issues by using block layout

### Visual Mockups
See [renamed-venue-mockups.html](renamed-venue-mockups.html) for interactive comparison of all design options.

**Design Decision:** ✅ **Option A (Two-Line Block)** selected for implementation
- Best handles long venue names without wrapping
- Mobile-friendly and readable at all viewport sizes
- Clear visual hierarchy between status and new name
- Only minor vertical space cost (~12px)

---

## Implementation Details

### Code Location
[src/components/scenes/Scene3Map.tsx:168-175](../../../src/components/scenes/Scene3Map.tsx#L168-L175)

### Current Code
```typescript
// Legacy badge logic
let legacyBadge = ''
if (venue?.status && venue.status !== 'active') {
  const icon = venue.status === 'demolished' ? '🔨' : '🏛️'
  const label = venue.status === 'demolished' ? 'Demolished' : 'Closed'
  const year = venue.closedDate ? ` ${venue.closedDate.split('-')[0]}` : ''
  legacyBadge = `<div class="venue-popup-badge">${icon} ${label}${year}</div>`
}
```

### Proposed Code
```typescript
// Legacy/status badge logic
let legacyBadge = ''
if (venue?.status && venue.status !== 'active') {
  let icon = '🏛️'
  let label = 'Closed'
  let suffix = ''

  if (venue.status === 'demolished') {
    icon = '🔨'
    label = 'Demolished'
  } else if (venue.status === 'renamed') {
    icon = '♻️'
    label = 'Renamed'

    // Extract new name from notes (format: "Renamed New Name")
    const newName = venue.notes?.replace(/^Renamed\s+/i, '') || ''
    if (newName) {
      suffix = ` → <span style="font-style: italic; color: #9ca3af;">${newName}</span>`
    }
  }

  const year = venue.closedDate ? ` ${venue.closedDate.split('-')[0]}` : ''
  legacyBadge = `<div class="venue-popup-badge">${icon} ${label}${year}${suffix}</div>`
}
```

---

## Visual Design

### Icon Choices
- ♻️ **Recycle** (recommended) - Suggests transformation/renewal
- 🔄 **Arrows** - Indicates change/rotation
- 📝 **Memo** - Document/name change
- 🏷️ **Label** - Re-tagging/renaming

### Badge Styling
```css
.venue-popup-badge {
  /* Existing styles preserved */
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.05);
}

/* New name (italic, muted) */
.venue-popup-badge span[style*="italic"] {
  font-size: 10px;
  margin-left: 2px;
}
```

---

## Affected Venues

Based on [data/venue-status.csv](../../../data/venue-status.csv):

| Venue | City | Renamed | New Name |
|-------|------|---------|----------|
| The Celebrity Theatre | Anaheim, CA | 2008 | City National Grove of Anaheim |
| The Galaxy Theatre | Santa Ana, CA | 2011 | The Observatory |
| Staples Center | Los Angeles, CA | 2021 | Crypto.com Arena |
| Nokia Center | Los Angeles, CA | 2015 | Microsoft Theater (now Peacock Theater) |

**Total Impact:** 4 venues (5% of 77 total venues)

---

## Data Requirements

### venue-status.csv Format
Already supported:
```csv
venue,city,state,status,closed_date,notes
Staples Center,Los Angeles,California,renamed,2021-12-25,Renamed Crypto.com Arena
```

**Important:** Notes field must:
1. Start with "Renamed " (case-insensitive)
2. Be properly quoted if it contains commas
3. Include only the new venue name (no additional text)

### venues-metadata.json Structure
Already present:
```json
{
  "staples-center": {
    "status": "renamed",
    "closedDate": "2021-12-25",
    "notes": "Renamed Crypto.com Arena",
    // ... other fields
  }
}
```

---

## Edge Cases & Considerations

### 1. Multiple Renames
**Example:** Nokia Center → Microsoft Theater → Peacock Theater

**Current format:** `"Renamed Microsoft Theater (now Peacock Theater)"`

**Handling:**
- Display full notes text as-is
- Don't try to parse complex rename chains
- User sees: ♻️ **Renamed 2015** → _Microsoft Theater (now Peacock Theater)_

### 2. Missing Notes
If `status: "renamed"` but `notes` is empty:
- Show: ♻️ **Renamed 2015**
- Don't show arrow or new name

### 3. Active Venues with Former Names
**Example:** Kia Forum has `notes: "Formerly The Forum and Staples Center"`

**Current status:** `active` (not `renamed`)

**No change needed** - This is correctly using notes for historical context without a status change.

---

## Testing Checklist

- [ ] Renamed venues show ♻️ icon (not 🏛️)
- [ ] Badge displays "Renamed YYYY" (not "Closed")
- [ ] New name appears in italics after arrow
- [ ] Demolished venues still show 🔨 Demolished
- [ ] Closed venues still show 🏛️ Closed
- [ ] Active venues show no badge
- [ ] Multi-rename text displays correctly
- [ ] Missing notes gracefully handled
- [ ] Mobile viewport renders badge correctly
- [ ] Popup remains properly sized with longer text

---

## Future Enhancements

### Phase 2: Deep Linking to New Venue
When clicking a renamed venue, optionally navigate to the new venue's node in the Venue Network scene (if it exists as a separate entry).

**Example:**
- Click "Staples Center" → Navigate to venue network
- Show both "Staples Center" (historical) and "Crypto.com Arena" (current) nodes
- Visually connect them with a "renamed" edge

**Status:** Deferred (requires venue relationship metadata)

### Phase 3: Unified Venue Timeline
Show venue history in a single popup:
- **Crypto.com Arena** (2021-present)
- Previously: **Staples Center** (1999-2021)
- 15 total concerts across both names

**Status:** Deferred (requires venue merge/alias system)

---

## Questions & Considerations

1. **Should renamed venues fetch photos from Google Places API?**
   - Current: Treated as inactive, uses fallback images
   - Proposed: Treat as active, fetch photos using new name
   - Decision: Keep as inactive to avoid fetching wrong venue

2. **Should notes field be standardized?**
   - Current: Free-form text ("Renamed X", "Renamed X (now Y)")
   - Proposed: Structured format with strict parsing
   - Decision: Keep flexible, handle variations gracefully

3. **Icon choice - preference?**
   - ♻️ Recycle (transformation) ✅ **Recommended**
   - 🔄 Arrows (circular change)
   - 📝 Memo (documentation)
   - 🏷️ Label (tag/name)

---

## Success Metrics

- [ ] All 4 renamed venues display new badges correctly
- [ ] No visual regressions in other venue popups
- [ ] Users can identify venue name changes at a glance
- [ ] New name information accessible without leaving map

---

## Related Documentation

- [DATA_PIPELINE.md](../../DATA_PIPELINE.md#workflow-venue-photo-integration) - Venue status workflow
- [data/README.md](../../../data/README.md) - venue-status.csv format
- [data/example-venue-status.csv](../../../data/example-venue-status.csv) - Status reference

---

*Last updated: 2026-01-05*
