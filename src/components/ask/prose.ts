// Prose normalization for Ask exhibits — pure string transforms, unit-tested in prose.test.ts.

// The tool prose ends with a markdown "Open on the site" deep-link footer (for external MCP
// clients). In-app the exhibit's own chips/deep-link handle navigation, so strip it for display.
export function cleanProse(text: string): string {
  let t = text.split(/\n*-{3,}\n*\*\*Open on the site:|\n*\*\*Open on the site:/)[0].trimEnd()
  // Backup: strip a trailing line that's only deep-links (the model sometimes appends the footer
  // links without the "Open on the site:" label). The exhibit's own chips handle navigation.
  t = t.replace(/\n+\s*(?:\[[^\]]+\]\([^)]+\)\s*(?:·\s*)?)+\s*$/, '').trimEnd()
  // A GFM table must start on its own line, but the model often glues the header to the preceding
  // sentence ("…shows.| Date | … |\n|---|---|"). Force a blank line before a header+separator pair
  // so remark-gfm parses it as a table. The leading `(?<!\|[^\n]*)` is critical: without it, a
  // table that *opens* the reply (no preceding sentence) makes the regex anchor on a char INSIDE
  // the header's first cell and inject a blank line mid-header, splitting "| Date | Venue |" and
  // breaking the table. The lookbehind refuses to match when a pipe already precedes on the line.
  t = t.replace(/(?<!\|[^\n]*)([^\n|])\s*(\|[^\n]*\|\n\s*\|[\s|:-]+\|)/g, '$1\n\n$2')
  return t
}
