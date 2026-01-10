# Venue Name Change Detection & Management CLI

> **Status**: Planned
> **Priority**: Medium
> **Effort**: Medium (pipeline enhancement + CLI tool)
> **Related**: [map-renamed-venue-badges.md](map-renamed-venue-badges.md)
> **Category**: Data Pipeline Automation
> **Last Updated**: 2026-01-07

---

## Problem Statement

Venues sometimes change names, but we have no automated way to detect this. Currently, we rely on manual research to identify and document renamed venues in `venue-status.csv`.

### Scenarios to Handle

**Scenario 1: Historical Name in Google Sheet**
- Sheet has "Staples Center" (old name)
- Google Places API returns "Crypto.com Arena" (current name)
- Pipeline should detect mismatch and flag for review

**Scenario 2: Name Changed Since Last Build**
- Previous build: "Staples Center" matched Places API
- Current build: Places API now returns "Crypto.com Arena"
- Pipeline should detect change and flag for review

---

## Current State

### Data Available from Google Places API

The `PlaceDetails` interface already includes the current official name:

```typescript
interface PlaceDetails {
  id: string
  displayName: {
    text: string        // ← Current official name
    languageCode: string
  }
  formattedAddress?: string
  // ... other fields
}
```

**Example:**
- Query: "Staples Center, Los Angeles, California"
- Returns: `displayName.text = "Crypto.com Arena"`

### Current Pipeline Behavior

[scripts/enrich-venues.ts](../../scripts/enrich-venues.ts) fetches Places data but **does not compare** the returned name with the venue name from concerts.json:

```typescript
const placeDetails = await getVenuePlaceDetails(
  venue.name,           // ← "Staples Center" (from our data)
  venue.city,
  venue.state,
  venue.location?.lat,
  venue.location?.lng
)

// placeDetails.displayName.text might be "Crypto.com Arena"
// But we never check if they match!
```

---

## Proposed Solution

### Automatic Name Change Detection

Add a validation step in `enrich-venues.ts` that:

1. **Compares venue names** (fuzzy matching)
   - Sheet name: "Staples Center"
   - Places API name: "Crypto.com Arena"
   - Detect: Name mismatch!

2. **Checks venue-status.csv**
   - Is this venue already marked as `renamed`?
   - If yes: No action needed (already documented)
   - If no: Flag for review

3. **Outputs report**
   - Console warning during build
   - Optional: Write to `data/venue-name-changes-detected.json`
   - Human reviews and updates `venue-status.csv`

### Fuzzy Matching Strategy

Exact string comparison won't work due to variations:
- "The Forum" vs "Forum"
- "Hollywood Bowl" vs "Hollywood Bowl Amphitheatre"
- "Staples Center" vs "Crypto.com Arena" (actual rename)

**Approach:**
- Calculate similarity score (Levenshtein distance or similar)
- Threshold: < 70% similarity = potential rename
- Ignore minor differences (articles, suffixes)

### Output Format

**Console Output During Build:**
```
🔍 Venue Name Change Detection
============================================================

⚠️  Potential venue name changes detected:

  Staples Center (Los Angeles, California)
    → Google Places returns: "Crypto.com Arena"
    → Similarity: 25%
    → Status: active (not marked as renamed)
    → Action: Review and update venue-status.csv if confirmed

  Universal Amphitheater (Los Angeles, California)
    → Google Places returns: "Universal Amphitheatre"
    → Similarity: 95%
    → Status: active
    → Action: Minor spelling variation (may be safe to ignore)

============================================================
✅ 2 potential name changes detected
   Review: data/venue-name-changes-detected.json
```

**JSON Report File:**
```json
{
  "generatedAt": "2026-01-05T21:30:00Z",
  "detectedChanges": [
    {
      "venueInData": "Staples Center",
      "venueInPlaces": "Crypto.com Arena",
      "city": "Los Angeles",
      "state": "California",
      "similarityScore": 0.25,
      "currentStatus": "active",
      "placeId": "ChIJ...",
      "action": "review_rename",
      "suggestedUpdate": {
        "status": "renamed",
        "closedDate": null,
        "notes": "Renamed Crypto.com Arena"
      }
    }
  ]
}
```

---

## Implementation Plan

### Phase 1: Detection Logic

**File:** `scripts/utils/venue-name-matcher.ts` (new)

```typescript
/**
 * Normalize venue name for comparison
 * - Remove articles (The, A, An)
 * - Remove punctuation
 * - Lowercase
 * - Trim whitespace
 */
export function normalizeForComparison(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, '')  // Remove leading articles
    .replace(/[^\w\s]/g, '')          // Remove punctuation
    .replace(/\s+/g, ' ')             // Collapse whitespace
    .trim()
}

/**
 * Calculate similarity between two venue names
 * Returns score 0-1 (1 = identical)
 */
export function calculateSimilarity(name1: string, name2: string): number {
  const norm1 = normalizeForComparison(name1)
  const norm2 = normalizeForComparison(name2)

  // Use Levenshtein distance or similar algorithm
  // For now, simple approach:
  if (norm1 === norm2) return 1.0

  // TODO: Implement fuzzy matching (Levenshtein, Jaro-Winkler, etc.)
  // For MVP, just check if one contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return 0.8
  }

  return 0.0
}

/**
 * Determine if venue name mismatch indicates a rename
 */
export function isPotentialRename(
  venueName: string,
  placesName: string,
  threshold: number = 0.7
): boolean {
  const similarity = calculateSimilarity(venueName, placesName)
  return similarity < threshold
}
```

### Phase 2: Integration into enrich-venues.ts

```typescript
import { isPotentialRename, calculateSimilarity } from './utils/venue-name-matcher.js'

interface NameChangeDetection {
  venueInData: string
  venueInPlaces: string
  city: string
  state: string
  similarityScore: number
  currentStatus: string
  placeId: string
  action: 'review_rename' | 'review_spelling' | 'confirmed_renamed'
}

const detectedChanges: NameChangeDetection[] = []

// Inside the venue enrichment loop:
if (placeDetails) {
  const placesName = placeDetails.displayName.text
  const similarity = calculateSimilarity(venue.name, placesName)

  // Check if names don't match
  if (isPotentialRename(venue.name, placesName)) {
    const isAlreadyDocumented = status?.status === 'renamed'

    if (!isAlreadyDocumented) {
      detectedChanges.push({
        venueInData: venue.name,
        venueInPlaces: placesName,
        city: venue.city,
        state: venue.state,
        similarityScore: similarity,
        currentStatus: status?.status || 'active',
        placeId: placeDetails.id,
        action: similarity < 0.3 ? 'review_rename' : 'review_spelling'
      })

      console.warn(`  ⚠️  Name mismatch: "${venue.name}" → "${placesName}" (${Math.round(similarity * 100)}%)`)
    } else {
      // Already documented as renamed - verify notes match
      const expectedNewName = status.notes?.replace(/^Renamed\s+/i, '')
      if (expectedNewName !== placesName) {
        console.warn(`  ⚠️  Renamed venue notes may be outdated:`)
        console.warn(`      Notes say: "${expectedNewName}"`)
        console.warn(`      Places says: "${placesName}"`)
      }
    }
  }
}
```

### Phase 3: Report Generation

```typescript
// After all venues processed
if (detectedChanges.length > 0) {
  console.log('\n🔍 Venue Name Change Detection')
  console.log('============================================================\n')
  console.log(`⚠️  Potential venue name changes detected:\n`)

  detectedChanges.forEach(change => {
    console.log(`  ${change.venueInData} (${change.city}, ${change.state})`)
    console.log(`    → Google Places returns: "${change.venueInPlaces}"`)
    console.log(`    → Similarity: ${Math.round(change.similarityScore * 100)}%`)
    console.log(`    → Status: ${change.currentStatus}`)
    console.log(`    → Action: ${change.action === 'review_rename' ? 'Review and update venue-status.csv' : 'Minor variation (may ignore)'}`)
    console.log('')
  })

  // Write JSON report
  const reportPath = path.join(__dirname, '../data/venue-name-changes-detected.json')
  fs.writeFileSync(reportPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    detectedChanges
  }, null, 2))

  console.log('============================================================')
  console.log(`✅ ${detectedChanges.length} potential name change(s) detected`)
  console.log(`   Review: data/venue-name-changes-detected.json\n`)
}
```

---

## Edge Cases & Considerations

### 1. Minor Spelling Variations
**Example:** "Hollywood Bowl" vs "Hollywood Bowl Amphitheatre"

**Solution:**
- Set similarity threshold at 70%
- Flag as `review_spelling` (lower priority)
- User can ignore or update sheet for consistency

### 2. Multiple Renames
**Example:** Nokia Center → Microsoft Theater → Peacock Theater

**Solution:**
- Compare Places name against `notes` field
- If mismatch, warn that notes may be outdated
- User updates notes to reflect latest name

### 3. False Positives
**Example:** Venue moved to new location with similar name

**Solution:**
- Use `placeId` to track venue identity over time
- If `placeId` changed, it's a different venue (not a rename)
- Store `placeId` in venues-metadata for comparison

### 4. API Returns Wrong Match
**Example:** Search for small club, API returns similarly named arena

**Solution:**
- Use location bias (already implemented)
- Check venue type from Places API (`types` field)
- Manual review catches mismatches

---

## User Workflow

### When Name Change Detected

1. **Pipeline runs** → Detects "Staples Center" → "Crypto.com Arena"
2. **Console warning** during `npm run build-data`
3. **JSON report** written to `data/venue-name-changes-detected.json`
4. **Developer reviews** report
5. **Developer updates** `venue-status.csv`:
   ```csv
   Staples Center,Los Angeles,California,renamed,2021-12-25,Renamed Crypto.com Arena
   ```
6. **Next pipeline run** → No warning (now documented)

### Optional: Auto-Apply Flag

Add `--auto-apply-renames` flag to automatically update `venue-status.csv`:

```bash
npm run enrich-venues -- --auto-apply-renames
```

**Risk:** Could incorrectly mark venues as renamed if API returns wrong match.

**Mitigation:**
- Require high confidence threshold (similarity < 30%)
- Generate PR for review instead of direct commit
- Manual approval still required

---

## Benefits

### Scenario 1: Historical Data
✅ Automatically detects when Google Sheet has outdated venue names
✅ Prompts developer to update venue-status.csv
✅ Improves data accuracy over time

### Scenario 2: Future Changes
✅ Catches venue renames that happen after initial data entry
✅ No need to manually monitor venues for name changes
✅ Pipeline self-heals with minimal human intervention

### Additional Benefits
- Improves data quality proactively
- Reduces manual research time
- Catches typos and spelling inconsistencies
- Provides audit trail of venue name evolution

---

## Performance Impact

### API Quota
**No additional cost** - We're already fetching `displayName` field

### Build Time
**Minimal** - Just string comparison logic (~10ms per venue)

### False Positive Rate
**Expected:** 5-10% (spelling variations, article differences)
**Acceptable:** Developer reviews report and ignores non-issues

---

## Testing Strategy

### Test Cases

1. **Exact match** → No warning
   - "Hollywood Bowl" → "Hollywood Bowl"

2. **Minor variation** → Low-priority warning
   - "The Forum" → "Forum" (95% similar)

3. **Confirmed rename** → High-priority warning
   - "Staples Center" → "Crypto.com Arena" (25% similar)

4. **Already documented** → No warning
   - Status CSV has `renamed`, notes match Places name

5. **Outdated documentation** → Warning
   - Status CSV says "Microsoft Theater"
   - Places API says "Peacock Theater"

### Manual Testing

Run enrichment on known renamed venues:
- Staples Center (renamed 2021)
- Nokia Center (renamed 2015)
- Universal Amphitheater (demolished/rebuilt)

Verify detection and report accuracy.

---

## Implementation Phases

### Phase 1: MVP (Detection Only)
- Add name comparison logic
- Console warnings during build
- No JSON report yet
- No auto-update

**Effort:** Small (~2 hours)

### Phase 2: Report Generation
- JSON report output
- Suggested actions
- Integration with validation script

**Effort:** Small (~1 hour)

### Phase 3: Enhanced Matching
- Implement fuzzy string matching library
- Tune similarity thresholds
- Add venue type checking

**Effort:** Medium (~3 hours)

### Phase 4: Auto-Update (Optional)
- `--auto-apply-renames` flag
- PR generation workflow
- Integration with CI/CD

**Effort:** Medium (~4 hours)

---

## Alternative Approaches

### Option A: Manual Monitoring
**Current approach** - Rely on manual research

**Pros:** No code needed
**Cons:** Time-consuming, error-prone, reactive

### Option B: Periodic Review Script
Separate script runs quarterly to check for changes

**Pros:** Doesn't slow down regular builds
**Cons:** Less timely, requires scheduled task

### Option C: Real-time Webhook
Google My Business API webhook for venue updates

**Pros:** Immediate notification
**Cons:** Complex setup, requires Google My Business access

**Recommendation:** Proceed with proposed solution (automatic detection during enrichment)

---

---

## Interactive CLI Tool

### Overview

Provide a guided CLI interface for managing venue status changes, making it easy to:
- Review detected name changes
- Update venue-status.csv correctly
- Trigger appropriate rebuild steps
- Maintain data consistency

### Commands

#### 1. `npm run venue-review`
**Purpose:** Process detected venue name changes interactively

**Workflow:**
1. Loads `data/venue-name-changes-detected.json` (if exists)
2. Presents each detected change one-by-one
3. Guides user through decision process
4. Updates `venue-status.csv` automatically
5. Shows next steps (rebuild commands)

**Example Session:**
```bash
$ npm run venue-review

🔍 Venue Change Review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Found 2 potential venue name changes to review.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Change 1 of 2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Current name in data: Staples Center
  Name from Google:     Crypto.com Arena
  Location:             Los Angeles, California
  Similarity:           25%
  Current status:       active

◇  Is this a venue name change?
│  ● Yes, the venue was renamed
│  ○ No, this is a different venue
│  ○ Ignore (false positive)
└

◇  When was the venue renamed?
│  2021-12-25
└

◇  What is the new name?
│  Crypto.com Arena
└

✅ Updated venue-status.csv:
   Staples Center,Los Angeles,California,renamed,2021-12-25,Renamed Crypto.com Arena

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Change 2 of 2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Current name in data: Universal Amphitheater
  Name from Google:     Universal Amphitheatre
  Location:             Los Angeles, California
  Similarity:           95%
  Current status:       active

◇  Is this a venue name change?
│  ○ Yes, the venue was renamed
│  ○ No, this is a different venue
│  ● Ignore (false positive)
└

⊙ Skipped (spelling variation)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Processed 2 changes
   • Updated: 1 venue
   • Skipped: 1 venue

📝 Next steps:
   1. Review changes: git diff data/venue-status.csv
   2. Rebuild venue metadata: npm run enrich-venues
   3. Commit changes: git add data/venue-status.csv public/data/venues-metadata.json

◇  Run venue enrichment now?
│  ● Yes, run npm run enrich-venues
│  ○ No, I'll run it manually later
└

⠋ Running venue enrichment...
```

#### 2. `npm run venue-update`
**Purpose:** Manually update venue status (not from detection report)

**Workflow:**
1. Search for venue by name (fuzzy search)
2. Show current status
3. Prompt for updates
4. Update venue-status.csv
5. Show next steps

**Example Session:**
```bash
$ npm run venue-update

🏛️  Venue Status Update
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◇  Search for venue:
│  staples
└

Found 1 matching venue:

  Staples Center
  Los Angeles, California
  Status: renamed (2021-12-25)
  Notes: Renamed Crypto.com Arena

◇  What would you like to update?
│  ○ Change status (renamed → closed, demolished, etc.)
│  ● Update rename date
│  ○ Update notes
│  ○ Mark as active (undo rename)
│  ○ Cancel
└

◇  New rename date (YYYY-MM-DD):
│  2021-12-24
└

✅ Updated venue-status.csv

📝 Changes made:
   Staples Center: closedDate changed from 2021-12-25 → 2021-12-24

◇  Rebuild venue metadata now?
│  ● Yes, run npm run enrich-venues
│  ○ No, I'll run it manually later
└
```

#### 3. `npm run venue-add`
**Purpose:** Add new venue to venue-status.csv

**Workflow:**
1. Prompt for venue details
2. Validate against concerts.json
3. Add to venue-status.csv
4. Show next steps

**Example Session:**
```bash
$ npm run venue-add

➕ Add New Venue Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◇  Venue name:
│  The Roxy Theatre
└

◇  City:
│  West Hollywood
└

◇  State:
│  California
└

⚠️  Warning: "The Roxy Theatre, West Hollywood, California" not found in concerts.json
   Add it anyway?
   ● Yes
   ○ No, cancel

◇  Status:
│  ● active
│  ○ closed
│  ○ demolished
│  ○ renamed
└

✅ Added to venue-status.csv

◇  Fetch venue data from Google Places?
│  ● Yes, run npm run enrich-venues
│  ○ No, I'll run it manually later
└
```

### Implementation Details

#### Technology Stack
- **CLI Framework:** `@clack/prompts` (modern, beautiful UX)
- **File Format:** `csv-parse` and `csv-stringify` for CSV handling
- **Fuzzy Search:** `fuse.js` for venue name matching
- **Validation:** Built-in checks against concerts.json

#### File Structure
```
scripts/
├── cli/
│   ├── venue-review.ts       # npm run venue-review
│   ├── venue-update.ts       # npm run venue-update
│   ├── venue-add.ts          # npm run venue-add
│   └── utils/
│       ├── venue-search.ts   # Fuzzy search logic
│       ├── csv-handler.ts    # Read/write venue-status.csv
│       └── prompts.ts        # Reusable prompt components
```

#### CSV Handling

**Safe Update Process:**
1. Read current venue-status.csv
2. Parse into memory
3. Apply changes
4. Validate format (no syntax errors)
5. Write to temp file
6. Atomic rename (prevents corruption)
7. Create backup: `venue-status.csv.backup.TIMESTAMP`

**Validation Rules:**
- No duplicate venue+city+state combinations
- Dates must be YYYY-MM-DD format
- Status must be: active, closed, demolished, renamed
- Notes with commas must be quoted
- All required fields present

#### Git Integration

**No Auto-Commit:** CLI shows commands but doesn't run them

**Example Output:**
```bash
✅ Changes saved to venue-status.csv

📝 Next steps:

   # Review your changes:
   git diff data/venue-status.csv

   # Rebuild venue metadata:
   npm run enrich-venues

   # Stage changes:
   git add data/venue-status.csv public/data/venues-metadata.json

   # Commit:
   git commit -m "data: Update venue status for Staples Center"

◇  Copy these commands to clipboard?
│  ● Yes
│  ○ No
└
```

#### Rebuild Integration

**Smart Recommendations:**

| Change Type | Recommended Command | Auto-run? |
|-------------|---------------------|-----------|
| Status update only | `npm run enrich-venues` | Prompt user |
| Name change detected | `npm run enrich-venues` | Prompt user |
| New venue added | `npm run enrich-venues` | Prompt user |
| Multiple changes | `npm run build-data` | Prompt user |

**Prompt Options:**
- ✅ **Yes, run now** - Execute command immediately
- ⏸️ **No, show me the command** - Display but don't run
- 🚫 **Skip for now** - Continue without rebuild

### User Experience Highlights

#### Visual Design
- **Icons:** Use emojis for visual scanning (🔍 ✅ ⚠️ ⊙ ◇)
- **Colors:** Green (success), yellow (warning), red (error), cyan (info)
- **Boxes:** Draw clear sections with Unicode borders
- **Progress:** Show "X of Y" when processing multiple items

#### Error Handling
- **Invalid dates:** Suggest correct format with example
- **Missing fields:** Prompt for required information
- **Duplicate entries:** Warn and offer to update existing
- **CSV syntax errors:** Auto-quote fields with commas

#### Keyboard Shortcuts
- **Arrow keys:** Navigate options
- **Enter:** Confirm selection
- **Ctrl+C:** Cancel operation (safe - no partial writes)
- **Tab:** Autocomplete venue names

### Testing Strategy

#### Manual Test Cases
1. **Happy path:** Detect rename → Review → Update CSV → Rebuild
2. **Skip/Ignore:** Review changes, skip all
3. **Manual update:** Search venue → Change status → Save
4. **Add new venue:** Not in concerts.json → Add anyway
5. **Invalid input:** Bad date format → Error + retry
6. **Corrupted CSV:** Malformed file → Backup + fix
7. **Ctrl+C:** Cancel mid-operation → No changes saved

#### Integration Tests
```bash
# Test venue-review with mock detection report
npm run test:cli:review

# Test venue-update with mock venues
npm run test:cli:update

# Test CSV handling
npm run test:csv-handler
```

---

## Related Documentation

- [map-renamed-venue-badges.md](map-renamed-venue-badges.md) - Frontend display of renamed venues
- [DATA_PIPELINE.md](../../DATA_PIPELINE.md#workflow-venue-photo-integration) - Venue enrichment workflow
- [venue-status.csv](../../../data/venue-status.csv) - Manual venue status tracking

---

## Success Metrics

### Detection
- [ ] Detects all 4 known renamed venues in test data
- [ ] False positive rate < 10%
- [ ] Build time impact < 5%
- [ ] Zero additional API costs

### CLI Tool
- [ ] Review workflow completes in < 3 minutes for 10 changes
- [ ] Zero data corruption incidents
- [ ] CSV format always valid after updates
- [ ] User can complete task without reading docs

---

*Last updated: 2026-01-05*
