/**
 * Liner-notes prose carries exactly one piece of markdown: album and record
 * titles wrapped in single asterisks — *Born to Kill*, *Songs from the Big
 * Chair*. The generator emits it unprompted, and no surface handled it, so the
 * markers printed literally in the feed, the permalink, the RSS description,
 * the JSON-LD description and the changelog toast.
 *
 * Two ways to handle it, and both are needed: surfaces that can show emphasis
 * render it, surfaces that are plain text drop the markers and keep the words.
 */

/**
 * Splits on the emphasis markers, keeping the marked text. A capturing group
 * in the separator means split() alternates: even indices are plain runs, odd
 * indices are the emphasized ones.
 *
 * Deliberately single-line and non-empty ([^*\n]+), so a lone asterisk or one
 * dangling at the end of a sentence stays literal text rather than swallowing
 * the rest of the post.
 */
const EMPHASIS_SPLIT = /\*([^*\n]+)\*/

/** One run of prose, flagged for whether it was marked as emphasized. */
export interface ProseSegment {
  text: string
  emphasis: boolean
}

/**
 * Splits prose into ordered plain and emphasized runs.
 * Prose with no markers comes back as a single plain segment.
 */
export function splitEmphasis(text: string): ProseSegment[] {
  const segments: ProseSegment[] = []

  text.split(EMPHASIS_SPLIT).forEach((part, i) => {
    if (!part) return
    segments.push({ text: part, emphasis: i % 2 === 1 })
  })

  return segments
}

/** Drops the emphasis markers and keeps the words — for plain-text surfaces. */
export function stripEmphasis(text: string): string {
  return splitEmphasis(text)
    .map((segment) => segment.text)
    .join('')
}
