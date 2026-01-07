// Genre Colors - Concert Poster Palette
// Deep jewel tones at 35-45% lightness, 65-80% saturation
// Source: docs/design/Morperhaus-Color-Specification-Guide.md

export const GENRE_COLORS: Record<string, string> = {
  // Major genres (5+ shows)
  'New Wave': '#1e40af',        // Deep navy blue (synth, 80s)
  'Punk': '#991b1b',            // Dried blood red (raw, aggressive)
  'Alternative': '#5b21b6',     // Deep violet (moody, introspective)
  'Ska': '#f59e0b',             // Bright amber (brass, sunshine)
  'Rockabilly': '#78350f',      // Dark tobacco brown (vintage, retro)
  'Post Punk': '#be123c',       // Deep rose red (dark, angular)
  'Pop Rock': '#dc2626',        // Bright red (warm, accessible)
  'Rock': '#64748b',            // Slate gray (neutral rock)
  'Classic Rock': '#92400e',    // Dark brown leather (vintage, worn)
  'Reggae': '#16a34a',          // Vibrant green (roots, earth)
  'New Wave Pop': '#3b82f6',    // Bright blue (lighter new wave variant)
  'Synthpop': '#8b5cf6',        // Violet (electronic, 80s)
  'Swing': '#ca8a04',           // Golden yellow (big band, brass)
  'Jazz': '#4338ca',            // Rich indigo (smoky, sophisticated)
  'Indie Rock': '#0ea5e9',      // Sky blue (melodic, expansive)

  // Secondary genres (2-4 shows)
  'Pop': '#f472b6',             // Pink (mainstream, bright)
  'Soft Rock': '#94a3b8',       // Light slate (mellow)
  'Art Rock': '#7c3aed',        // Electric purple (experimental)
  'Pop Punk': '#ec4899',        // Hot pink (youthful, loud)
  'Reggae Fusion': '#22c55e',   // Lighter green (reggae variant)
  'Heavy Metal': '#18181b',     // Near-black (heavy, dark)
  'Hip Hop': '#ea580c',         // Bright orange (street, bold)
  'Rap': '#f97316',             // Orange (hip hop variant)
  'R&B': '#a855f7',             // Purple (smooth, soulful)

  // Rare genres (collapsed to Other in treemap)
  'Electronic': '#06b6d4',      // Bright cyan
  'Indie': '#38bdf8',           // Light blue
  'Britpop': '#6366f1',         // Indigo
  'Folk Pop': '#84cc16',        // Lime green
  'Funk Rock': '#d97706',       // Gold
  'New Romantic': '#c084fc',    // Light purple
  'Dance/Electronic': '#22d3d1', // Teal
  'Neo Mellow': '#6ee7b7',      // Soft sage green (chill, acoustic-electronic)
  'Orchestral Soundtrack': '#881337', // Deep burgundy (cinematic, dramatic)
  'Reggae Rock': '#14b8a6',     // Teal (reggae-rock fusion)
  'Alternative Hip Hop': '#b45309', // Dark amber (experimental rap)
  'Gulf and Western Country Rock': '#c2410c', // Terracotta (southern rock)
  'Political Hip Hop': '#be123c', // Bold crimson (conscious, message-driven)

  // Bucket
  'Other': '#64748b',           // Slate gray (neutral bucket)
} as const

export const BACKGROUNDS = {
  light1: '#ffffff',
  light2: '#f3f4f6',
  light3: '#fafaf9',
  light4: '#fef3c7',
  light5: '#ede9fe',
  dark1: '#111827',
  dark2: 'linear-gradient(135deg, #1e1b4b 0%, #581c87 100%)',
  dark3: '#0c0a09',
  dark4: '#1e1b4b',
  dark5: '#172554',
} as const

export const DEFAULT_GENRE_COLOR = '#4b5563'

export function getGenreColor(genre: string): string {
  return GENRE_COLORS[genre] || DEFAULT_GENRE_COLOR
}
