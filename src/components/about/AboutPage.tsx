/**
 * About Page Component
 *
 * Static page providing E-E-A-T signals (Experience, Expertise, Authoritativeness, Trust)
 * for SEO and AI discoverability. Surfaces creator identity, origin story, and external links.
 */

import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Github, ExternalLink } from 'lucide-react'
import { PageNav } from '../liner-notes/PageNav'

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
  const headerRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    setTimeout(() => {
      headerRef.current?.focus()
    }, 100)
  }, [])

  return (
    <main className="h-screen overflow-y-auto" style={{ background: '#fafaf9' }}>
      <div className="max-w-5xl mx-auto px-6 lg:px-12 py-10">

        <PageNav current="about" theme="light" />

        {/* Page header */}
        <header className="mb-10" role="banner">
          <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#4f46e5', marginBottom: 16 }} />
          <motion.h1
            ref={headerRef}
            tabIndex={-1}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="outline-none mb-2"
            style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: 'clamp(32px, 5vw, 48px)',
              fontWeight: 700,
              color: '#1f2937',
              lineHeight: 1.15,
            }}
          >
            About the Archive
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="font-sans text-gray-500"
            style={{ fontSize: 'clamp(15px, 2vw, 18px)' }}
          >
            The human behind the data
          </motion.p>
        </header>

        {/* The Archivist */}
        <section aria-label="About the creator" className="mb-10">
          <motion.h2
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="font-sans text-xs uppercase tracking-widest text-gray-400 font-semibold mb-4"
          >
            The Archivist
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderLeft: '4px solid #4f46e5',
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              padding: 'clamp(16px, 4vw, 24px)',
            }}
          >
            <h3
              className="mb-1"
              style={{
                fontFamily: 'Playfair Display, serif',
                fontSize: 22,
                fontWeight: 700,
                color: '#1f2937',
              }}
            >
              Mike Morper
            </h3>
            <p className="font-sans text-gray-500 text-sm mb-4">
              Product Marketer, concert enthusiast · Southern California
            </p>
            <div className="flex gap-4">
              <a
                href="https://www.linkedin.com/in/morps/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-sans text-sm text-gray-500 hover:text-indigo-600 transition-colors flex items-center gap-2"
              >
                <LinkedInIcon className="w-4 h-4" />
                LinkedIn
              </a>
              <a
                href="https://github.com/mmorper/concerts"
                target="_blank"
                rel="noopener noreferrer"
                className="font-sans text-sm text-gray-500 hover:text-indigo-600 transition-colors flex items-center gap-2"
              >
                <Github className="w-4 h-4" />
                GitHub
              </a>
            </div>
          </motion.div>
        </section>

        {/* The Origin Story */}
        <section aria-label="Origin story" className="mb-10">
          <motion.h2
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="font-sans text-xs uppercase tracking-widest text-gray-400 font-semibold mb-4"
          >
            The Origin Story
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderLeft: '4px solid #4f46e5',
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              padding: 'clamp(16px, 4vw, 24px)',
            }}
          >
            <p className="font-sans text-gray-700 text-base leading-relaxed mb-4" style={{ lineHeight: 1.7 }}>
              Concerts since 1984. My wife and I have been going together since we started dating
              in the '90s—arena tours, sweaty club shows, bands we grew up worshipping, openers
              we'd never heard of who blew us away.
            </p>
            <p className="font-sans text-gray-700 text-base leading-relaxed mb-4" style={{ lineHeight: 1.7 }}>
              During the pandemic, we started listing every show we'd ever attended in a Google
              Sheet. I feature-creeped it almost immediately—opening acts, venues, genres, who
              attended. What started as a list became a database.
            </p>
            <p className="font-sans text-gray-700 text-base leading-relaxed mb-4" style={{ lineHeight: 1.7 }}>
              For a while I had it hooked up to Looker Studio. Functional, but lifeless. Data, not
              memories.
            </p>
            <p className="font-sans text-gray-700 text-base leading-relaxed" style={{ lineHeight: 1.7 }}>
              This project is my attempt to make it <em>feel</em> like flipping through ticket stubs.
            </p>
          </motion.div>
        </section>

        {/* How It's Built */}
        <section aria-label="How it's built" className="mb-10">
          <motion.h2
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className="font-sans text-xs uppercase tracking-widest text-gray-400 font-semibold mb-4"
          >
            How It&apos;s Built
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderLeft: '4px solid #4f46e5',
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              padding: 'clamp(16px, 4vw, 24px)',
            }}
          >
            <p className="font-sans text-gray-700 text-base leading-relaxed mb-4" style={{ lineHeight: 1.7 }}>
              I'm not an engineer. I'd never built a data pipeline, integrated an API, or written a
              React component. But I had{' '}
              <a
                href="https://www.anthropic.com/claude-code"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Claude Code
              </a>{' '}
              and a hypothesis: I didn't need to know <em>how</em> to code. I just needed to know{' '}
              <em>what</em> I wanted. If you're interested,{' '}
              <a
                href="https://www.linkedin.com/pulse/claude-code-misnomer-mike-morper-ulvjc/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                I wrote about this
              </a>
              .
            </p>
            <p className="font-sans text-gray-700 text-base leading-relaxed mb-4" style={{ lineHeight: 1.7 }}>
              The result: ~29,000 lines of code, six API integrations, 305 automated tests (and
              counting!), and an experience I'm genuinely proud of. I can't tell you if the code is
              good—but the product works and the experience delights.
            </p>
            <p className="font-sans text-gray-500 text-sm">
              Curious about the technical details?{' '}
              <a
                href="https://github.com/mmorper/concerts#readme"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center gap-1"
              >
                Check out the README on GitHub
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </p>
          </motion.div>
        </section>

        {/* Writing */}
        {LINKEDIN_POSTS.length > 0 && (
          <section aria-label="Writing" className="mb-10">
            <motion.h2
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.45 }}
              className="font-sans text-xs uppercase tracking-widest text-gray-400 font-semibold mb-2"
            >
              Writing
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              className="font-sans text-gray-500 text-sm mb-4"
            >
              Reflections on building with AI—a series exploring what happens when a non-developer
              picks up Claude Code.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.55 }}
              className="space-y-3"
            >
              {LINKEDIN_POSTS.map((post, index) => (
                <a
                  key={index}
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-4 group"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 12,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    padding: 'clamp(14px, 3vw, 20px)',
                    display: 'flex',
                    textDecoration: 'none',
                    transition: 'border-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#a5b4fc')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <LinkedInIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3
                        className="font-sans font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors"
                        style={{ fontSize: 15 }}
                      >
                        {post.title}
                      </h3>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-500 transition-colors flex-shrink-0 mt-0.5" />
                    </div>
                    <p className="font-sans text-gray-500 text-sm mb-1">{post.preview}</p>
                    <p className="font-sans text-gray-400 text-xs">{post.date}</p>
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
