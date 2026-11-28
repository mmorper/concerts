/**
 * How It Works: the chapters, in reading order.
 *
 * Each chapter explains one part of the machinery for curious friends: the story first, with
 * "Under the hood" panels for anyone who wants the engineering. Add a chapter to
 * public/data/how-it-works.json and it shows on the landing page, in every chapter's "More from
 * How It Works" footer, and in link previews (once `npm run og:how-it-works` has made its card).
 */

import data from '../../../public/data/how-it-works.json'

export interface Chapter {
  id: string
  path: string
  title: string
  /** One line, for the cards. */
  dek: string
}

/**
 * The list lives in public/data/how-it-works.json, so the link-preview Worker and the share-card
 * script read the same chapters as the site. Each entry there also carries its share card.
 */
export const CHAPTERS: Chapter[] = data.chapters.map(({ id, path, title, dek }) => ({ id, path, title, dek }))

/** Related pages that aren't chapters: plain links, full page loads. */
export const ALSO = [
  {
    href: '/about-mcp',
    title: 'Use the archive in Claude',
    dek: 'Add the archive to Claude and ask it anything about the shows.',
  },
]
