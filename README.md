# Morperhaus Concert Archives

An interactive, visually stunning timeline of personal concert history - from the first show to the latest encore.

## Overview

This application transforms a static dashboard into an immersive chronological journey through decades of live music experiences. Built with modern web technologies and designed with the aesthetic of rock poster art meets editorial photography.

## Features

- **Interactive Timeline**: Scroll through concert history with smooth animations and decade sections
- **Integrated Map**: See where shows happened with synchronized map visualization
- **Multiple Exploration Paths**: Filter by genre, artist, venue, city, or year range
- **Rich Data**: Up to 15 opening acts per show, genre information, venue details
- **Visual Excellence**: Concert ticket aesthetic, genre-based color theming, bold typography
- **Performance Optimized**: Virtual scrolling handles 500+ concerts smoothly
- **Zero Runtime Cost**: All data pre-fetched and cached as static files

## Tech Stack

- **Framework**: Vite + React 18 + TypeScript
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand
- **Maps**: React Leaflet with OpenStreetMap
- **Animations**: Framer Motion
- **Deployment**: Cloudflare Pages

## Data Source

Concert data is maintained in a Google Sheet and periodically imported via Google Sheets API. Artist metadata is enriched using free APIs (TheAudioDB, Last.fm) and cached locally. Venue coordinates are geocoded using Google Maps Geocoding API with persistent caching for cost optimization ($0.00 monthly cost).

## Project Structure

```
concerts/
├── docs/                  # Documentation
│   └── planning.md        # Detailed implementation plan
├── src/                   # Source code
│   ├── components/        # React components
│   ├── hooks/             # Custom React hooks
│   ├── store/             # Zustand state management
│   ├── types/             # TypeScript interfaces
│   └── utils/             # Utility functions
├── public/
│   └── data/              # Static concert data (JSON)
├── scripts/               # Data import & enrichment scripts
└── .claude/               # Project configuration & context
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Pull and enrich data from Google Sheet
npm run build-data

# Manually geocode all venues (optional)
npm run geocode
```

## Visual Testing

Puppeteer is available for automated visual testing.

### Prerequisites

Tests require the development server to be running:

```bash
npm run dev
```

### Available Tests

| Command                 | Purpose                                      |
|-------------------------|----------------------------------------------|
| `npm run test:sanity`   | Basic page load and scroll verification      |

### Output

Screenshots are saved to `/tmp/` directory.

### Future Work

Comprehensive visual testing for all 5 scenes (Timeline, Venue Network, Map, Genres, Artists) is planned for v1.1+. See [docs/specs/future/visual-testing-suite.md](docs/specs/future/visual-testing-suite.md) for the full specification.

## Deployment

The app is automatically deployed to Cloudflare Pages on every push to the main branch. No build action configuration needed - Cloudflare handles everything.

## Design Philosophy

"Rolling Stone Magazine Worthy" - This isn't just a data visualization, it's a visual love letter to live music. Every design decision prioritizes storytelling, emotional connection, and visual impact.

## Documentation

- [Planning Document](docs/planning.md) - Complete implementation plan
- [API Setup](docs/api-setup.md) - Google Sheets & music API configuration
- [.claude/context.md](.claude/context.md) - Project context for AI-assisted development

## License

Personal project - All rights reserved

---

Built with love for live music 🎸🎤🥁
