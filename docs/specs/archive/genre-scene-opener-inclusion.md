# Genre Scene: Include Opener Appearances in Artist Segments

## Overview

Enhance the Genre Scene sunburst chart to include both headliner and opener appearances when calculating and displaying artist segments within each genre, providing a more complete view of musical exposure.

## Current State

**Genre Sunburst Behavior:**
- Artist segments are sized based only on headliner appearances
- Drill-down shows only concerts where the artist was the headliner
- Opener appearances are not reflected in genre visualization

**Example Current Logic:**
- If "Book of Love" headlined 2 shows and opened for 3 shows → segment shows 2 appearances
- Missing the 3 opener appearances in genre representation

## Proposed Enhancement

### Updated Segment Sizing
- **Include all appearances**: Count both headliner and opener performances for segment sizing
- **Maintain show stats**: Center donut statistics (total shows attended) remain unchanged
- **Single appearance handling**: Group artists with only 1 total appearance into "Other" segments

### Data Aggregation Logic

#### Artist Appearance Calculation
```typescript
// Current: Only headliner appearances
const artistCounts = concerts.filter(c => c.headliner === artistName).length

// Proposed: Headliner + opener appearances  
const headlinerCount = concerts.filter(c => c.headliner === artistName).length
const openerCount = concerts.filter(c => c.openers.includes(artistName)).length
const totalAppearances = headlinerCount + openerCount
```

#### Segment Grouping Strategy
- **2+ appearances**: Individual artist segment 
- **1 appearance**: Grouped into "Other" segment per genre
- **"Other" drill-down**: Shows list of all single-appearance artists

### Visual Design

#### Sunburst Segments
- **No visual differentiation**: Headliner vs. opener appearances not distinguished in segments
- **Segment sizing**: Based on total appearance count (headliner + opener)
- **"Other" segment styling**: Consistent with other segments, possibly with subtle visual indicator

#### Drill-Down Experience
- **Artist segments**: Show all concerts (headliner + opener) chronologically
- **"Other" segment drill-down**: Grid/list view of single-appearance artists
- **Concert detail**: Existing concert card format, no headliner/opener distinction needed

### Technical Implementation

#### Data Processing Pipeline
```typescript
interface ArtistGenreData {
  artist: string
  genre: string
  headlinerCount: number
  openerCount: number
  totalCount: number
  concerts: Concert[]
}

// Aggregate appearances across both roles
const processGenreData = (concerts: Concert[], genre: string) => {
  const artistMap = new Map<string, ArtistGenreData>()
  
  // Process headliner appearances
  concerts
    .filter(c => c.genre === genre)
    .forEach(concert => {
      updateArtistCount(artistMap, concert.headliner, concert, 'headliner')
      
      // Process opener appearances  
      concert.openers.forEach(opener => {
        updateArtistCount(artistMap, opener, concert, 'opener')
      })
    })
  
  return groupSingleAppearances(artistMap)
}
```

#### Component Updates
```
Scene5Genres/
├── GenreSunburst.tsx          # Updated segment sizing logic
├── GenreDrillDown.tsx         # Handle "Other" segment drill-down
├── OtherArtistsList.tsx       # New: Single-appearance artist list
└── useGenreData.ts            # Updated: Include opener aggregation
```

### User Experience Flow

1. **Initial View**: Sunburst reflects total artist exposure per genre
2. **Segment Click**: Shows all concerts for that artist (headliner + opener)
3. **"Other" Click**: Shows grid of single-appearance artists in that genre
4. **Single Artist Click**: Shows their one concert appearance

### Data Structure Requirements

**Existing Concert Structure** (✅ Already Available):
```json
{
  "headliner": "Depeche Mode",
  "openers": ["Animotion", "Book of Love"],
  "genre": "New Wave"
}
```

**No Data Changes Required**: Current concert.json structure supports this enhancement.

### Visual Impact Analysis

#### Potential Benefits
- **More accurate representation**: Genre exposure includes opener discoveries
- **Discovery insights**: See which genres led to discovering new artists as openers
- **Complete musical picture**: Better reflects actual exposure to artists per genre

#### Potential Challenges  
- **Segment proliferation**: More artists per genre could create visual clutter
- **"Other" segment size**: Could become large in genres with many one-time openers
- **Performance**: Slight increase in data processing for aggregation

### Success Metrics

- **Accuracy**: Genre segments reflect actual artist exposure (headliner + opener)
- **Usability**: "Other" segments remain navigable and informative
- **Performance**: No noticeable impact on sunburst rendering speed
- **Insights**: Users discover patterns in opener exposure across genres

## Implementation Considerations

### Phase 1: Core Functionality
- Update data aggregation to include opener appearances
- Implement "Other" segment grouping logic
- Update existing drill-down to show all concerts

### Phase 2: Enhanced UX
- Design "Other" segment drill-down interface
- Add single-appearance artist grid component  
- Optimize performance for larger datasets

### Phase 3: Analytics & Insights
- Add hover details showing headliner vs. opener breakdown
- Implement genre comparison features
- Export functionality for discovery insights

## Priority

**Medium** - This enhancement provides valuable insights into musical discovery patterns but is not critical for core functionality.

## Dependencies

- No additional data requirements
- Minor performance optimization for larger opener datasets
- UI/UX design for "Other" segment interaction

## Related Enhancements

- **Timeline Artist Display Enhancement** (timeline-artist-display-enhancement.md) - Artist exploration workflows
- **Mobile Optimization** (mobile-optimization.md) - Touch interactions for small segments
- **Visual Testing Suite** (global-visual-testing-suite.md) - Sunburst interaction testing

---

*Added: v1.0.0+*  
*Priority: Medium*  
*Estimated effort: 1-2 weeks*  
*Decision: Pending user review and approval*