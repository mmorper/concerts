# MCP Deep Links — Rendered Reference

> Visual reference for the deep links emitted by the MCP tools (#132 / PR #133).
> Preview this file (Cmd+Shift+V in VS Code) to see the links render as clickable.
> Source of truth is `workers/mcp-server/src/tools.ts`; this shows what the output looks like.

Base URL: `https://concerts.morperhaus.org`

---

## Mock A — Artist history (matches the screenshot)

Same prose as the Human League response, with **headliner + venues linked**. Openers
left as plain text (no reliable page). No per-show link (concert-level deep links don't
exist yet).

> ### Artist history
>
> [The Human League](https://concerts.morperhaus.org/?scene=artists&artist=the-human-league) have been seen **3 times** in this archive, spanning 23 years from 2003 to 2026. Here's the rundown:
>
> **August 24, 2003 — [The Grove of Anaheim](https://concerts.morperhaus.org/?scene=venues&venue=the-grove-of-anaheim), Anaheim**
> The first show, with The English Beat opening. A classic New Wave double-bill.
>
> **May 12, 2018 — [Huntington State Beach](https://concerts.morperhaus.org/?scene=venues&venue=huntington-state-beach), Huntington Beach**
> This one was a massive festival-style lineup — The Alarm, Dramarama, The Motels, Naked Eyes, The Untouchables, Gene Loves Jezebel, When In Rome, and The Polecats all opened. Quite the New Wave reunion.
>
> **June 4, 2026 — [Hollywood Bowl](https://concerts.morperhaus.org/?scene=venues&venue=hollywood-bowl), Hollywood**
> The most recent show, just 12 days ago, with Alison Moyet and Soft Cell opening — an incredible lineup of British synth-pop legends sharing the stage.
>
> The archive notes a long gap between the first and second show, but clearly [The Human League](https://concerts.morperhaus.org/?scene=artists&artist=the-human-league) keep drawing this concert-goer back. Want to explore any of the other artists from these shows?

---

## Mock B — Search results

> **3 concerts matching "new wave", the 2010s:**
>
> - [Depeche Mode](https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode) — [Hollywood Bowl](https://concerts.morperhaus.org/?scene=venues&venue=hollywood-bowl), Hollywood (Oct 2017)
> - [OMD](https://concerts.morperhaus.org/?scene=artists&artist=omd) — [The Observatory](https://concerts.morperhaus.org/?scene=venues&venue=the-observatory), Santa Ana (May 2013)
> - [New Order](https://concerts.morperhaus.org/?scene=artists&artist=new-order) — [Hollywood Palladium](https://concerts.morperhaus.org/?scene=venues&venue=hollywood-palladium), Hollywood (Nov 2016)

---

## Mock C — Venue history

> [Hollywood Palladium](https://concerts.morperhaus.org/?scene=venues&venue=hollywood-palladium), Hollywood CA — **6 shows** in the archive.
>
> 1. November 3, 2016 — [New Order](https://concerts.morperhaus.org/?scene=artists&artist=new-order)
> 2. August 12, 2018 — [Duran Duran](https://concerts.morperhaus.org/?scene=artists&artist=duran-duran)
>
> One of the venues I've returned to most.

---

## What's linked vs. not

| Element | Linked? | Why |
| --- | --- | --- |
| Headliner | ✅ | Always has an artist card (`headlinerNormalized`) |
| Venue | ✅ | Always has a venue page (`venueNormalized`) |
| Opener | ❌ | Plain string, no slug, may have no page → dead link |
| Specific show / date | ❌ | No concert-level deep link exists yet |

## The one risk to eyeball

The tool emits these links, but **Claude paraphrases the tool output** before the user sees
it (the screenshot prose is the model's rewrite, not the raw tool text). So a one-line
instruction — "keep entity names as the markdown links provided" — has to ride along, or
links land inconsistently. That instruction is the only non-obvious piece; everything else
is a small formatting helper.
