# Quality Standards

## Before Submitting Changes

All code changes must pass validation checks before being committed or released:

- **Run all available checks:** `npm run validate` (lint, format, type-check, build, tests)
- **Never claim checks passed without evidence** — if you state checks passed, you must have actually run them
- **If checks fail, fix before proceeding** — validation is blocking, not advisory
- **If checks cannot run, explicitly state why** and document what would have been executed

## Production Safety

While production incidents are rare in this project, maintain defensive practices:

- **Assume production impact** for changes to:
  - Data structures or schemas
  - API integrations (Ticketmaster, setlist.fm, geocoding)
  - Analytics tracking
  - Build/deployment configuration

- **Prefer small, reversible changes** over large rewrites
- **Document breaking changes** in changelog with clear migration notes
- **Avoid silent breaking behavior** — if something changes, make it visible

## When to Exercise Extra Caution

These areas require explicit review and testing:

- **Data pipeline changes** — affects 178 concerts, 247 artists, 77 venues
- **Deep linking logic** — external users bookmark URLs
- **Analytics events** — breaking tracking breaks historical data continuity
- **Build output** — `public/data/` files are consumed by production app

## Validation Integration

These skills/commands enforce quality standards:

- `/validate` — Runs all checks before any release
- `/release` — Blocks if validation fails
- `/hotfix` — Fast-track path but still runs checks
- `/data-refresh` — Validates data integrity after pipeline runs
