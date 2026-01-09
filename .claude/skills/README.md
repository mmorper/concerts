# Claude Skills

Skills are knowledge packages that Claude references for specialized tasks. Unlike commands (which are workflows), skills provide context and standards.

---

## Available Skills

| Skill | Path | When to Use |
|-------|------|-------------|
| **design-system** | `skills/design-system/SKILL.md` | UI work, styling, colors, typography, animations |
| **data-schema** | `skills/data-schema/SKILL.md` | Data queries, entity relationships, normalization |
| **api-integration** | `skills/api-integration/SKILL.md` | External APIs, caching, rate limits, credentials |
| **analytics** | `skills/analytics/SKILL.md` | Event tracking, user interactions, GA4 implementation |

---

## How Skills Work

### Automatic Reference

Claude should read relevant skills **before** writing code:

```
User: "Add a filter dropdown to the Artists scene"

Claude's process:
1. Read skills/design-system/SKILL.md (for UI patterns)
2. Read skills/data-schema/SKILL.md (if filtering data)
3. Then implement following those standards
```

### Trigger Patterns

**Reference `design-system` when:**
- Creating or modifying components
- Working with colors, fonts, or spacing
- Adding animations or hover effects
- Building for a specific scene
- "Make it look like..." requests

**Reference `data-schema` when:**
- Querying concerts, artists, or venues
- Adding new data fields
- Working with normalized values
- Building filters or search
- Deep linking to entities

**Reference `api-integration` when:**
- Adding new external API integrations
- Debugging API errors or rate limits
- Working with caching strategies
- Configuring API credentials
- Understanding data enrichment pipelines

**Reference `analytics` when:**
- Adding new user interactions or features
- Creating new scenes or scene components
- Implementing search, filters, or navigation
- Adding external links
- Any work that involves user engagement

---

## Skill Structure

Each skill has a `SKILL.md` entry point:

```
skills/
├── README.md              # This file
├── design-system/
│   └── SKILL.md           # Colors, typography, components
├── data-schema/
│   └── SKILL.md           # Data structures, relationships
├── api-integration/
│   └── SKILL.md           # External APIs, caching, credentials
└── analytics/
    └── SKILL.md           # Event tracking, GA4, user interactions
```

Skills are **read-only references**. They don't execute code—they inform how code should be written.

---

## Skills vs Commands

| Aspect | Skills | Commands |
|--------|--------|----------|
| Purpose | Knowledge/standards | Workflows/actions |
| Invocation | Read before task | Explicit `/command` |
| Output | No files created | May create/modify files |
| Example | "How to style buttons" | "Create a release" |

**Analogy:**
- Skills = Reference manual (read it)
- Commands = Procedure checklist (do it)

---

## Adding New Skills

### When to Create a Skill

Create a skill when:
- You repeat the same context in multiple sessions
- There are standards Claude should always follow
- Complex domain knowledge needs documentation
- You want consistent patterns across features

### Skill Template

```markdown
# {Skill Name} Skill

**Purpose:** [One sentence on what this skill covers]

**When to use:**
- [Trigger 1]
- [Trigger 2]
- [Trigger 3]

---

## Quick Reference

[Most-used information at a glance]

---

## [Section 1]

[Detailed content]

---

## [Section 2]

[Detailed content]

---

## Source Files

[Links to primary documentation if skill is a consolidation]

---

**Last Updated:** {DATE}
```

### Directory Structure

```
skills/
└── {skill-name}/
    ├── SKILL.md           # Required: Entry point
    └── [additional.md]    # Optional: Supplementary files
```

---

## Usage Examples

### Example 1: New Component

```
User: "Create a sort dropdown for the Venues scene"

Claude:
1. Reads skills/design-system/SKILL.md
   - Notes: Scene 2 is dark, uses gradient background
   - Primary toggles use: bg-gray-800 inactive, bg-indigo-600 active
   - Min touch target: 44px
   
2. Implements dropdown following those patterns
```

### Example 2: Data Query

```
User: "Show all concerts where Depeche Mode was an opener"

Claude:
1. Reads skills/data-schema/SKILL.md
   - Notes: openers is string[], need to normalize for comparison
   - Concert interface shows field structure
   
2. Writes query:
   concerts.filter(c => 
     c.openers.some(o => normalize(o) === 'depeche-mode')
   )
```

### Example 3: Combined

```
User: "Add a genre filter to the Timeline scene"

Claude:
1. Reads skills/design-system/SKILL.md
   - Scene 1 is light background
   - Uses white/violet-600 button pattern
   
2. Reads skills/data-schema/SKILL.md
   - Genre colors defined in GENRE_COLORS constant
   - genreNormalized field for filtering
   
3. Implements filter using both skill references
```

---

## Best Practices

### For Claude

1. **Read first, code second** — Check relevant skills before implementation
2. **Don't assume** — If a pattern isn't in the skill, ask
3. **Stay consistent** — Follow skill patterns even if you'd do it differently
4. **Reference source** — Link to skill when explaining decisions

### For Maintaining Skills

1. **Keep current** — Update skills when patterns change
2. **Single source** — Skills should consolidate, not duplicate
3. **Quick reference first** — Put most-used info at top
4. **Examples help** — Include code snippets for common patterns

---

## Related

- `.claude/commands/` — Workflow automation
- `docs/design/` — Full design documentation
- `docs/specs/` — Feature specifications
