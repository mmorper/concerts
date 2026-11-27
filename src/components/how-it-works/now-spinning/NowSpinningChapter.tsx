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
            <h1 className="hiw-title" style={{ fontSize: 'clamp(44px, 8vw, 72px)' }}>
              Now Spinning
            </h1>
            <p className="font-sans mt-4" style={{ fontSize: 'clamp(19px, 2.4vw, 22px)', lineHeight: 1.5, color: 'var(--hiw-ink-2)' }}>
              When I play a record, the TV shows the song and every time I’ve heard it live.
            </p>
          </motion.header>

          <motion.figure initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15 }} className="mt-8">
            <picture>
              <source srcSet="/images/how-it-works/now-spinning-living-room.webp" type="image/webp" />
              <img
                src="/images/how-it-works/now-spinning-living-room.jpg"
                width={1280}
                height={960}
                alt="A turntable and speakers on a sideboard under a wall-mounted TV. The Royal Blood album leans on the centre speaker. On the TV: Now Spinning, “Out of the Black” by Royal Blood. You’ve heard this one live 3 times: May 7, 2022 at the House of Blues Anaheim, and June 6, 2017 and June 10, 2015 at the 9:30 Club."
                className="block w-full h-auto"
                style={{ borderRadius: 16, border: '1px solid var(--hiw-panel-line)' }}
              />
            </picture>
            <figcaption className="hiw-figcaption mt-3 px-1">
              Royal Blood’s “Out of the Black” is playing. The TV shows the three nights I heard them play it.
            </figcaption>
          </motion.figure>

          <div className="mt-12">
            <Prose>
              <p>
                When a record plays on our living-room turntable, the TV shows three things: the song, the album, and
                every concert where I heard that song live. It also shows my photos from those concerts. Nobody has to
                touch a phone or a remote.
              </p>
              <p>
                Four separate pieces make this happen. Each one does a single job and passes the result to the next.
                This page shows the whole journey first, then explains each step.
              </p>
            </Prose>
          </div>

          <Section id="round-trip" title="The whole journey">
            <Prose>
              <p>
                A small computer in the house listens to the record. It sends a short fingerprint of the sound to
                Shazam, which sends back the song’s name. The computer then asks my concert archive about that song,
                and the archive sends the answer to the TV. The music itself never leaves the house.
              </p>
              <p>
                Press <em>Play a record</em> to watch one song make the trip. Switch to <em>Under the hood</em> to see
                the real names of each part.
              </p>
            </Prose>
            <Wide>
              <RoundTrip />
            </Wide>
          </Section>

          <Section id="ear" step="Step 1" title="Listening">
            <Prose>
              <p>
                The turntable plays through our stereo receiver as usual. The receiver has a second output, normally
                used to send music to another room. I connected that output to a Raspberry Pi, a small computer about
                the size of a deck of cards.
              </p>
              <p>
                <strong>There is no microphone.</strong> The Pi gets the sound straight from the receiver through a
                cable, so it hears only the record, not the room. It listens only when the receiver is switched to the
                turntable. When it hears sound after a few seconds of silence, it knows a new song has started.
              </p>
            </Prose>
            <div className="mt-6">
              <Hood chapter="now-spinning" id="ear" title="How the Pi listens">
                <ul>
                  <li>
                    <strong>The connection.</strong> The receiver’s second-room output (its “Zone 2” output, set to the
                    turntable) goes into a USB audio interface, a Mackie Onyx Blackjack, plugged into the Pi. The Pi
                    records at 44.1 kHz, CD quality, and combines the two stereo channels into one.
                  </li>
                  <li>
                    <strong>Only when the turntable is on.</strong> Every 5 seconds the Pi asks the receiver over the
                    home network which input it is using. It listens only while the receiver is on and set to the
                    turntable.
                  </li>
                  <li>
                    <strong>What counts as silence.</strong> Anything quieter than −50 dBFS (a measure of digital loudness
                    where 0 is the loudest possible). Four seconds of silence is the gap between two songs. Three minutes
                    means the record has ended.
                  </li>
                  <li>
                    <strong>When it asks Shazam.</strong> As soon as it has 12 seconds of a new song. After that, it
                    checks again every 30 seconds to catch the next track. To replace a song already on screen, two
                    checks in a row must agree, so the screen never flips between guesses.
                  </li>
                  <li>
                    <strong>Telling the needle’s position by sound.</strong> I measured the levels on my own setup. Loud
                    music is about −31 dBFS. A needle sitting in the silent groove at the end of a side is about −52. A
                    lifted needle is about −96. The difference decides how long the Pi waits before switching the
                    receiver back to the Apple TV.
                  </li>
                  <li>
                    <strong>Kept on a short leash.</strong> The listener is a Python program run by systemd (Linux’s
                    service manager) as its own restricted user. It can write to one folder only, and it accepts no
                    incoming connections.
                  </li>
                </ul>
              </Hood>
            </div>
          </Section>

          <Section id="name" step="Step 2" title="Naming the song">
            <Prose>
              <p>
                To find out what the song is, the Pi uses Shazam, the same service as the phone app. But the Pi doesn’t
                send Shazam any music. First it turns the 12 seconds of sound into a fingerprint: a pattern made from
                the loudest moments in the sound. Shazam only ever sees that pattern, and the pattern is enough to
                identify the song.
              </p>
              <p>The diagram below shows the four steps. Press <em>Play</em>, or click each step.</p>
            </Prose>
            <Wide>
              <Fingerprint />
            </Wide>
            <Hood chapter="now-spinning" id="name" title="What gets sent, and how well it works">
              <ul>
                <li>
                  <strong>The software.</strong> The Pi uses <code>shazamio</code>, an unofficial Python library for
                  Shazam. It creates the fingerprint on the Pi. The request to Shazam contains the fingerprint, the
                  clip’s length, a time zone and a timestamp. It contains no audio. I checked the library’s source code
                  to confirm this.
                </li>
                <li>
                  <strong>Nothing is saved.</strong> Each 12-second clip is kept in memory just long enough to make the
                  fingerprint, and is never written to disk.
                </li>
                <li>
                  <strong>Tested first.</strong> Before writing any code, I played nine records through the Pi. Shazam
                  identified every song in its catalogue on the first try, including 1980s pressings, a 45
                  (“Funkytown”), live tracks and a megamix. The only misses were songs Shazam doesn’t have: a 1971
                  soundtrack and a rare Devo live album.
                </li>
                <li>
                  <strong>No guessing.</strong> If Shazam can’t identify a song three times in a row, the screen says
                  “Listening… Nothing I recognise yet.”
                </li>
              </ul>
            </Hood>
          </Section>

          <Section id="memory" step="Step 3" title="Checking the archive">
            <Prose>
              <p>
                Shazam knows the song’s name, but it doesn’t know my history. For that, the Pi sends the song’s name to
                my concert archive. The archive is a small program running on Cloudflare, a cloud service. It has every
                setlist from every concert I’ve been to, including the opening acts.
              </p>
              <p>
                The tricky part is that the same song can be written in different ways. Shazam might say{' '}
                <em>“Everything Counts (Remastered 2006)”</em> while the setlist says <em>“Everything Counts.”</em> One
                might say <em>Echo &amp; the Bunnymen</em> and the other <em>Echo and the Bunnymen</em>. So the archive
                tidies both names the same way before comparing them. It uses the same rules as this website, so the TV
                and the website always agree.
              </p>
              <p>
                Then it puts the answer together: how many times I’ve heard the song live, at which concerts, and which
                of those concerts I have photos from.
              </p>
            </Prose>
            <div className="mt-6">
              <Hood chapter="now-spinning" id="memory" title="How the lookup works">
                <ul>
                  <li>
                    <strong>Where it runs.</strong> A Cloudflare Worker, a small program that runs on Cloudflare’s
                    servers, receives the song from the Pi and does the lookup. Only the Pi, using a secret key, can send
                    it songs.
                  </li>
                  <li>
                    <strong>Fast, because it’s prepared ahead of time.</strong> Each time the website is published, it
                    also builds an index: a short table of contents, plus one small file per band. A lookup reads three
                    files at most and takes 4–10 milliseconds. It’s split into small files because one big 360 KB file
                    was too slow for Cloudflare’s free plan, which allows 10 milliseconds per request.
                  </li>
                  <li>
                    <strong>How names are tidied.</strong> The rules remove version labels such as “Remastered” or
                    “Single Version”, but keep brackets that are part of the real title, as in “(Don’t Fear) The
                    Reaper”. They treat “&amp;” as “and”, ignore accents, and split a medley into its separate songs.
                  </li>
                  <li>
                    <strong>Strict and loose matches.</strong> A strict match is needed before the screen claims I heard
                    a song. A loose match can only do one thing: stop the screen from saying “never heard this one
                    live” when a similar title is on a setlist.
                  </li>
                  <li>
                    <strong>A safety check.</strong> The website and the Worker are published separately, and both
                    contain the tidying rules. If the two copies don’t match, the Worker says nothing about the archive
                    rather than risk missing a real match.
                  </li>
                  <li>
                    <strong>It remembers only the present.</strong> A Durable Object (Cloudflare’s storage for one small
                    piece of live data) holds what the screen shows right now and when the Pi last checked in. Nothing
                    else. The Pi checks in every 60 seconds while a record plays. If it stops checking in for 3 minutes,
                    the screen goes back to idle on its own.
                  </li>
                </ul>
              </Hood>
            </div>
          </Section>

          <Section id="screen" step="Step 4" title="Showing it, honestly">
            <Prose>
              <p>
                When the record started, the Pi also turned on the TV and opened the Now Spinning app on the Apple TV.
                The app stays connected to the archive, so the answer appears as soon as it’s ready. The screen shows the
                song, the album, one sentence about my history with the song, and my photos from those concerts.
              </p>
              <p>
                What matters most to me is what the screen <em>won’t</em> say. My setlists aren’t complete. Some older
                concerts have no setlist at all. So the screen never claims more than the setlists can prove.
              </p>
              <p>
                The screen checks a list of statements in order and uses the first one that’s true. Pick a record below
                to watch it work. These answers come live from the archive, using the same lookup as the TV.
              </p>
            </Prose>
            <Wide>
              <HonestyLadder />
            </Wide>
            <Hood chapter="now-spinning" id="screen" title="The app and the TV">
              <ul>
                <li>
                  <strong>The app.</strong> A tvOS app written in SwiftUI. It keeps a live connection (a WebSocket) open
                  to the Worker, so updates arrive instantly. If the connection drops, it checks every 10 seconds until
                  it’s back. I install it myself from Xcode, so it needs reinstalling once a year.
                </li>
                <li>
                  <strong>Turning things on.</strong> The Pi wakes the Apple TV and opens the app using{' '}
                  <code>pyatv</code>, a library for controlling Apple TVs. It turns on the TV itself with Wake-on-LAN, a
                  standard “wake up” network message, because the Apple TV can’t turn the TV on while the receiver is
                  set to the turntable.
                </li>
                <li>
                  <strong>One source of wording.</strong> The Worker writes every sentence. The app only arranges it on
                  the screen.
                </li>
                <li>
                  <strong>Protecting the screen.</strong> The TV is an OLED, which can suffer from images left on too
                  long. Between songs, the text fades after 90 seconds. When nothing is playing, the Apple TV’s
                  screensaver takes over.
                </li>
              </ul>
            </Hood>
          </Section>

          <Section id="doesnt" title="What it doesn’t do">
            <ul className="grid gap-4 sm:grid-cols-2" style={{ listStyle: 'none' }}>
              {[
                ['No microphone', 'The Pi hears only the turntable, through a cable, and only while the turntable is on.'],
                ['No music leaves the house', 'Only the fingerprint is sent to Shazam.'],
                ['No listening history', 'The archive remembers only what’s playing right now. When the record stops, that’s erased. No song is ever logged.'],
                ['No change to watching TV', 'The Apple TV remote works as it always did. When I’m done with records, the Pi switches the receiver back to the Apple TV.'],
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
              <p>Every design has costs. These are the ones I accepted.</p>
            </Prose>
            <ul className="hiw-prose mt-4" style={{ listStyle: 'disc', paddingLeft: 22 }}>
              <li>
                <strong>No internet, no screen.</strong> The archive lives in the cloud so it always matches the website
                and nothing needs copying to the Pi. Without internet, the TV shows nothing. The record still plays.
              </li>
              <li className="mt-2">
                <strong>Shazam may change.</strong> The Pi talks to Shazam through an unofficial library. If Shazam
                changes how it works, recognition stops until the library is updated.
              </li>
              <li className="mt-2">
                <strong>Some records are unknown.</strong> If Shazam doesn’t know a record, the screen just says
                “Listening…”.
              </li>
              <li className="mt-2">
                <strong>The turntable takes the inconvenience, not the family.</strong> After a record ends, the Pi waits
                before switching the receiver back to the Apple TV: about 20 minutes if the needle is lifted, or an hour
                if it’s left on the record. During that wait, someone using the Apple TV remote may need to switch the
                receiver by hand.
              </li>
            </ul>
            <p className="hiw-figcaption mt-12">Built with Claude Code.</p>
          </Section>
        </div>
      </article>

      <MoreChapters current="now-spinning" />
    </main>
    </MotionConfig>
  )
}
