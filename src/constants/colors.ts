// Genre Colors - Concert Poster Palette
// Deep jewel tones at 35-45% lightness, 65-80% saturation
// Source: docs/design/Morperhaus-Color-Specification-Guide.md

export const GENRE_COLORS: Record<string, string> = {
  'New Wave': '#1e3a8a',
  'Punk': '#991b1b',
  'Alternative': '#5b21b6',
  'Ska': '#b45309',
  'Indie Rock': '#1d4ed8',
  'Electronic': '#0e7490',
  'Pop Rock': '#c2410c',
  'Pop Punk': '#be185d',
  'Classic Rock': '#78350f',
  'Jazz': '#312e81',
  'Reggae': '#166534',
  'Metal': '#1f2937',
  'Hip Hop': '#9a3412',
  'R&B/Soul': '#4c1d95',
  'Folk/Country': '#713f12',
  'Funk': '#a16207',
  'Blues': '#1e40af',
  'World': '#115e59',
  'Experimental': '#7c3aed',
  'Other': '#4b5563',
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
