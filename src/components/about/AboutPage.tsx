/**
 * About Page Component
 *
 * Static page providing E-E-A-T signals (Experience, Expertise, Authoritativeness, Trust)
 * for SEO and AI discoverability. Surfaces creator identity, origin story, and external links.
 */

import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, Github, ExternalLink } from 'lucide-react'

/** LinkedIn brand icon SVG */
const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 72 72"
    className={className}
    fill="currentColor"
  >
    <rect width="72" height="72" rx="8" fill="#0A66C2" />
    <path
      d="M20.053 55H12V27.71h8.053V55zM16 24c-2.63 0-4-1.607-4-3.607C12 17.787 13.404 16 16.105 16c2.667 0 4.053 1.787 4.053 4.393 0 2-1.404 3.607-4.158 3.607zm38 31h-8.457V40.607c0-3.786-1.456-6.393-4.965-6.393-2.667 0-4.158 1.787-4.86 3.536-.26.607-.26 1.464-.26 2.322V55H27.001V27.71h8.457v3.394c1.23-1.786 3.053-4.393 7.585-4.393 5.525 0 9.957 3.607 9.957 11.393V55z"
      fill="#fff"
    />
  </svg>
)

/** LinkedIn articles about building this project */
interface LinkedInPost {
  title: string
  date: string
  url: string
  preview: string
}

const LINKEDIN_POSTS: LinkedInPost[] = [
  {
    title: 'Claude Code Is a Misnomer',
    date: 'January 11, 2026',
    url: 'https://www.linkedin.com/pulse/claude-code-misnomer-mike-morper-ulvjc/',
    preview: 'It writes code, yes. But that\'s not why it changed how I work—as a marketer.',
  },
  {
    title: "I Can't Evaluate Code. Here's What I Evaluate Instead.",
    date: 'January 19, 2026',
    url: 'https://www.linkedin.com/pulse/i-cant-evaluate-code-heres-what-instead-mike-morper-fhjzc/',
    preview: 'The method behind the concert app, revealed.',
  },
]

export function AboutPage() {
  const navigate = useNavigate()
  const headerRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    // Focus header for accessibility
    setTimeout(() => {
      headerRef.current?.focus()
    }, 100)
  }, [])

  return (
    <main className="min-h-screen bg-black text-white overflow-y-auto h-screen">
      <div className="max-w-7xl mx-auto px-6 lg:px-20 py-12">
        {/* Header */}
        <header className="mb-12" role="banner">
          <button
            onClick={() => navigate('/')}
            className="text-slate-300 hover:text-white transition-colors mb-8 flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Timeline</span>
          </button>

          <motion.h1
            ref={headerRef}
            tabIndex={-1}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-5xl lg:text-6xl font-display text-amber-400 mb-3 outline-none"
          >
            About the Archive
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-slate-400 text-lg"
          >
            The human behind the data
          </motion.p>
        </header>

        {/* The Archivist */}
        <section aria-label="About the creator" className="mb-16">
          <motion.h2
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xs uppercase tracking-widest text-slate-500 font-medium mb-6"
          >
            The Archivist
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-slate-900/50 border border-slate-800 rounded-lg p-6"
          >
            <h3 className="text-2xl font-display text-white mb-2">Mike Morper</h3>
            <p className="text-slate-400 mb-4">
              Product Marketer, concert enthusiast
              <br />
              Southern California
            </p>
            <div className="flex gap-4">
              <a
                href="https://www.linkedin.com/in/morps/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-2"
              >
                <LinkedInIcon className="w-5 h-5" />
                <span>LinkedIn</span>
              </a>
              <a
                href="https://github.com/mmorper/concerts"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-2"
              >
                <Github className="w-5 h-5" />
                <span>GitHub</span>
              </a>
            </div>
          </motion.div>
        </section>

        {/* The Origin Story */}
        <section aria-label="Origin story" className="mb-16">
          <motion.h2
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-xs uppercase tracking-widest text-slate-500 font-medium mb-6"
          >
            The Origin Story
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="prose prose-invert prose-slate max-w-none"
          >
            <p className="text-slate-300 text-lg leading-relaxed mb-4">
              Concerts since 1984. My wife and I have been going together since we started dating
              in the '90s—arena tours, sweaty club shows, bands we grew up worshipping, openers
              we'd never heard of who blew us away.
            </p>
            <p className="text-slate-300 text-lg leading-relaxed mb-4">
              During the pandemic, we started listing every show we'd ever attended in a Google
              Sheet. I feature-creeped it almost immediately—opening acts, venues, genres, who
              attended. What started as a list became a database.
            </p>
            <p className="text-slate-300 text-lg leading-relaxed mb-4">
              For a while I had it hooked up to Looker Studio. Functional, but lifeless. Data, not
              memories.
            </p>
            <p className="text-slate-300 text-lg leading-relaxed">
              This project is my attempt to make it <em>feel</em> like flipping through ticket
              stubs.
            </p>
          </motion.div>
        </section>

        {/* How It's Built */}
        <section aria-label="How it's built" className="mb-16">
          <motion.h2
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="text-xs uppercase tracking-widest text-slate-500 font-medium mb-6"
          >
            How It's Built
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="prose prose-invert prose-slate max-w-none"
          >
            <p className="text-slate-300 text-lg leading-relaxed mb-4">
              I'm not an engineer. I'd never built a data pipeline, integrated an API, or written a
              React component. But I had{' '}
              <a
                href="https://www.anthropic.com/claude-code"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300"
              >
                Claude Code
              </a>{' '}
              and a hypothesis: I didn't need to know <em>how</em> to code. I just needed to know{' '}
              <em>what</em> I wanted. If you're interested,{' '}
              <a
                href="https://www.linkedin.com/pulse/claude-code-misnomer-mike-morper-ulvjc/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300"
              >
                I wrote about this
              </a>
              .
            </p>
            <p className="text-slate-300 text-lg leading-relaxed mb-4">
              The result: ~29,000 lines of code, six API integrations, 305 automated tests (and
              counting!), and an experience I'm genuinely proud of. I can't tell you if the code is
              good—but the product works and the experience delights.
            </p>
            <p className="text-slate-400">
              Curious about the technical details?{' '}
              <a
                href="https://github.com/mmorper/concerts#readme"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
              >
                Check out the README on GitHub
                <ExternalLink className="w-4 h-4" />
              </a>
            </p>
          </motion.div>
        </section>

        {/* Writing */}
        {LINKEDIN_POSTS.length > 0 && (
          <section aria-label="Writing" className="mb-16">
            <motion.h2
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="text-xs uppercase tracking-widest text-slate-500 font-medium mb-6"
            >
              Writing
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.85 }}
              className="text-slate-400 mb-6"
            >
              Reflections on building with AI—a series exploring what happens when a non-developer
              picks up Claude Code.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.9 }}
              className="space-y-3"
            >
              {LINKEDIN_POSTS.map((post, index) => (
                <a
                  key={index}
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-4 bg-slate-900/50 border border-slate-800 rounded-lg p-5 hover:border-amber-500/50 transition-colors group"
                >
                  <div className="flex-shrink-0 mt-1">
                    <LinkedInIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-white font-medium group-hover:text-amber-400 transition-colors">
                        {post.title}
                      </h3>
                      <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors flex-shrink-0" />
                    </div>
                    <p className="text-slate-400 text-sm mb-2">{post.preview}</p>
                    <p className="text-slate-500 text-xs">{post.date}</p>
                  </div>
                </a>
              ))}
            </motion.div>
          </section>
        )}
      </div>
    </main>
  )
}
