# Data Directory

This directory contains working data files and examples for the concert data pipeline.

## Files

### `example-concert-data.csv`
**Purpose:** Example CSV template showing the required format for concert data import.

**Usage:** Copy this structure to your Google Sheet to ensure compatibility with the data pipeline.

**See below** for detailed column requirements and data validation rules.

---

### `example-venue-status.csv`
**Purpose:** Example template for venue lifecycle tracking (active, demolished, closed, renamed).

**Usage:** Copy to `venue-status.csv` and customize with your venue classifications. This file is referenced during venue enrichment to add status metadata.

**Note:** The actual `venue-status.csv` is gitignored for personal data. If the file is missing, all venues default to "active" status.

**Columns:**
- `venue` - Venue name (must match your concert data)
- `city` - City location
- `state` - State/region
- `status` - Venue status: `active`, `demolished`, `closed`, or `renamed`
- `closed_date` - Date venue closed (format: YYYY-MM-DD, optional)
- `notes` - Additional context about the venue's status (optional)

### `venues-to-classify.csv`
**Purpose:** Working file for venue classification tasks.

**Usage:** Temporary staging for venues that need manual review or classification.

**Note:** This file is excluded from git via `.gitignore`.

## Maintenance

These files are manually curated and updated as needed when adding or enriching concert data.

---

## Concert Data Format Specification

The data pipeline fetches concert data from a Google Sheet. Your sheet must follow these requirements:

### Required Columns

The following columns are **mandatory** and must be present (column names are case-insensitive):

| Column | Description | Example | Validation |
|--------|-------------|---------|------------|
| `Date` | Concert date in a parseable format | `2024-03-15` or `03/15/2024` | Must be a valid date |
| `Headliner` | Main artist/band name | `Pearl Jam` | Cannot be empty |
| `Venue` | Venue name | `The Forum` | Warned if missing |
| `City` | City name | `Los Angeles` | Required (if not using City/State) |
| `State` | State abbreviation or name | `CA` or `California` | Required (if not using City/State) |

**Alternative location format**: Instead of separate `City` and `State` columns, you can use a single combined column:
- `City/State` or `CityState` with format: `Los Angeles, CA`

### Optional Columns

These columns are optional but recommended:

| Column | Description | Example | Notes |
|--------|-------------|---------|-------|
| `Opener_1` | First opening act | `The Strokes` | Use numbered columns for multiple openers |
| `Opener_2` | Second opening act | `Local Band` | Script supports up to `Opener_15` |
| `Opener_N` | Additional openers | | Continue numbering as needed |
| `Reference` | Link or source URL | `https://example.com/concert` | For documentation/verification |

**Note on Genre**: While the script supports an optional `Genre` column, genre data is typically enriched later in the pipeline via external APIs (TheAudioDB).

### Sheet Structure

- **Row 1 must contain column headers** (the script expects this)
- Column order doesn't matter (script matches by header name)
- Header names are case-insensitive (`Headliner`, `headliner`, `HEADLINER` all work)
- Empty cells are treated as empty strings

### Data Validation

When the script runs, it will:
- ✅ **Skip rows** with invalid or missing dates
- ✅ **Skip rows** with missing headliners
- ⚠️  **Warn** about missing venues (but still import the row)
- 🔍 Validate that all required columns are present before processing

### Usage

1. Copy the example CSV structure to your own Google Sheet
2. Fill in your concert data
3. Configure your `.env` file with Google Sheets API credentials
4. Run `npm run fetch-sheet` to import the data

For more information about the data pipeline, see [`/docs/BUILD.md`](../docs/BUILD.md).
