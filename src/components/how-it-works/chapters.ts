/**
 * How It Works: the chapters, in reading order.
 *
 * Each chapter explains one part of the machinery for curious friends: the story first, with
 * "Under the hood" panels for anyone who wants the engineering. Add a chapter here and it shows
 * on the landing page and in every chapter's "More from How It Works" footer.
 */

export interface Chapter {
  id: string
  path: string
  title: string
  /** One line, for the cards. */
  dek: string
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'the-archive',
    path: '/how-it-works/the-archive',
    title: 'The Enrichment Cascade',
    dek: 'How three words in a spreadsheet become four decades of live music: photos, maps, setlists and sound.',
  },
  {
    id: 'now-spinning',
    path: '/how-it-works/now-spinning',
    title: 'Now Spinning',
    dek: 'Put a record on. Seconds later the TV knows the song, and every night I heard it live.',
  },
]

/** Related pages that aren't chapters: plain links, full page loads. */
export const ALSO = [
  {
    href: '/about-mcp',
    title: 'Use the archive in Claude',
    dek: 'Add the archive to Claude and ask it anything about the shows.',
  },
]
