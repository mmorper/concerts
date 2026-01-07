# Morperhaus Concert Archives
_A visual love letter to four decades of live music._

![Morperhaus Concert Archives](/docs/concerts-app.png)

## What is this?

An interactive web app for exploring personal concert history. Five scenes—Timeline, Venues, Geography, Genres, Artists—each offering a different lens on 178 shows spanning 1984 to today. Click through decades, trace connections between venues and artists, see where the music happened on a map. All enriched with artist photos, venue imagery, and setlist data.

**Live at [concerts.morperhaus.org](https://concerts.morperhaus.org)** • 178 shows • 247 artists • 77 venues • 5+ decades

## What's new

**v3.0.0 is here!** 🎉 The timeline is now fully interactive. [Click any year dot](https://concerts.morperhaus.org/?scene=timeline) to see every concert from that moment in time—artist photos fan out in a card stack, and one tap takes you straight to their full story. Meanwhile, the [Genres scene](https://concerts.morperhaus.org/?scene=genres) got a complete overhaul with an animated treemap that shows how your musical taste evolved decade by decade. Watch genres grow and shrink over time, then drill into any style to explore the artists within.

**v2.0.0** 🎫 See when your favorite artists are touring—right from their gatefold. [Open Joe Jackson](https://concerts.morperhaus.org/?scene=artists&artist=joe-jackson) to see live tour dates fetched from Ticketmaster, complete with direct ticket purchase links.

See the full changelog at [/liner-notes](https://concerts.morperhaus.org/liner-notes)

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

All concert data starts in a Google Sheet I've been maintaining since the pandemic—date, headliner, openers, venue, city, who attended, reference links. That's the single source of truth.

But raw data isn't enough. The app enriches everything at build time:

- **Artist photos and metadata** from [TheAudioDB](https://www.theaudiodb.com/) and Last.fm
- **Venue photos** from Google Places API (96% of venues have images)
- **Geocoding** for every venue location via Google Maps API
- **Setlists** from [setlist.fm](https://setlist.fm/) when available (client-side)
- **Album art and tracks** from Spotify (for select artists)
- **Upcoming tour dates** from [Ticketmaster Discovery API](https://developer.ticketmaster.com/) (client-side)

The build-time pipeline fetches, validates, enriches, and generates static JSON files. Runtime features like setlists and tour dates load client-side with smart caching. Zero backend servers. Zero monthly costs (beyond the domain).

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

**Phone support** — iPad works great. Phones need some love—bottom sheets for artist details, better touch controls, layouts that make sense at 430px wide.

**Cross-scene artist navigation** — Click any artist node in the Venues force graph and jump straight to their gatefold in the Artists scene. Complete the discovery triangle.

**Spotify integration** — Album covers on artist cards, 30-second preview players in the gatefold, "Open in Spotify" links. The vinyl metaphor taken to its logical conclusion.

**Upcoming tour dates** — See where artists are playing next, get tickets. Same menu where you browse past shows.

And always: more shows to add to the list.

_Built with ❤️ for live music._
