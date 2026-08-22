/**
 * Three units, one file.
 *
 * Social text gets measured in three different ways and they are never
 * interchangeable, which is the source of most integration bugs in this area:
 *
 * - **UTF-8 bytes** — what Bluesky facet offsets index into.
 * - **Graphemes** — what Bluesky's 300 limit counts, and the unit the
 *   archive's own budgets are stated in, because it is the only one that
 *   matches what a reader sees.
 * - **UTF-16 code units** — what `String.prototype.length` returns, and what
 *   nothing here wants. It is the default, which is exactly why it has to be
 *   named to be avoided.
 */

const encoder = new TextEncoder();

export function utf8Length(text: string): number {
  return encoder.encode(text).length;
}

/**
 * `Intl.Segmenter` is present on Node 18+. The fallback counts code points
 * rather than code units, which is still closer than `.length` — it just
 * over-counts a family emoji. Nothing this pipeline authors contains one, and
 * over-counting is the safe direction: it can only make us post short.
 */
export function graphemeLength(text: string): number {
  const Segmenter = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Segmenter) {
    return [...new Segmenter("en", { granularity: "grapheme" }).segment(text)].length;
  }
  return [...text].length;
}
