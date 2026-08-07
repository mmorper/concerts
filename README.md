# Morperhaus Concert Archives
_A visual love letter to four decades of live music._

![Morperhaus Concert Archives](/docs/concerts-app.png)

## What is this?

An interactive web app for exploring personal concert history. Five scenes—Timeline, Venues, Geography, Genres, Artists—each offering a different lens on 178 shows spanning 1984 to today. Click through decades, trace connections between venues and artists, see where the music happened on a map. All enriched with artist photos, venue imagery, and setlist data.

**Live at [concerts.morperhaus.org](https://concerts.morperhaus.org)** • 184 shows • 257 artists • 79 venues • 5+ decades

## What's new

**v5.4.0** 🎸 Twenty months before *Violator*. I sat in the Rose Bowl in June 1988 watching Depeche Mode, and the record I'd play most didn't exist yet — nine more albums were still to come, and I had no idea. The archive can see that now: for every show it knows which album the band was touring, how new it was, and what hadn't happened yet. It's the first thing here that knows something I didn't at the time. [See the arc](https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode).

**v5.3.0** 🎭 One man, four marquees. Brian Setzer has played here seven times since 1995 — as himself, as the Orchestra, as the Nashvillians, once as a '68 Comeback Special — and the archive had him down as four different artists. It knows better now. It also learned to read setlists properly, so it can spot a song coming back years later or a guest who was never on the ticket, and a few photographs that had quietly stopped loading are back where they belong. [See the mosaic](https://concerts.morperhaus.org/?scene=artists&artist=brian-setzer).

**v5.2.0** 🎲 Every story gets a turn. The archive writes its own liner notes, and it had fallen into a rut — of fifteen kinds of story it can tell, the same five kept coming up and five had never appeared once. They weren't worse; they just couldn't score as highly, and the highest score won every week. Now they take turns, and twenty posts link straight through to what was played that night. [Read the liner notes](https://concerts.morperhaus.org/liner-notes).

**v5.0.0** 🎙️ Ask the Archive — right here. Forty years of shows are now a conversation: ask on the site (the journey ends in a chat — or press ⌘K from anywhere), or bring it into Claude. It answers in the archive’s own voice, always true to the shows that really happened. [Ask the archive](https://concerts.morperhaus.org/?scene=ask).

**v4.6.0** ✨ How It Works! Ever wonder how a spreadsheet row becomes a richly connected concert record? Now you can watch it happen. The new [How It Works](https://concerts.morperhaus.org/how-it-works) page walks you through every enrichment tier—from raw artist name and venue to geographic coordinates, artist photos, audio previews, and song-by-song setlists—as an animated cascade in real time.

**v4.4.0** 📖 Liner Notes! Forty-two years of concerts, now with stories. The archive analyzes your history and writes original essays—personal milestones, cultural context, and deep cuts drawn straight from the data. Browse the feed at [/liner-notes](https://concerts.morperhaus.org/liner-notes), filter by category, and subscribe via RSS. App release notes have moved to [What's Playing](https://concerts.morperhaus.org/whats-playing).

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
Conversation has landed: the in-app ["Ask the Archive" chat](https://concerts.morperhaus.org/ask) ([#138](https://github.com/mmorper/concerts/issues/138)) lets you talk to the collection right on the site—ask a question in plain language and get answers grounded in real shows, rendered as little exhibits rather than walls of text (press ⌘K from anywhere). Still to come on that front: a wayfinding dock that makes it discoverable from every scene ([#142](https://github.com/mmorper/concerts/issues/142)). (The archive also speaks to AI assistants through its [MCP connector](https://concerts.morperhaus.org/about-mcp)—this brings that same voice onto the site itself.) Audio preview playback comes to setlist items ([#22](https://github.com/mmorper/concerts/issues/22)), so you can hear any song from a night's setlist with a single click. And the Artist Scene gains a full discography view ([#5](https://github.com/mmorper/concerts/issues/5)), bringing every artist's catalog to life alongside the shows you saw.

**Enhancements**
Smaller refinements that make the archive easier to roam. Jump straight from a venue's artist network into the Artists scene ([#9](https://github.com/mmorper/concerts/issues/9)) to trace who you saw where; see renamed venues at a glance on the map ([#8](https://github.com/mmorper/concerts/issues/8)); and watch the opening cascade arrive more gracefully, a piece at a time instead of all at once ([#114](https://github.com/mmorper/concerts/issues/114)).

**Fixes**
Foundational work that keeps everything honest and quick: richer genre coverage for opening acts ([#69](https://github.com/mmorper/concerts/issues/69)) so the data tells the whole story, trimming payload the page never needed ([#115](https://github.com/mmorper/concerts/issues/115)) for faster loads, and an automated test gate on every change ([#116](https://github.com/mmorper/concerts/issues/116)) to catch problems before they ship.

And always: more shows to add to the list.

_Built with ❤️ for live music._
