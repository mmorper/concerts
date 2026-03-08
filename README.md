# Morperhaus Concert Archives
_A visual love letter to four decades of live music._

![Morperhaus Concert Archives](/docs/concerts-app.png)

## What is this?

An interactive web app for exploring personal concert history. Five scenes—Timeline, Venues, Geography, Genres, Artists—each offering a different lens on 178 shows spanning 1984 to today. Click through decades, trace connections between venues and artists, see where the music happened on a map. All enriched with artist photos, venue imagery, and setlist data.

**Live at [concerts.morperhaus.org](https://concerts.morperhaus.org)** • 179 shows • 254 artists • 77 venues • 5+ decades

## What's new

**v4.3.0** 🎟️ On Deck! Upcoming concerts now get their moment in the spotlight—look for the badge on Timeline cards and in Artist profiles wherever a show is still ahead. Never lose track of what's coming up next.

**v4.0.0** 🎵 Listen before you go! The Artist Gatefold now includes an audio preview player with 30-second clips from 252 artists (99% coverage). Play/pause controls, animated equalizer, auto-advance, and direct links to Apple Music. Get a feel for an artist's sound right in your concert archive—perfect for those moments when you remember the show but forgot what they sounded like.

Want the full story? Explore recent updates in [What's Playing](https://concerts.morperhaus.org/whats-playing).

## The backstory

I've been going to concerts since 1984. My wife and I have been going together since we started dating in the '90s. From packed arena tours to sweaty club shows, from bands we grew up worshipping to ones we discovered opening for someone else entirely.

During the pandemic, we thought it would be fun to see if we could list every concert we'd ever attended in a Google Sheet. It was a good project to keep us busy during that not-so-great time. Of course, I feature-creeped it almost immediately—adding opening acts, venues, genres, who attended which show, reference links. What started as a simple list became a proper database.

For a while I had it hooked up to a Google Looker Studio dashboard. It was... fine. Functional. But it didn't *feel* like anything. It was data, not memories.

This project is my attempt to turn that data into something that actually captures what it feels like to flip through ticket stubs.

## Features

Five interactive scenes, each one a different lens on the same history:

**[The Timeline](https://concerts.morperhaus.org/?scene=timeline)** — Every concert laid out chronologically. Scroll through four decades, see the density of shows ebb and flow. Hover over any year to preview artist imagery and concert counts with subtle parallax effects.

**[The Venues](https://concerts.morperhaus.org/?scene=venues)** — A network graph connecting venues to the artists who played them. Turns out [we've been to Irvine Meadows](https://concerts.morperhaus.org/?scene=venues&venue=irvine-meadows) a *lot*. Click any venue to see photos, stats, and concert history.

**[The Geography](https://concerts.morperhaus.org/?scene=geography)** — A map of everywhere we've seen live music. Filter by region, click a venue marker to see photos and details of where the shows happened. Legacy badges mark closed or demolished venues.

**[The Genres](https://concerts.morperhaus.org/?scene=genres)** — A sunburst chart breaking down our musical diet. Click into a genre to see every artist.

**[The Artists](https://concerts.morperhaus.org/?scene=artists)** — Browse everyone we've seen, from headliners to openers. [Gatefold album art vibes](https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode) with artist photos, concert histories, setlist integration, and live tour dates with ticket links.

## Where the data comes from

All concert data starts in a **Google Sheet** I've been maintaining since the pandemic—date, headliner, openers, venue, city, who attended, reference links. That's the single source of truth.

But raw data isn't enough. The app enriches everything at build time:

- **Artist photos and metadata** from [TheAudioDB](https://www.theaudiodb.com/), [Last.fm](https://www.last.fm/), and [Deezer](https://www.deezer.com/) (cascading fallbacks)
- **Artist discography** from [MusicBrainz](https://musicbrainz.org/) and Cover Art Archive
- **Venue photos** from Google Places API (96% of venues have images)
- **Geocoding** for every venue location via Google Maps Geocoding API
- **Audio preview player** with 30-second track clips from [iTunes/Apple Music](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/) (primary) and [Deezer](https://developers.deezer.com/) (fallback) for 252 artists
- **Setlists** from [setlist.fm](https://setlist.fm/) when available (pre-fetched at build time)
- **Upcoming tour dates** from [Ticketmaster Discovery API](https://developer.ticketmaster.com/) (client-side)

The build-time pipeline fetches, validates, enriches, and generates static JSON files. Runtime features like tour dates load client-side with smart caching. Zero backend servers. Zero monthly costs (beyond the domain).

Want the technical details? See [docs/DATA_PIPELINE.md](docs/DATA_PIPELINE.md) for the complete data pipeline documentation, or [docs/WORKFLOW.md](docs/WORKFLOW.md) for how this whole thing gets built and maintained.

## How it's built

Honestly? I did this to learn.

I wanted to see if I could build a real [Jamstack](https://jamstack.org/what-is-jamstack/) app from scratch. No backend servers, just static files, APIs for data enrichment, and modern frontend tooling. I'd never done it before.

I also wanted to see what was possible using [Claude Code](https://www.anthropic.com/claude-code) as a collaborator—treating AI as a pair programmer rather than just a search engine. Every feature in here was planned, spec'd, and built through that workflow. The `docs/` folder is basically a paper trail of that experiment.

The result is an app that pulls concert data from a Google Sheet, enriches it with artist images and venue photos from APIs, geocodes every venue, and renders it all as a smooth, animated single-page app. Zero runtime cost. Zero monthly bills (well, except for my Cloudflare Pages domain).

**The stack:** Vite, React, TypeScript, and Tailwind CSS. D3.js handles the timeline and genre visualizations. Leaflet powers the map. Framer Motion makes everything feel good to scroll through.

If you care about that sort of thing, see [docs/ROADMAP.md](docs/ROADMAP.md) for what's coming next and [docs/WORKFLOW.md](docs/WORKFLOW.md) for technical details.

## Running it yourself

### Quick Start (Using Example Data)

Want to see how it works first? Just run it:

```bash
git clone https://github.com/yourusername/concerts.git
cd concerts
npm install
npm run dev
```

The app includes my concert data as static JSON—no setup required. Browse 174+ shows to see how it works.

### Using Your Own Concert Data

Ready to build your own concert archive? Follow these steps:

**1. Clone the repository**

```bash
git clone https://github.com/yourusername/concerts.git
cd concerts
npm install
```

**2. Prepare your concert data**

Create a Google Sheet with your concerts using the required format:
- See [data/example-concert-data.csv](data/example-concert-data.csv) for the template
- Read [data/README.md](data/README.md) for column requirements

**Required columns**: Date, Headliner, Venue, City, State
**Optional columns**: Opener_1 through Opener_15, Reference

**3. Set up API credentials**

Configure the APIs needed for the data pipeline:
- Google Sheets API (to fetch your data)
- Google Maps/Places APIs (for geocoding and venue photos)
- setlist.fm API (for concert setlists)

Follow the complete setup guide: [docs/api-setup.md](docs/api-setup.md)

**4. Run the data pipeline**

```bash
npm run build-data  # Fetches from Google Sheets and enriches data
npm run dev         # Starts the dev server
```

For details on the data pipeline and enrichment process, see [docs/DATA_PIPELINE.md](docs/DATA_PIPELINE.md).

## What's Next

A few things I'm thinking about (whenever I get around to them):

**New Capabilities**
Three major features expand how you discover and experience music through the archive. Audio preview playback comes to setlist items ([#22](https://github.com/mmorper/concerts/issues/22)), letting you instantly hear any song from a concert's setlist with a single click—transforming liner notes from static tracklists into an immersive listening experience. Artist discography integration ([#5](https://github.com/mmorper/concerts/issues/5)) brings visual album grids directly into the Artist Scene, showcasing the full creative journey of every artist in your collection. Cross-scene navigation ([#9](https://github.com/mmorper/concerts/issues/9)) weaves the app together by letting you jump from venue artist networks straight into the Artists scene, making it effortless to explore connections between where you saw shows and who played them.

**Enhancements**
A suite of refinements elevate the experience with better insights, discovery, and data quality. The GA4 analytics dashboard ([#20](https://github.com/mmorper/concerts/issues/20)) provides deep visibility into how users engage with audio previews, helping optimize the feature over time. Map popup badges ([#8](https://github.com/mmorper/concerts/issues/8)) surface venue history at a glance, showing renamed venues with their current names. Venue name change detection ([#7](https://github.com/mmorper/concerts/issues/7)) automates the tedious work of tracking venue rebranding with smart CLI tools. Ticketmaster affiliate tracking ([#3](https://github.com/mmorper/concerts/issues/3)) adds analytics instrumentation to ticket purchase flows, enabling measurement of external engagement.

**Fixes**
Behind-the-scenes work ensures the codebase stays robust and maintainable. Validation architecture refactoring ([#14](https://github.com/mmorper/concerts/issues/14)) separates concerns for cleaner, more maintainable code. The versioned release deployment workflow ([#13](https://github.com/mmorper/concerts/issues/13)) transitions from auto-deploy chaos to controlled, tagged releases. Visual testing suite implementation ([#10](https://github.com/mmorper/concerts/issues/10)) establishes regression safeguards across all five scenes. SEO Tool v2 completion ([#6](https://github.com/mmorper/concerts/issues/6)) awaits Google Search Console data before activating cross-source correlation insights. Two investigations—SEO command scope ([#12](https://github.com/mmorper/concerts/issues/12)) and Cloudflare Worker status ([#4](https://github.com/mmorper/concerts/issues/4))—need resolution to clarify next steps and prevent duplicate work.

And always: more shows to add to the list.

_Built with ❤️ for live music._
