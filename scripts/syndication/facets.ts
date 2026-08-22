/**
 * Bluesky rich-text facets — byte offsets, not character offsets (#332).
 *
 * This is the single most common way an AT Protocol integration ships mangled
 * links. `facet.index` is `byteStart`/`byteEnd` into the **UTF-8 encoding** of
 * `record.text`, while every naive implementation reaches for
 * `String.prototype.indexOf`, which returns an offset in UTF-16 code units.
 * The two agree for as long as the text is pure ASCII and diverge the moment
 * an artist name carries a diacritic — Björk, Sigur Rós, Motörhead, Röyksopp,
 * all of which are the kind of name this archive is full of. The link then
 * renders across the wrong span, or as plain text, or eats the following word.
 *
 * The rule this module enforces is that offsets are only ever computed on
 * `Buffer`/`Uint8Array`, never on the string.
 *
 * Separately, and confusingly, Bluesky's 300-limit counts **graphemes** — a
 * third unit again. All three live in text.ts.
 */

import { utf8Length } from "./text.ts";

export { utf8Length, graphemeLength } from "./text.ts";

export interface Facet {
  index: { byteStart: number; byteEnd: number };
  features: Array<
    | { $type: "app.bsky.richtext.facet#link"; uri: string }
    | { $type: "app.bsky.richtext.facet#tag"; tag: string }
  >;
}

/**
 * A text builder that tracks its own byte length as it goes.
 *
 * Appending through this is what makes the offsets correct by construction:
 * there is no search step that could find the wrong occurrence, and no place
 * where a UTF-16 index could be mistaken for a UTF-8 one. `mark()` returns the
 * byte span of exactly the fragment it appended.
 */
export class FacetedText {
  private parts: string[] = [];
  private bytes = 0;
  readonly facets: Facet[] = [];

  append(text: string): void {
    this.parts.push(text);
    this.bytes += utf8Length(text);
  }

  /** Append `text` and attach `features` to precisely its byte span. */
  appendFaceted(text: string, features: Facet["features"]): void {
    const byteStart = this.bytes;
    this.append(text);
    this.facets.push({ index: { byteStart, byteEnd: this.bytes }, features });
  }

  appendLink(display: string, uri: string): void {
    this.appendFaceted(display, [{ $type: "app.bsky.richtext.facet#link", uri }]);
  }

  /**
   * `#Tag`. The `#` is inside the facet span — the protocol expects the marker
   * included in the range — while `tag` carries the bare value.
   */
  appendTag(tag: string): void {
    const bare = tag.replace(/^#/, "");
    this.appendFaceted(`#${bare}`, [{ $type: "app.bsky.richtext.facet#tag", tag: bare }]);
  }

  get text(): string {
    return this.parts.join("");
  }

  get byteLength(): number {
    return this.bytes;
  }
}

/**
 * Shorten a URL for display while the facet links the whole thing.
 *
 * The longest published slug is 80 characters, which makes a raw permalink 121
 * — more than a third of Bluesky's entire budget, spent on a string nobody
 * reads. Truncation happens on the display text only; the facet's `uri` is
 * always the full URL including its UTM parameters, so the click and the
 * analytics are unaffected.
 */
export function displayUrl(url: string, max: number): string {
  const stripped = url.replace(/^https?:\/\//, "").replace(/\?.*$/, "");
  if (stripped.length <= max) return stripped;
  return `${stripped.slice(0, max - 1)}…`;
}
