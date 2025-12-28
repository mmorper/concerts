# Morperhaus Concert Archives - Project Context

## Project Overview

An interactive Jamstack single-page application that replaces a Google Looker Studio dashboard with a rich, engaging timeline visualization of personal concert history spanning decades.

## Key Information

### Data Source
- Google Sheet with 100-500 concert records
- Contains: Date, Headliner, Genre, up to 15 Openers, Venue, City, State, Reference links
- Manual periodic updates during "vibe code" sessions

### Core Requirements
- Timeline/chronological storytelling as primary UX
- Integrated map view alongside timeline
- Read-only visualization (no editing)
- Zero runtime API costs (all data pre-fetched)
- Multiple exploration paths (timeline, genre, artist, venue, geographic)

### Technical Stack
- **Framework**: Vite + React 18 + TypeScript
- **Styling**: Tailwind CSS v4
- **State**: Zustand
- **Maps**: React Leaflet with OpenStreetMap
- **Animations**: Framer Motion
- **Deployment**: Cloudflare Pages (auto-deploy from GitHub)

### Design Philosophy
"Rolling Stone Magazine Worthy" - editorial photography meets interactive storytelling meets rock poster art.

**Visual Themes**:
- Vintage concert poster + modern editorial
- Large bold typography (Bebas Neue for headliners)
- Genre-based color palettes
- Concert ticket aesthetic for cards
- Scroll-triggered animations
- Magazine masthead header

### Data Strategy
1. **Import**: Google Sheets API OAuth integration
2. **Enrich**: TheAudioDB & Last.fm APIs for artist images/metadata
3. **Cache**: Static JSON files committed to repo
4. **Deploy**: Cloudflare Pages auto-builds on push

### Key Features
- Filterable timeline (genre, artist, venue, city, year)
- Synchronized map showing visible concerts
- Virtual scrolling for performance
- Decade section headers with era-specific theming
- Expandable opener lists (up to 15 per show)
- Shareable filtered views via URL params

### Removed Features
- ~~"Who Attended" filter~~ - simplified per user request

### Future Enhancements (v2)
- Venue deep-dive pages
- City heat maps
- Tour route visualization
- ConcertArchives.org integration
- "Concert DNA" aggregate visualizations

## Current Phase

**Phase 0: Project Infrastructure** ✅
- Git repository initialized
- Directory structure created
- Documentation organized
- .claude configuration established

## Next Phase

**Phase 1: Foundation Setup**
- package.json and dependencies
- Vite configuration
- TypeScript setup
- Tailwind CSS
- Basic component structure
- Sample data file

## Context Window Strategy
- Check remaining tokens before each phase
- If <30k tokens: Stop, update docs, start fresh session
- Update `/docs/planning.md` at phase completion
- This file provides quick context rebuild for future sessions

## Important Files
- `/docs/planning.md` - Complete implementation plan
- `/.claude/config.json` - Project configuration
- `/.claude/phase-tracking.md` - Progress tracking
- `/index.html` - Current Looker dashboard (backup to old_index.html)
