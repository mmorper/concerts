# /validate - Run All Validation Checks

Run comprehensive validation checks before releases or after data changes.

**Quality Standards:** This command enforces the standards defined in [.claude/quality-standards.md](../quality-standards.md).

## Inputs

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--quick` | No | false | Skip TypeScript build check |
| `--fix` | No | false | Auto-fix fixable issues |

**Examples:**
```
/validate              # Full validation
/validate --quick      # Skip slow checks
```

---

## Quick Reference

| Check | Command | Blocks Release |
|-------|---------|----------------|
| Version consistency | `npm run validate:version` | Yes |
| Doc claims vs code & data | `npm run validate:docs` | Yes |
| Data quality | `npm run validate-data` | Yes |
| TypeScript build | `npx tsc --noEmit` | Yes |
| Normalization | `npm run validate-normalization` | No (warning) |

---

## Workflow

### Step 1: Version Consistency

**Check:** Versions match across package.json, changelog.json, and git tags.

```bash
npm run validate:version
```

**Pass criteria:**
- `package.json` version matches latest changelog entry
- Git tag exists for current version (if released)

**If fails:**
> ❌ Version mismatch detected
> - package.json: v{VERSION_A}
> - changelog.json: v{VERSION_B}
>
> Run `/release` to create a new release, or manually sync versions.

---

### Step 1.5: Documented Claims

**Check:** README, `docs/ROADMAP.md` and `CLAUDE.md` still describe the archive
accurately — scene count, scene roster, concert/artist/venue counts, year span.

```bash
npm run validate:docs
```

Truth is derived, never typed: counts from `public/data/concerts.json`, the
roster from `SCENE_LABELS` in `src/components/changelog/constants.ts`.

**If fails:** the output names the file, the claim, what it says and what it
should say. A claim it can no longer *find* is also a failure — reworded prose
silently stops being checked otherwise, which is exactly how README came to
claim five scenes for seven months after Ask shipped as the sixth (#283).

---

### Step 2: Data Quality

**Check:** Concert data integrity and quality.

```bash
npm run validate-data
```

**Checks performed:**
- Required fields present (date, headliner, venue)
- Valid date formats
- No duplicate concerts
- Coordinates are valid
- Genre values are recognized

**If fails:**
> ❌ Data validation failed
> - Row 45: Missing headliner
> - Row 67: Invalid date format
>
> Fix issues in Google Sheets, then run `npm run build-data`

---

### Step 3: TypeScript Build

**Check:** Code compiles without type errors.

```bash
npx tsc --noEmit
```

**Skip with:** `--quick` flag

**If fails:**
> ❌ TypeScript errors found
> src/components/Timeline.tsx:45 - Type 'string' is not assignable to type 'number'
>
> Fix type errors before releasing.

---

### Step 4: Normalization Check (Warning Only)

**Check:** All normalized values follow conventions.

```bash
npm run validate-normalization
```

**Checks:**
- Artist names normalize consistently
- Venue names normalize consistently
- No orphaned metadata entries

**If issues found:**
> ⚠️ Normalization warnings (non-blocking)
> - Artist "R.E.M." normalizes to "rem" but metadata uses "r-e-m"
>
> Consider running `npm run build-data` to regenerate.

---

## Output Summary

```
============================================================
🔍 VALIDATION RESULTS
============================================================

✅ Version consistency     PASS
✅ Data quality            PASS (2 warnings)
✅ TypeScript build        PASS
⚠️  Normalization          2 warnings

============================================================
SUMMARY
============================================================
Checks passed: 4/4
Warnings: 2
Errors: 0

✅ Ready for release!
```

**IMPORTANT:** Never claim checks passed unless they were actually run. If validation cannot be completed, explicitly state:

- Which checks could not be executed
- Why they could not be run
- What would need to happen to run them

This is a **blocking requirement** — validation failures must prevent releases. See [.claude/quality-standards.md](../quality-standards.md) for rationale.

---

## Error States

| Error | Cause | Resolution |
|-------|-------|------------|
| "Version mismatch" | package.json ≠ changelog | Run `/release` or sync manually |
| "Data validation failed" | Invalid concert data | Fix in Google Sheets, re-fetch |
| "TypeScript errors" | Type errors in code | Fix code errors |
| "Command not found" | Missing npm script | Check package.json scripts |

---

## When to Run

- Before `/release` — Catch issues early
- After `npm run build-data` — Verify data integrity
- After major code changes — Ensure types are valid
- In CI/CD — Block broken deployments

---

## Related

- `/release` — Runs validation automatically
- `npm run validate:version` — Version check only
- `npm run validate-data` — Data check only
