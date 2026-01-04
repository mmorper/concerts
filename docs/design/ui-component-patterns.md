# UI Component Patterns & Design System

**Version:** 1.0
**Last Updated:** January 2025
**Related:** [Scene Design Guide](./scene-design-guide.md) · [Color Specification](./color-specification.md)

---

## Overview

This document codifies the UI component patterns discovered through comprehensive cross-scene analysis. These patterns create visual hierarchy and consistent affordance across all interactive elements.

**Key Principle:** Different component types use different visual treatments to communicate their purpose at a glance.

---

## Component Categorization

### Primary Toggle Controls
**Purpose:** Scene-level state changes (sort order, view mode, filter toggle)
**Visual Treatment:** **Solid backgrounds**
**Examples:** Sort buttons (A-Z, Genre, Most Seen), View mode toggles, Region tabs

### Input Fields
**Purpose:** User text entry and search
**Visual Treatment:** **Glassmorphism (semi-transparent with backdrop blur)**
**Examples:** Search input, text fields (when added)

### Secondary/Utility Actions
**Purpose:** One-off actions, resets, navigation aids
**Visual Treatment:** **Glassmorphism (semi-transparent with backdrop blur)**
**Examples:** Reset view buttons, navigation overlays, close buttons

---

## Pattern Specifications

### Primary Toggle Controls (Solid Backgrounds)

**Why Solid?**
- Strong affordance ("these are important controls")
- Clear active/inactive states
- Anchor visual hierarchy
- Draw attention as primary interactions

#### Dark Scenes (Scenes 2, 3, 4 - Network, Map, Bands)

**Inactive State:**
```css
background: rgb(31, 41, 55);           /* bg-gray-800 */
color: rgb(156, 163, 175);             /* text-gray-400 */
border: none;
transition: background-color 200ms;
```

**Hover State:**
```css
background: rgb(55, 65, 81);           /* bg-gray-700 */
```

**Active State:**
```css
background: rgb(79, 70, 229);          /* bg-indigo-600 */
color: white;
```

**Implementation:**
```tsx
<button
  className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px] ${
    isActive
      ? 'bg-indigo-600 text-white'
      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
  }`}
>
  Button Text
</button>
```

#### Light Scenes (Scenes 1, 5, 6 - Timeline, Genres, Artists)

**Inactive State:**
```css
background: white;                     /* bg-white */
color: rgb(55, 65, 81);               /* text-gray-700 */
border: 1px solid rgb(209, 213, 219); /* border-gray-300 */
transition: background-color 200ms;
```

**Hover State:**
```css
background: rgb(243, 244, 246);       /* bg-gray-100 */
```

**Active State:**
```css
background: rgb(124, 58, 237);        /* bg-violet-600 */
color: white;
border: none;
```

**Implementation:**
```tsx
<button
  className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px] ${
    isActive
      ? 'bg-violet-600 text-white'
      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
  }`}
>
  Button Text
</button>
```

**Color Choice Rationale:**
- **Indigo-600** for dark scenes (cool, tech-forward)
- **Violet-600** for light scenes (warmer, more approachable)
- Different colors prevent visual monotony across scenes
- Both are vibrant enough for clear active state indication

---

### Input Fields (Glassmorphism)

**Why Glassmorphism?**
- Subtle, elegant treatment
- Blends with scene backgrounds
- Creates visual hierarchy (softer than solid buttons)
- Modern, premium feel
- Differentiates inputs from toggles

#### Dark Scenes

```css
background: rgba(255, 255, 255, 0.1);  /* bg-white/10 */
backdrop-filter: blur(8px);            /* backdrop-blur-sm */
border: 1px solid rgba(255, 255, 255, 0.2);
color: white;
placeholder: rgba(255, 255, 255, 0.6);
```

**Focus State:**
```css
border-color: rgb(192, 132, 252);      /* border-purple-400 */
box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.3);  /* ring-purple-500/30 */
```

**Implementation:**
```tsx
<input
  type="text"
  className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20
    rounded-lg text-white placeholder-white/60
    focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30
    transition-all duration-200"
  placeholder="Search..."
/>
```

#### Light Scenes

```css
background: rgba(255, 255, 255, 0.1);  /* bg-white/10 */
backdrop-filter: blur(8px);            /* backdrop-blur-sm */
border: 1px solid rgba(255, 255, 255, 0.2);
color: white;
placeholder: rgba(255, 255, 255, 0.6);
```

**Focus State:**
```css
border-color: rgb(192, 132, 252);      /* border-purple-400 */
box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.3);
```

**Implementation:**
```tsx
<input
  type="text"
  className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20
    rounded-lg text-white placeholder-white/60
    focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30
    transition-all duration-200"
  placeholder="Search artists..."
/>
```

**Note:** Light scenes still use white text on glassmorphism inputs because they appear over gradient overlays (darker backgrounds), not directly on the light scene background.

---

### Secondary Actions (Glassmorphism)

**Why Glassmorphism?**
- Less prominent than primary controls
- Doesn't compete with main interactions
- Feels like an "overlay" or "utility"
- Consistent with input fields (both are secondary UI)

#### Dark Scenes

```css
background: rgba(255, 255, 255, 0.1);  /* bg-white/10 */
backdrop-filter: blur(8px);            /* backdrop-blur-sm */
border: 1px solid rgba(255, 255, 255, 0.2);
color: white;
```

**Hover State:**
```css
background: rgba(255, 255, 255, 0.2);  /* bg-white/20 */
```

**Implementation:**
```tsx
<button
  className="px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20
    rounded-lg text-white font-sans text-sm font-medium
    hover:bg-white/20 transition-all duration-200 min-h-[44px]"
>
  Reset View
</button>
```

#### Light Scenes

```css
background: rgba(255, 255, 255, 0.8);  /* bg-white/80 */
backdrop-filter: blur(8px);            /* backdrop-blur-sm */
border: 1px solid rgb(209, 213, 219); /* border-gray-300 */
color: rgb(17, 24, 39);               /* text-gray-900 */
```

**Hover State:**
```css
background: white;                     /* bg-white */
```

**Implementation:**
```tsx
<button
  className="px-6 py-3 bg-white/80 backdrop-blur-sm border border-gray-300
    rounded-lg text-gray-900 font-sans text-sm font-medium
    hover:bg-white transition-all duration-200 shadow-sm min-h-[44px]"
>
  Reset View
</button>
```

---

## Cross-Scene Pattern Matrix

| Scene | Background | Primary Toggles | Input Fields | Secondary Actions |
|-------|------------|-----------------|--------------|-------------------|
| **1. Timeline** | Light (white) | N/A | N/A | N/A |
| **2. Venues** | Dark (gradient) | N/A | N/A | N/A |
| **3. Map** | Dark (gray-900) | Solid gray-800/indigo-600 | N/A | Glass white/10 |
| **4. Bands** | Dark (gradient) | Solid gray-800/indigo-600 | N/A | Glass white/10 |
| **5. Genres** | Light (violet-100) | N/A | N/A | Glass white/80 |
| **6. Artists** | Light (stone-50) | Solid white/violet-600 | Glass white/10 | N/A (future) |

---

## Design Rationale

### Why This System Works

1. **Visual Hierarchy**
   - Solid buttons = Primary actions (highest priority)
   - Glassmorphism = Secondary UI (inputs, utilities)
   - Creates instant recognition of component purpose

2. **Contextual Adaptation**
   - Dark scenes use darker solids (gray-800) + brighter glass (white/10)
   - Light scenes use lighter solids (white) + subtle glass (white/10 or white/80)
   - Both maintain the solid vs glass distinction

3. **Consistency Across Complexity**
   - Pattern holds true whether scene has 3 controls or 30
   - Scales to new scenes without modification
   - Future-proof for additional component types

4. **Accessibility**
   - Solid buttons have strong contrast (WCAG AAA)
   - Min-height 44px for all interactive elements (touch-friendly)
   - Focus states clearly visible (purple ring)

5. **Brand Coherence**
   - Purple accent family (purple-400, purple-500, violet-600)
   - Matches gradient overlays and scene transitions
   - Creates unified feel across disparate scenes

---

## Implementation Guidelines

### When to Use Solid Backgrounds

✅ **Use for:**
- Sort controls (A-Z, Genre, Most Seen)
- View mode toggles (Top 10 / All Venues)
- Filter toggles (checkboxes in MultiSelectFilter trigger button)
- Region tabs (All Regions, East Coast, etc.)
- Any control that changes scene-level state

❌ **Don't use for:**
- Search/text inputs
- Reset buttons
- Navigation aids (back, close)
- Temporary overlays

### When to Use Glassmorphism

✅ **Use for:**
- Search inputs
- Text input fields
- Reset/clear buttons
- Navigation overlays
- Close buttons (X)
- Utility controls (zoom, pan indicators)

❌ **Don't use for:**
- Primary sort/filter/view controls
- Important state toggles
- Anything requiring strong affordance

### Color Selection Rules

**Active State Colors:**
- Dark scenes → **indigo-600** (`#4f46e5`)
- Light scenes → **violet-600** (`#7c3aed`)

**Focus/Accent Colors (all scenes):**
- Border: **purple-400** (`#c084fc`)
- Ring: **purple-500/30** (`rgba(168, 85, 247, 0.3)`)

**Why purple family?**
- Ties to venue scene gradient (indigo → purple)
- Warm enough for light scenes, cool enough for dark
- Distinct from genre colors (avoids confusion)
- Modern, premium feel

---

## Anti-Patterns to Avoid

### ❌ Don't: Mix treatments for same component type

**Bad:**
```tsx
// Scene 3 uses solid buttons, Scene 6 uses glass buttons for sort controls
<button className="bg-white/10 backdrop-blur-sm">Sort A-Z</button>
```

**Good:**
```tsx
// All scenes use solid buttons for sort controls
<button className="bg-white border border-gray-300">Sort A-Z</button>
```

### ❌ Don't: Use glassmorphism for primary toggles

**Bad:**
```tsx
// Primary sort control with glassmorphism
<button className="bg-white/10 backdrop-blur-sm">A-Z</button>
```

**Good:**
```tsx
// Primary sort control with solid background
<button className="bg-white border border-gray-300">A-Z</button>
```

### ❌ Don't: Use solid backgrounds for search inputs

**Bad:**
```tsx
// Search input with solid white background
<input className="bg-white border border-gray-300" />
```

**Good:**
```tsx
// Search input with glassmorphism
<input className="bg-white/10 backdrop-blur-sm border border-white/20" />
```

### ❌ Don't: Add icons to buttons without user approval

**Important:** The design team has explicitly requested **text-only buttons**. Do not add icons (🔤, 🎵, 📊, etc.) unless specifically approved.

---

## Evolution & Future Considerations

### Potential New Component Types

**If we add these, use this pattern:**

| Component Type | Treatment | Rationale |
|----------------|-----------|-----------|
| **Tabs** | Solid backgrounds | Primary navigation = strong affordance |
| **Radio buttons** | Solid backgrounds | State selection = primary control |
| **Checkboxes** | Depends on context | In MultiSelectFilter = solid trigger, glass dropdown |
| **Dropdown selects** | Glassmorphism | Similar to input fields |
| **Sliders** | Custom (track + thumb) | Unique control, needs custom treatment |
| **Pagination** | Solid backgrounds | Primary navigation control |
| **Toast notifications** | Glassmorphism | Temporary overlay |
| **Modal backgrounds** | Solid dark overlay | Needs strong contrast with content |

### Version History

**v1.0 (January 2025)** - Initial documentation
- Codified solid vs glassmorphism pattern
- Documented all 6 scenes
- Established color rules (indigo-600 dark, violet-600 light)
- Added implementation examples and anti-patterns

---

## Quick Reference

### Decision Tree

```
Is this a PRIMARY scene control (sort, filter, view mode)?
├─ YES → Use SOLID background
│   ├─ Dark scene → gray-800 inactive, indigo-600 active
│   └─ Light scene → white inactive, violet-600 active
│
└─ NO → Is it an input field or secondary action?
    ├─ Input field → Use GLASSMORPHISM
    │   ├─ Dark scene → white/10 with white text
    │   └─ Light scene → white/10 with white text (over overlays)
    │
    └─ Secondary action → Use GLASSMORPHISM
        ├─ Dark scene → white/10 with white text
        └─ Light scene → white/80 with dark text
```

### Code Snippets Library

**Primary Toggle (Dark Scene):**
```tsx
className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px] ${
  isActive ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
}`}
```

**Primary Toggle (Light Scene):**
```tsx
className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px] ${
  isActive ? 'bg-violet-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
}`}
```

**Search Input (All Scenes):**
```tsx
className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20
  rounded-lg text-white placeholder-white/60
  focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30
  transition-all duration-200"
```

**Secondary Button (Dark Scene):**
```tsx
className="px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20
  rounded-lg text-white font-sans text-sm font-medium
  hover:bg-white/20 transition-all duration-200 min-h-[44px]"
```

**Secondary Button (Light Scene):**
```tsx
className="px-6 py-3 bg-white/80 backdrop-blur-sm border border-gray-300
  rounded-lg text-gray-900 font-sans text-sm font-medium
  hover:bg-white transition-all duration-200 shadow-sm min-h-[44px]"
```

---

## Related Documentation

- [Scene Design Guide](./scene-design-guide.md) - Scene backgrounds, typography, spacing
- [Color Specification](./color-specification.md) - Genre colors, background tokens
- [Artist Search Spec](../specs/future/artist-search-typeahead.md) - Implementation example using these patterns

---

**Last Updated:** January 2025
**Maintained By:** Design Team
**Questions?** Review existing scene implementations for reference examples.
