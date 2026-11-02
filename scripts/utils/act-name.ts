/**
 * Telling one act from another by name, for the artist-image APIs. Each search ranks by
 * popularity, not by name, so its first result is not always the act asked for.
 */

/**
 * A name reduced to the letters that tell one act from another: no case, accents,
 * punctuation or spaces, and no "the" or "and". "Run–D.M.C." is "Run DMC" and "Joan Jett &
 * the Blackhearts" is "Joan Jett and the Blackhearts", but "Adamant (IT)" is not "Adam Ant"
 * and "Erasure (US)" is not "Erasure".
 */
export function actKey(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && w !== 'the' && w !== 'and')
    .join('')
}

/**
 * The search result that is the act asked for, or null. Deezer's first result for "Adam Ant"
 * was an Italian act called Adamant, and for "Blondie" a duo called Blondie & Pappa. A wrong
 * face on an artist is worse than none: with no match the site falls back to its own tile.
 */
export function matchingArtist<T>(artists: T[], artistName: string, nameOf: (a: T) => string): T | null {
  const key = actKey(artistName)
  return artists.find((a) => actKey(nameOf(a)) === key) ?? null
}
