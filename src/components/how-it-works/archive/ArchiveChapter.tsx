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
          </div>
        </article>

        <MoreChapters current="the-archive" />
      </main>
    </MotionConfig>
  )
}
