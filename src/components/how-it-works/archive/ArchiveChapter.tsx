/**
 * /how-it-works/the-archive: how a row in a spreadsheet becomes the archive.
 *
 * Same shape as the Now Spinning chapter: the story reads straight through, each step has one
 * diagram, and "Under the hood" panels hold the engineering. Facts come from
 * docs/DATA_PIPELINE.md, scripts/ and .github/workflows/data-refresh.yml.
 */
import { motion, MotionConfig } from 'framer-motion'
import { PageNav } from '../../liner-notes/PageNav'
import { Hood, MoreChapters, Prose, Section, Wide, usePageTitle } from '../shared'
import { ArchiveHero } from './ArchiveHero'
import { ArchiveJourney } from './ArchiveJourney'
import { ThreeWords } from './ThreeWords'
import { OneName } from './OneName'
import { MapStep } from './MapStep'
import { FaceStep } from './FaceStep'
import { SoundStep } from './SoundStep'
import { SetlistStep } from './SetlistStep'
import { LandsStep } from './LandsStep'

export function ArchiveChapter() {
  usePageTitle('How the Archive Is Built | Morperhaus Concert Archives')

  return (
    <MotionConfig reducedMotion="user">
      <main className="hiw h-screen overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-12 pt-10">
          <PageNav current="how-it-works" theme="dark" />
        </div>

        <article className="px-4 sm:px-6">
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <motion.header initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
              <div className="hiw-kicker mb-5">
                <span className="hiw-dot" aria-hidden="true" />
                How It Works · Chapter 1
              </div>
              <h1 className="hiw-title" style={{ fontSize: 'clamp(40px, 7vw, 66px)' }}>
                How the Archive Is Built
              </h1>
              <p className="hiw-dek font-sans mt-4" style={{ fontSize: 'clamp(19px, 2.4vw, 22px)', lineHeight: 1.5, color: 'var(--hiw-ink-2)' }}>
                A few words in a spreadsheet become forty years of live music.
              </p>
            </motion.header>
          </div>

          <div style={{ maxWidth: 1000, margin: '36px auto 0' }}>
            <ArchiveHero />
          </div>

          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div className="mt-12">
              <Prose>
                <p>
                  I keep a spreadsheet of every concert I’ve been to. Each row has the date, the band, the venue and the
                  city. That’s all I type.
                </p>
                <p>
                  Everything else on this site comes from those few words: the maps, the band photos, the song previews
                  and the setlists. This page shows how.
                </p>
              </Prose>
            </div>

            <Section id="journey" title="The whole journey">
              <Prose>
                <p>
                  Most of the work happens once a week, in an automatic update. The update reads my spreadsheet, asks
                  other services about every band, venue and night, and saves their answers. When you visit the site,
                  you’re reading those saved answers.
                </p>
                <p>
                  Press <em>Play</em> to follow one week, step by step. Switch to <em>Under the hood</em> to see the real
                  names of each part.
                </p>
              </Prose>
              <Wide>
                <ArchiveJourney />
              </Wide>
            </Section>

            <Section id="row" step="Step 1" title="A row in a spreadsheet">
              <Prose>
                <p>
                  The spreadsheet is a Google Sheet. Each concert is one row: the date, the headliner, the genre, any
                  opening acts, the venue and the city.
                </p>
                <p>
                  Some things can be worked out from the row alone, with no outside help: the day of the week, the decade,
                  and a simple version of each name, all lowercase with hyphens. The site uses those simple names to link
                  pages together.
                </p>
              </Prose>
              <Wide>
                <ThreeWords />
              </Wide>
              <Hood chapter="the-archive" id="row" title="Reading the sheet">
                <ul>
                  <li>
                    <strong>The reader.</strong> <code>scripts/fetch-google-sheet.ts</code> reads the sheet through the
                    Google Sheets API and writes <code>public/data/concerts.json</code>. A row with no headliner is
                    skipped. A row with no venue is kept, with a warning.
                  </li>
                  <li>
                    <strong>Simple names.</strong> Lowercase, with anything that isn’t a letter or a number turned into a
                    hyphen: “Depeche Mode” becomes <code>depeche-mode</code>. They appear in every link on the site, for
                    example <code>/?scene=artists&amp;artist=depeche-mode</code>.
                  </li>
                  <li>
                    <strong>A safety check.</strong> Before the weekly update saves anything, it counts the concerts. If
                    more than two have disappeared, it saves nothing and reports a failure instead.
                  </li>
                </ul>
              </Hood>
            </Section>

            <Section id="names" step="Step 2" title="One name, one band">
              <Prose>
                <p>
                  Bands don’t always perform under the same name. In my archive, Brian Setzer appears under four different
                  names. A short list tells the site that all four are the same person, so his page shows all of those
                  shows together.
                </p>
                <p>
                  The list also records the opposite case. Stray Cats include Brian Setzer, but they’re a different band,
                  so the site keeps them separate.
                </p>
              </Prose>
              <Wide>
                <OneName />
              </Wide>
              <Hood chapter="the-archive" id="names" title="The list of names">
                <ul>
                  <li>
                    <strong>Kept by hand.</strong> I edit <code>data/artist-aliases.json</code> myself. The update copies
                    it to <code>public/data/</code>, where the site and the Claude connector both read it.
                  </li>
                  <li>
                    <strong>Two kinds of entry.</strong> <code>sameAct</code> joins several names into one artist.{' '}
                    <code>sharesMember</code> links two bands that share a member, without joining them.
                  </li>
                </ul>
              </Hood>
            </Section>

            <Section id="map" step="Step 3" title="Putting it on the map">
              <Prose>
                <p>
                  A venue name and a city aren’t enough to draw a map. So the update asks Google where each venue is.
                  Google sends back the full address, the exact location, and a photo of the venue.
                </p>
                <p>
                  Pick a venue below to see what comes back, and where it sits among the other venues I’ve been to.
                </p>
              </Prose>
              <Wide>
                <MapStep />
              </Wide>
              <Hood chapter="the-archive" id="map" title="Locations and photos">
                <ul>
                  <li>
                    <strong>Locations</strong> come from Google’s geocoding service. Each venue’s location is saved, so
                    it’s looked up only once.
                  </li>
                  <li>
                    <strong>Addresses and photos</strong> come from Google Places (<code>scripts/enrich-venues.ts</code>)
                    and are saved in <code>venues-metadata.json</code>. Google’s photo links expire, so the photos are
                    refreshed every 7 days.
                  </li>
                  <li>
                    <strong>Closed venues stay.</strong> Irvine Meadows was demolished in 2016, but it’s still on the map
                    where it stood, marked as demolished.
                  </li>
                </ul>
              </Hood>
            </Section>

            <Section id="face" step="Step 4" title="A photo for every band">
              <Prose>
                <p>
                  Every band needs a photo. The update asks one service first. If that service has nothing, it asks a
                  second one. If neither has a photo, the site shows a simple tile with the band’s initials.
                </p>
                <p>
                  <strong>It never guesses.</strong> Two acts can share a name. On one service, “Heart” leads to someone
                  else’s song, and “James” leads to a Dutch rapper. For bands like these, the update never asks that
                  service. A plain tile is better than a stranger’s face.
                </p>
              </Prose>
              <Wide>
                <FaceStep />
              </Wide>
              <Hood chapter="the-archive" id="face" title="Who is asked, and in what order">
                <ul>
                  <li>
                    <strong>TheAudioDB first,</strong> for a photo, a short biography and genres. Then{' '}
                    <strong>Deezer</strong>, for a photo only (<code>scripts/enrich-artists.ts</code>).
                  </li>
                  <li>
                    <strong>Shorter names are tried too.</strong> If “Brian Setzer and the Nashvillians” finds nothing,
                    the update tries “Brian Setzer”. A leading “DJ” is also dropped.
                  </li>
                  <li>
                    <strong>Two exception lists</strong> keep certain bands away from Deezer. One is for names Deezer
                    gives to a different act. The other is for acts Deezer has a wrong picture of: its Sting photo is a
                    record cover.
                  </li>
                  <li>
                    <strong>Answers are kept for 30 days,</strong> so most weeks only new bands are looked up.
                  </li>
                </ul>
              </Hood>
            </Section>

            <Section id="sound" step="Step 5" title="The sound">
              <Prose>
                <p>
                  For each band, the update finds a few of its best-known songs, as 30-second previews with their album
                  covers. These are the previews that play on the artist pages. Try one below.
                </p>
              </Prose>
              <Wide>
                <SoundStep />
              </Wide>
              <Hood chapter="the-archive" id="sound" title="Where the previews come from">
                <ul>
                  <li>
                    <strong>Apple Music</strong> (<code>scripts/enrich-top-tracks.ts</code>). The previews play from
                    Apple’s servers. The archive stores only the links.
                  </li>
                  <li>
                    <strong>Checked every 30 days.</strong> The links rarely change, so there’s no need to ask more often.
                  </li>
                </ul>
              </Hood>
            </Section>

            <Section id="setlists" step="Step 6" title="The setlists">
              <Prose>
                <p>
                  My favourite part of the archive is knowing what was played. For each band on each night, the update
                  asks setlist.fm, a website where fans record setlists. Then it matches each song to the album it comes
                  from.
                </p>
                <p>
                  Cover songs are handled carefully. Social Distortion often play “Ring of Fire”, which they didn’t write.
                  setlist.fm marks it as a cover, and the archive lists it under the Social Distortion album where they
                  recorded their own version.
                </p>
              </Prose>
              <Wide>
                <SetlistStep />
              </Wide>
              <Hood chapter="the-archive" id="setlists" title="Setlists and albums">
                <ul>
                  <li>
                    <strong>setlist.fm</strong> is asked about each band on each night
                    (<code>scripts/prefetch-setlists.ts</code>). A setlist with songs is saved for good. A night with no
                    setlist yet is asked about again later, because fans sometimes add one weeks after the show.
                  </li>
                  <li>
                    <strong>Albums</strong> come from MusicBrainz. Songs are matched to albums by title, with strict rules:
                    no match is better than a wrong one (<code>scripts/resolve-song-albums.ts</code>).
                  </li>
                  <li>
                    <strong>Album covers</strong> come from Apple’s catalogue: one request per band, saved for 90 days.
                  </li>
                </ul>
              </Hood>
            </Section>

            <Section id="lands" title="Where it all lands">
              <Prose>
                <p>
                  Here’s the result. Search for any concert in the archive and see where its row ends up on the site: on
                  the timeline, on the map, on the band’s page, and in its setlist.
                </p>
              </Prose>
              <Wide>
                <LandsStep />
              </Wide>
            </Section>

            <Section id="fresh" title="Keeping it up to date">
              <Prose>
                <p>
                  The update runs every Monday morning. I can also start it by hand after adding a show.
                </p>
                <p>
                  Most answers are saved from earlier weeks, so a normal week asks few new questions. The update asks
                  about new bands, new venues and new nights. It also re-checks a few things that change: venue photos,
                  and nights that don’t have a setlist yet.
                </p>
                <p>
                  Before saving anything, the update checks that no concerts have gone missing. If more than two have
                  disappeared, it stops and saves nothing.
                </p>
              </Prose>
            </Section>

            <Section id="tradeoffs" title="The trade-offs">
              <Prose>
                <p>Every design has costs. These are the ones I accepted.</p>
              </Prose>
              <ul className="hiw-prose mt-4" style={{ listStyle: 'disc', paddingLeft: 22 }}>
                <li>
                  <strong>Up to a week behind.</strong> A new show appears after the next update, not the moment I type it.
                  In return, the site is fast, because it never has to wait for another service while you browse.
                </li>
                <li className="mt-2">
                  <strong>Gaps instead of guesses.</strong> Some bands have no photo, some songs have no album, and some
                  nights have no setlist. The site shows the gap rather than something that might be wrong.
                </li>
                <li className="mt-2">
                  <strong>Borrowed information.</strong> The photos, previews, albums and setlists come from free outside
                  services. If one of them has a mistake, it can appear here until it’s fixed.
                </li>
                <li className="mt-2">
                  <strong>One thing is live.</strong> Upcoming tour dates are looked up while you browse, so they’re always
                  current. But they only appear when that service is working.
                </li>
              </ul>
            </Section>
          </div>
        </article>

        <MoreChapters current="the-archive" />
      </main>
    </MotionConfig>
  )
}
