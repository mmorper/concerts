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
                  Every concert in this archive started as one row in a spreadsheet I keep: the date, the band, the venue
                  and the city. Everything else on this site, the maps, the band photos, the setlists and the song
                  previews, is built from those few words.
                </p>
                <p>
                  Most of that work happens once a week, before anyone visits. When you open the site, you’re reading
                  answers that were worked out ahead of time.
                </p>
              </Prose>
            </div>

            <Section id="journey" title="The whole journey">
              <Prose>
                <p>
                  Press <em>Play</em> to follow one week, from the spreadsheet to this page. Switch to{' '}
                  <em>Under the hood</em> to see the real names of each part.
                </p>
              </Prose>
              <Wide>
                <ArchiveJourney />
              </Wide>
            </Section>

            <Section id="row" step="Step 1" title="A row in a spreadsheet">
              <Prose>
                <p>
                  I keep the list in a Google Sheet. Each concert is one row: the date, the headliner, the genre, any
                  opening acts, the venue and the city. That’s all I type.
                </p>
                <p>
                  Before asking anyone else anything, the build works out what it can on its own: the day of the week,
                  the decade, and a plain-text version of each name. Those plain-text names are how the rest of the site
                  links things together.
                </p>
              </Prose>
              <Wide>
                <ThreeWords />
              </Wide>
              <Hood chapter="the-archive" id="row" title="Reading the sheet">
                <ul>
                  <li>
                    <strong>The reader.</strong> <code>scripts/fetch-google-sheet.ts</code> reads the sheet through the
                    Google Sheets API and writes <code>public/data/concerts.json</code>. A row without a headliner is
                    skipped, and a row without a venue gets a warning.
                  </li>
                  <li>
                    <strong>Plain-text names.</strong> Lowercase, with anything that isn’t a letter or a number turned
                    into a hyphen: “Depeche Mode” becomes <code>depeche-mode</code>. They’re the keys in every link on
                    the site, such as <code>/?scene=artists&amp;artist=depeche-mode</code>.
                  </li>
                  <li>
                    <strong>A safety net.</strong> Before the weekly refresh saves anything, it checks the number of
                    concerts. If it has dropped sharply, nothing is saved and the run fails loudly instead.
                  </li>
                </ul>
              </Hood>
            </Section>

            <Section id="names" step="Step 2" title="One name, one band">
              <Prose>
                <p>
                  Bands don’t always use the same name. Brian Setzer has played under four different names in my
                  archive. A short list of aliases tells the site they’re the same person, so his page shows every one
                  of those shows together.
                </p>
                <p>
                  The same list records the opposite case too. Stray Cats share a member with him, but they’re a
                  different band, so they stay separate.
                </p>
              </Prose>
              <Wide>
                <OneName />
              </Wide>
              <Hood chapter="the-archive" id="names" title="The alias list">
                <ul>
                  <li>
                    <strong>Kept by hand.</strong> <code>data/artist-aliases.json</code> is edited by hand. The build
                    copies it to <code>public/data/</code>, where the site and the Claude connector both read it.
                  </li>
                  <li>
                    <strong>Two kinds of link.</strong> <code>sameAct</code> merges billings into one artist.{' '}
                    <code>sharesMember</code> links two bands that share a person without merging them.
                  </li>
                </ul>
              </Hood>
            </Section>

            <Section id="map" step="Step 3" title="Putting it on the map">
              <Prose>
                <p>
                  A venue name and a city aren’t enough to draw a map. So the build asks Google where each venue is. It
                  gets back a full address and a pair of coordinates, plus a photo of the venue. The coordinates are
                  saved for good; the photos are refreshed every week, because Google’s photo links expire.
                </p>
              </Prose>
              <Wide>
                <MapStep />
              </Wide>
              <Hood chapter="the-archive" id="map" title="Coordinates and photos">
                <ul>
                  <li>
                    <strong>Coordinates</strong> come from Google’s geocoding service and are saved per venue, so a venue’s
                    location is looked up once.
                  </li>
                  <li>
                    <strong>The address and photo</strong> come from Google Places (<code>scripts/enrich-venues.ts</code>)
                    and are published in <code>venues-metadata.json</code>. Google’s photo links expire, so the photos are
                    refreshed on a 7-day cycle.
                  </li>
                  <li>
                    <strong>Closed venues</strong> are part of the history too. Irvine Meadows was demolished in 2016, but
                    it stays on the map where it stood, marked as demolished.
                  </li>
                </ul>
              </Hood>
            </Section>

            <Section id="face" step="Step 4" title="A face for every band">
              <Prose>
                <p>
                  Every band needs a photo. The build asks one service first. If it has nothing, it asks a second. If
                  neither has a photo, the site draws its own tile instead.
                </p>
                <p>
                  <strong>It never guesses.</strong> A matching name isn’t always the same band: on one service, “Heart”
                  is someone else’s single and “James” is a Dutch rapper. For bands like those, the build skips that
                  service entirely. A plain tile is better than a stranger’s face.
                </p>
              </Prose>
              <Wide>
                <FaceStep />
              </Wide>
              <Hood chapter="the-archive" id="face" title="The fallback chain">
                <ul>
                  <li>
                    <strong>TheAudioDB first,</strong> for a photo, a short biography and genres. Then{' '}
                    <strong>Deezer</strong>, for a photo only (<code>scripts/enrich-artists.ts</code>).
                  </li>
                  <li>
                    <strong>Simpler names are tried too.</strong> “Brian Setzer and the Nashvillians” is also tried as
                    “Brian Setzer”, and a leading “DJ” is dropped.
                  </li>
                  <li>
                    <strong>Two exception lists</strong> keep certain bands away from Deezer: one for names it gives to a
                    different act, one for acts it has right but pictures wrong (its Sting photo is a record cover).
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
                  For each band, the build fetches a few of its best-known songs as 30-second previews, with their album
                  covers. That’s what plays on the artist pages. Try one.
                </p>
              </Prose>
              <Wide>
                <SoundStep />
              </Wide>
              <Hood chapter="the-archive" id="sound" title="Where the previews come from">
                <ul>
                  <li>
                    <strong>Apple Music first, Deezer as the backup</strong> (<code>scripts/enrich-top-tracks.ts</code>).
                    The previews stream from their servers; the archive stores only the links.
                  </li>
                  <li>
                    <strong>Refreshed every 30 days.</strong> The links don’t change, so there’s no need to ask more often.
                  </li>
                </ul>
              </Hood>
            </Section>

            <Section id="setlists" step="Step 6" title="The setlists">
              <Prose>
                <p>
                  The best part of the archive is knowing what was played. For each band on each night, the build asks
                  setlist.fm, a site where fans write down setlists. Then it matches every song to the album it comes
                  from.
                </p>
                <p>
                  Covers get credited properly. When Social Distortion play “Ring of Fire”, setlist.fm notes the song’s
                  original, and the archive files it under the Social Distortion album they recorded it on.
                </p>
              </Prose>
              <Wide>
                <SetlistStep />
              </Wide>
              <Hood chapter="the-archive" id="setlists" title="Setlists and albums">
                <ul>
                  <li>
                    <strong>setlist.fm</strong> is asked once per band per night, and a setlist with songs is saved for good
                    (<code>scripts/prefetch-setlists.ts</code>). A night with no setlist yet is asked about again on later
                    runs, because fans sometimes write one up weeks after the show.
                  </li>
                  <li>
                    <strong>Albums</strong> come from MusicBrainz. Each song is matched to an album by name, with the same
                    careful rules as the rest of the archive: no match is better than a wrong one
                    (<code>scripts/resolve-song-albums.ts</code>).
                  </li>
                  <li>
                    <strong>Album covers</strong> come from Apple’s catalogue, one request per band, kept for 90 days.
                  </li>
                </ul>
              </Hood>
            </Section>

            <Section id="lands" title="Where it all lands">
              <Prose>
                <p>
                  All of that comes together on the site. Search for any concert in the archive and see where its row
                  ended up: a dot on the timeline, a pin on the map, a face and a song, and a setlist.
                </p>
              </Prose>
              <Wide>
                <LandsStep />
              </Wide>
            </Section>

            <Section id="fresh" title="Keeping it fresh">
              <Prose>
                <p>
                  The whole process runs again every Monday morning, and I can also start it by hand after adding a show.
                  Most of the answers are already saved from earlier weeks, so a normal week asks very few new questions.
                  Only new bands, new venues and new nights go out to the services.
                </p>
                <p>
                  Before it saves anything, the build checks that nothing has gone missing. If the number of concerts
                  drops sharply, it stops and saves nothing.
                </p>
              </Prose>
            </Section>

            <Section id="tradeoffs" title="The trade-offs">
              <Prose>
                <p>Every design has costs. These are the ones I accepted.</p>
              </Prose>
              <ul className="hiw-prose mt-4" style={{ listStyle: 'disc', paddingLeft: 22 }}>
                <li>
                  <strong>A week behind, at most.</strong> Because the work happens ahead of time, a new show appears after
                  the next run, not the moment I type it. In return, the site is fast and never waits on another service
                  while you browse.
                </li>
                <li className="mt-2">
                  <strong>Gaps instead of guesses.</strong> Some bands have no photo, some songs no album, and some nights
                  no setlist. The site shows the gap rather than something that might be wrong.
                </li>
                <li className="mt-2">
                  <strong>Borrowed knowledge.</strong> Photos, previews, albums and setlists come from free outside
                  services. If one of them has something wrong, it can show up here until it’s corrected or added to an
                  exception list.
                </li>
                <li className="mt-2">
                  <strong>One live exception.</strong> Upcoming tour dates are looked up while you browse, so they’re
                  current, but they depend on that service being available.
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
