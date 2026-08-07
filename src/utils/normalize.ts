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
 * ✨ UPDATED in v1.9.0 to use hyphens (previously removed all special chars)
 *
 * Rules:
 * - Convert to lowercase
 * - Replace all non-alphanumeric characters with hyphens
 * - Collapse multiple hyphens into one
 * - Remove leading/trailing hyphens
 *
 * @example
 * normalizeVenueName("The Coach House") // => "the-coach-house"
 * normalizeVenueName("Irvine Meadows") // => "irvine-meadows"
 * normalizeVenueName("9:30 Club") // => "9-30-club"
 *
 * @param name - The venue name to normalize
 * @returns Normalized venue name
 */
export function normalizeVenueName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')   // Replace all special chars with hyphens
    .replace(/-+/g, '-')           // Collapse multiple hyphens
    .replace(/^-|-$/g, '')         // Remove leading/trailing hyphens
}

/**
 * Normalize genre name for metadata key lookups
 *
 * ✨ NEW in v1.9.0
 *
 * Rules:
 * - Convert to lowercase
 * - Replace all non-alphanumeric characters with hyphens
 * - Collapse multiple hyphens into one
 * - Remove leading/trailing hyphens
 *
 * @example
 * normalizeGenreName("Alternative Rock") // => "alternative-rock"
 * normalizeGenreName("New Wave/Synth-pop") // => "new-wave-synth-pop"
 * normalizeGenreName("Hip-Hop") // => "hip-hop"
 *
 * @param name - The genre name to normalize
 * @returns Normalized genre name
 */
export function normalizeGenreName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Normalize album title to a consistent URL-friendly format
 *
 * ✨ NEW in v5.4.0 — used by album-eras.json to satisfy the reserved album
 * deep-link grammar (`?scene=artists&artist={slug}&album={slug}`, DEEP_LINKING.md v1.3).
 *
 * NOTE: this is for SLUG GENERATION. Cross-file album title *matching* is a
 * different problem with different rules — see scripts/utils/album-title.ts,
 * which normalizes for comparison only and never produces a stored value.
 *
 * @example
 * normalizeAlbumName("Violator") // => "violator"
 * normalizeAlbumName("Speak & Spell") // => "speak-spell"
 * normalizeAlbumName("Music for the Masses") // => "music-for-the-masses"
 *
 * @param name - The album title to normalize
 * @returns Normalized album slug
 */
export function normalizeAlbumName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // fold diacritics so slugs stay ASCII
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
