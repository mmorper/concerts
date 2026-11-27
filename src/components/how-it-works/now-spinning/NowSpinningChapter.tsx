/**
 * /how-it-works/now-spinning: how a record on the turntable ends up on the TV.
 *
 * Written for friends: the story reads straight through, and each step has an "Under the hood"
 * panel for the engineers. Facts come from the spec
 * (docs/specs/future/global-now-spinning/global-now-spinning-spec.md) and the code; home-network
 * specifics (addresses, hostnames, what else runs on the Pi, how tokens are kept) stay out.
 */
import type { ReactNode } from 'react'
import { motion, MotionConfig } from 'framer-motion'
import { PageNav } from '../../liner-notes/PageNav'
import { Hood, MoreChapters, usePageTitle } from '../shared'
import { RoundTrip } from './RoundTrip'
import { Fingerprint } from './Fingerprint'
import { HonestyLadder } from './HonestyLadder'

function Section({ id, step, title, children }: { id: string; step?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="mt-20 sm:mt-24">
      {step && (
        <div className="hiw-step mb-3" style={{ color: 'var(--hiw-dot)' }}>
          {step}
        </div>
      )}
      <h2 id={`${id}-h`} className="hiw-h2 mb-6">
        {title}
      </h2>
      {children}
    </section>
  )
}

const Prose = ({ children }: { children: ReactNode }) => <div className="hiw-prose">{children}</div>
const Wide = ({ children }: { children: ReactNode }) => <div className="my-10 -mx-1 sm:-mx-8 lg:-mx-24">{children}</div>

export function NowSpinningChapter() {
  usePageTitle('How Now Spinning Works | Morperhaus Concert Archives')

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
              How It Works · Chapter 2
            </div>
            <h1 className="hiw-title" style={{ fontSize: 'clamp(44px, 8vw, 76px)' }}>
              Now Spinning
            </h1>
            <p className="font-sans mt-5" style={{ fontSize: 'clamp(19px, 2.4vw, 23px)', lineHeight: 1.5, color: 'var(--hiw-ink-2)' }}>
              Put a record on. Seconds later the TV knows the song, and every night I heard it live.
            </p>
          </motion.header>
        </div>

        <motion.figure
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="mt-10"
          style={{ maxWidth: 1040, margin: '40px auto 0' }}
        >
          <picture>
            <source srcSet="/images/how-it-works/now-spinning-living-room.webp" type="image/webp" />
            <img
              src="/images/how-it-works/now-spinning-living-room.jpg"
              width={1280}
              height={960}
              alt="A turntable and speakers on a sideboard under a wall-mounted TV. The Royal Blood album leans on the centre speaker. On the TV: Now Spinning, “Out of the Black” by Royal Blood. You’ve heard this one live 3 times: May 7, 2022 at the House of Blues Anaheim, and June 6, 2017 and June 10, 2015 at the 9:30 Club."
              className="block w-full h-auto"
              style={{ borderRadius: 20, border: '1px solid var(--hiw-panel-line)' }}
            />
          </picture>
          <figcaption className="hiw-figcaption mt-3 px-1">
            Royal Blood, “Out of the Black.” I’ve seen them play it three times, and the TV knows.
          </figcaption>
        </motion.figure>

        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className="mt-14">
            <Prose>
              <p>
                When a record plays on the turntable in our living room, the TV shows the song, its album, and every night
                I heard it live, with my photos from those nights. Nobody picks up a phone. Every concert in the archive is
                a night I was there, so the screen puts that history next to the music playing right now.
              </p>
              <p>
                It looks like magic. It’s four ordinary things handing a song along, each doing one job. Here’s the whole
                trip, then each step up close.
              </p>
            </Prose>
          </div>

          <Section id="round-trip" title="The round trip">
            <Prose>
              <p>
                The music never leaves the house. A fingerprint of it goes out, a song name comes back, the archive is
                asked what that song means to me, and the answer comes home to the TV. Press play to send a record
                around. Switch to <em>Under the hood</em> to see the real parts.
              </p>
            </Prose>
            <Wide>
              <RoundTrip />
            </Wide>
          </Section>

          <Section id="ear" step="Step 1" title="The ear">
            <Prose>
              <p>
                The turntable plays through the receiver like it always has. The receiver also has an output meant for a
                second room, and that’s where the listening happens: it feeds a small USB audio interface plugged into a
                Raspberry Pi, a computer about the size of a deck of cards.
              </p>
              <p>
                <strong>There’s no microphone.</strong> The Pi hears the record down a wire, clean, with none of the room
                in it. It only listens when the receiver is on and set to the turntable. When sound follows a stretch of
                silence, a song has started, and it gets to work.
              </p>
            </Prose>
            <div className="mt-6">
              <Hood chapter="now-spinning" id="ear" title="Gating, silence and the 12-second clip">
                <ul>
                  <li>
                    <strong>The signal.</strong> The receiver’s Zone 2 pre-out, set to Phono at a fixed level, feeds a
                    Mackie Onyx Blackjack over RCA. The Pi records at 44.1 kHz and folds stereo down to mono.
                  </li>
                  <li>
                    <strong>Gating.</strong> Every 5 seconds the Pi asks the receiver, over the network, what it’s doing.
                    It listens only while the main zone is on and set to Phono, and turns Zone 2 on itself.
                  </li>
                  <li>
                    <strong>Silence</strong> is anything under −50 dBFS. Four seconds of it is the gap between songs.
                    Three minutes means the record is over.
                  </li>
                  <li>
                    <strong>First match fast.</strong> As soon as there are 12 seconds of sound, that clip goes for
                    recognition. After that, a fresh clip every 30 seconds catches the next track. Replacing a song
                    already on screen takes two results in a row that agree, so the screen never flickers between
                    guesses.
                  </li>
                  <li>
                    <strong>Measured, not guessed.</strong> Loud music reads about −31 dBFS, the run-out groove −52, a
                    lifted needle −96. Those levels tell “needle left in the run-out” from “needle lifted,” which decides
                    how long the Pi waits before handing the receiver back to the Apple TV.
                  </li>
                  <li>
                    <strong>The service.</strong> Python, run by systemd as its own locked-down user, in a sandbox that
                    can write to one folder. It opens no ports; it only calls out.
                  </li>
                </ul>
              </Hood>
            </div>
          </Section>

          <Section id="name" step="Step 2" title="The name">
            <Prose>
              <p>
                Twelve seconds of the record go to Shazam, the same service as the phone app. Except it isn’t the music
                that goes. The Pi boils the clip down to a fingerprint first: a pattern of the loudest moments in the
                sound. That pattern is all Shazam ever sees, and it’s enough.
              </p>
            </Prose>
            <Wide>
              <Fingerprint />
            </Wide>
            <Hood chapter="now-spinning" id="name" title="What actually gets sent, and how well it works">
              <ul>
                <li>
                  <strong>The client</strong> is <code>shazamio</code>, an unofficial Python library for Shazam. Its
                  core, <code>shazamio-core</code>, computes the signature on the Pi. The request carries that signature,
                  its length, a time zone and a timestamp. No audio. (I checked the library’s source to be sure.)
                </li>
                <li>
                  <strong>Clips live in memory</strong> for one recognition and are never written to disk.
                </li>
                <li>
                  <strong>Tested before any code was written.</strong> Nine records through the real line feed. Every one
                  in Shazam’s catalogue matched on the first try: 1980s pressings, a 45 (“Funkytown”), live tracks, a
                  megamix. The misses were a 1971 soundtrack and a rare Devo live record: gaps in the catalogue, not
                  problems with the audio.
                </li>
                <li>
                  <strong>No guessing.</strong> Three misses in a row and the screen says “Listening… Nothing I recognise
                  yet.”
                </li>
              </ul>
            </Hood>
          </Section>

          <Section id="memory" step="Step 3" title="The memory">
            <Prose>
              <p>
                Shazam knows the song. It doesn’t know me. So the Pi takes the song’s name to the archive: a small
                program running on Cloudflare, out on the internet, that has read every setlist from every show I’ve been
                to, the opening acts included.
              </p>
              <p>
                The hard part is that names are messy. Shazam says <em>“Everything Counts (Remastered 2006)”</em>; the
                setlist says <em>“Everything Counts.”</em> One says <em>Echo &amp; the Bunnymen</em>, the other{' '}
                <em>Echo and the Bunnymen</em>. The archive cleans both sides up the same way, using the same rules the
                website uses, so the TV and the site can never disagree about a song. Then it works out the story: how
                many times I’ve heard it, where, and which of those nights I have photos from.
              </p>
            </Prose>
            <div className="mt-6">
              <Hood chapter="now-spinning" id="memory" title="The index, the matching rules and the dead-man’s switch">
                <ul>
                  <li>
                    <strong>A Cloudflare Worker</strong> receives the song from the Pi (an authenticated POST) and runs the
                    lookup.
                  </li>
                  <li>
                    <strong>A prebuilt index.</strong> Every time the site deploys, it builds a small manifest and one file
                    per act, a few kilobytes each, from the same published data the site uses. A lookup reads at most three
                    files and takes 4–10 ms. It’s split up because it was designed for Cloudflare’s free tier, where one
                    360 KB index was too close to the 10 ms limit.
                  </li>
                  <li>
                    <strong>Matching rules</strong> are shared code with the website. They strip version markers
                    (“Remastered”, “Single Version”) but keep brackets that are part of a title (“(Don’t Fear) The
                    Reaper”), split medleys only on a spaced slash, fold accents, and read “&amp;” as “and”.
                  </li>
                  <li>
                    <strong>Two strengths of match.</strong> Strict keys decide every positive claim. Looser “near miss”
                    keys are allowed to do exactly one thing: stop the screen from saying “never heard this one live” when
                    something close is on a setlist.
                  </li>
                  <li>
                    <strong>A rules fingerprint.</strong> The site and the Worker deploy separately, and both carry the
                    matching rules. The index records a hash of the rules it was built with; if the Worker’s copy
                    disagrees, it says nothing rather than miss real matches.
                  </li>
                  <li>
                    <strong>Only the present.</strong> A Durable Object holds the current screen and when the listener last
                    checked in, and nothing else. The Pi checks in every 60 seconds while a record plays; if it goes quiet
                    for 3 minutes, an alarm sets the screen to idle on its own.
                  </li>
                </ul>
              </Hood>
            </div>
          </Section>

          <Section id="screen" step="Step 4" title="The screen, and what it won’t say">
            <Prose>
              <p>
                The Pi woke the TV the moment the record started, over the network, and brought the Now Spinning app to
                the front. The app keeps a live connection open to the archive, so the answer arrives as a push and the
                screen draws it: the song, the album, one sentence about me and this song, and my photos from those
                nights drifting behind.
              </p>
              <p>
                The part I care about most is what the screen <em>won’t</em> say. My setlists aren’t complete: some old
                shows have none. So the screen never claims more than the data can prove. It asks its questions in order
                and stops at the first yes. Pick a record and watch it decide. These are live answers from the archive.
              </p>
            </Prose>
            <Wide>
              <HonestyLadder />
            </Wide>
            <Hood chapter="now-spinning" id="screen" title="The app, waking the TV, and screen care">
              <ul>
                <li>
                  <strong>A tvOS app</strong> in SwiftUI holds a WebSocket to the Worker and falls back to polling while
                  it’s down. It’s installed from Xcode, so it gets reinstalled once a year. A web page renders the same
                  states for development.
                </li>
                <li>
                  <strong>Waking things up.</strong> The Pi uses <code>pyatv</code> to wake the Apple TV and bring the app
                  forward, and Wake-on-LAN for the TV itself: while the receiver is on the turntable, the Apple TV can’t
                  turn the TV on.
                </li>
                <li>
                  <strong>The Worker writes every word.</strong> The app only lays the screen out, so the TV and the web
                  page can’t phrase things differently.
                </li>
                <li>
                  <strong>The TV is an OLED.</strong> Between songs the last track stays up and its text fades after 90
                  seconds. When nothing is playing, the app hands over to the Apple TV’s screensaver.
                </li>
              </ul>
            </Hood>
          </Section>

          <Section id="doesnt" title="What it doesn’t do">
            <ul className="grid gap-4 sm:grid-cols-2" style={{ listStyle: 'none' }}>
              {[
                ['No microphone', 'It hears the turntable down a wire, and only while the turntable is playing.'],
                ['No audio leaves the house', 'Only the fingerprint goes to Shazam.'],
                ['No history', 'The cloud remembers what’s playing now and nothing else. Stop the record and it’s gone. No song is ever logged.'],
                [
                  'No change to watching TV',
                  'The Apple TV remote works exactly as it did. When the record session ends, the Pi puts the receiver back on the Apple TV.',
                ],
              ].map(([h, b]) => (
                <li key={h} className="hiw-hood" style={{ padding: '16px 18px' }}>
                  <div className="font-sans" style={{ fontSize: 16.5, fontWeight: 600 }}>
                    {h}
                  </div>
                  <p className="font-sans mt-1" style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--hiw-ink-2)' }}>
                    {b}
                  </p>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="tradeoffs" title="The trade-offs">
            <Prose>
              <p>Every design costs something. These are the costs I chose.</p>
            </Prose>
            <ul className="hiw-prose mt-4" style={{ listStyle: 'disc', paddingLeft: 22 }}>
              <li>
                <strong>No internet, no screen.</strong> Keeping the archive in one place means it can’t drift from the
                website, and nothing has to be copied to the Pi when a show is added. The record still plays either way.
              </li>
              <li className="mt-2">
                <strong>Shazam through an unofficial library.</strong> If Shazam changes how it works, recognition stops
                until the library catches up.
              </li>
              <li className="mt-2">
                <strong>A record Shazam doesn’t know</strong> just gets “Listening…”.
              </li>
              <li className="mt-2">
                <strong>The turntable takes the inconvenience, never the family.</strong> For a while after a record ends
                (about 20 minutes, or an hour if the needle is left in the run-out groove), someone reaching for the
                Apple TV remote may have to switch the receiver over by hand.
              </li>
            </ul>
            <p className="hiw-figcaption mt-12">
              Built with Claude Code: a Raspberry Pi, a Cloudflare Worker, a tvOS app, and the archive that was already
              here.
            </p>
          </Section>
        </div>
      </article>

      <MoreChapters current="now-spinning" />
    </main>
    </MotionConfig>
  )
}
