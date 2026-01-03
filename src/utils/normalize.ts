/**
 * Normalization utilities for consistent data handling across the application
 *
 * SINGLE SOURCE OF TRUTH for all normalization logic.
 * Used by both build scripts and frontend components.
 *
 * @module normalize
 */

/**
 * Normalize artist name to a consistent URL-friendly format
 *
 * Rules:
 * - Convert to lowercase
 * - Replace all non-alphanumeric characters with hyphens
 * - Collapse multiple hyphens into one
 * - Remove leading/trailing hyphens
 *
 * @example
 * normalizeArtistName("Violent Femmes") // => "violent-femmes"
 * normalizeArtistName("Duran Duran") // => "duran-duran"
 * normalizeArtistName("Run-DMC") // => "run-dmc"
 * normalizeArtistName("The Art of Noise") // => "the-art-of-noise"
 *
 * @param name - The artist name to normalize
 * @returns Normalized artist name
 */
export function normalizeArtistName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')  // Replace all special chars with hyphens
    .replace(/-+/g, '-')          // Collapse multiple hyphens
    .replace(/^-|-$/g, '')        // Remove leading/trailing hyphens
}

/**
 * Normalize venue name for cache key lookups
 *
 * Rules:
 * - Convert to lowercase
 * - Remove ALL non-alphanumeric characters (no hyphens)
 * - Trim whitespace
 *
 * @example
 * normalizeVenueName("The Coach House") // => "thecoachhouse"
 * normalizeVenueName("Irvine Meadows") // => "irvinemeadows"
 * normalizeVenueName("9:30 Club") // => "930club"
 *
 * @param name - The venue name to normalize
 * @returns Normalized venue name
 */
export function normalizeVenueName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')  // Remove all special chars (no hyphens for venues)
    .trim()
}
