# Morperhaus Concert Archives
_A visual love letter to four decades of live music._

## What is this?
![Morperhaus Concert Archives](/docs/concerts-app.png)
I've been going to concerts since 1984. My wife and I have been going together since we started dating in the '90s. From packed arena tours to sweaty club shows, from bands we grew up worshipping to ones we discovered opening for someone else entirely.

During the pandemic, we thought it would be fun to see if we could list every concert we'd ever attended in a Google Sheet. It was a good project to keep us busy during that not-so-great time. Of course, I feature-creeped it almost immediately—adding opening acts, venues, genres, who attended which show, reference links. What started as a simple list became a proper database.

For a while I had it hooked up to a Google Looker Studio dashboard. It was... fine. Functional. But it didn't *feel* like anything. It was data, not memories.

This project is my attempt to turn that data into something that actually captures what it feels like to flip through ticket stubs. Five interactive scenes let you explore 175 shows (and counting), each one a different lens on the same history:

**The Timeline** — Every concert laid out chronologically. Scroll through four decades, see the density of shows ebb and flow, click into any year to see what we saw.

**The Venues** — A network graph connecting venues to the artists who played them. Turns out we've been to Irvine Meadows a *lot*.

**The Geography** — A map of everywhere we've seen live music. Filter by region, click a venue marker to see photos and details of where the shows happened.

**The Genres** — A sunburst chart breaking down our musical diet. Click into a genre to see every artist, click an artist to see their shows.

**The Artists** — Browse everyone we've seen, from headliners to openers. Gatefold album art vibes.

## Why build it this way?

Honestly? To learn.

I wanted to see if I could build a real [Jamstack](https://jamstack.org/what-is-jamstack/) app from scratch. No backend servers, just static files, APIs for data enrichment, and modern frontend tooling. I'd never done it before.

I also wanted to see what was possible using [Claude Code](https://www.anthropic.com/claude-code) as a collaborator—treating AI as a pair programmer rather than just a search engine. Every feature in here was planned, spec'd, and built through that workflow. The `docs/` folder is basically a paper trail of that experiment.

The result is an app that pulls concert data from a Google Sheet, enriches it with artist images and venue photos from APIs, geocodes every venue, and renders it all as a smooth, animated single-page app. Zero runtime cost. Zero monthly bills (well, except for my Cloudflare Pages domain).

## The stack

Built with Vite, React, TypeScript, and Tailwind CSS. D3.js handles the timeline and genre visualizations. Leaflet powers the map. Framer Motion makes everything feel good to scroll through.

If you care about that sort of thing, the full technical breakdown is in [docs/STATUS.md](docs/STATUS.md).

## Running it yourself
```bash
npm install
npm run dev
```

That's it. Concert data is already baked in as static JSON.

If you want to connect your own Google Sheet and run the data pipeline, check [docs/api-setup.md](docs/api-setup.md).

## What's next

**v1.3.4 is live!** Enhanced API key security with separate keys for geocoding and venue photos. Venue photos now appear in Geography Scene map popups—click any venue marker to see photos, legacy badges for closed/demolished venues, and venue stats. 96% of venues have real photos from Google Places API or manual curation.

Next up: phone optimization (v1.4.0+), Spotify listening history integration, and—most importantly—more shows to add to the list.

_Built with ❤️ for live music._