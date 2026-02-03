export interface ArtistMetadata {
  [artistNormalized: string]: {
    name: string;
    image?: string;
    bio?: string;
    genres?: string[];
    formed?: string;
    source: 'theaudiodb' | 'lastfm' | 'manual';
    fetchedAt: string;
  };
}

export interface FilterState {
  artists: string[];
  genres: string[];
  venues: string[];
  cities: string[];
  yearRange: [number, number];
  searchQuery: string;
  hasOpeners: boolean | null;
}

export interface TopTrack {
  name: string;
  previewUrl: string | null;  // 30-sec MP3 (Deezer) or M4A (iTunes)
  durationMs: number;
  albumName: string;
  albumArt: string;           // 100-250px square
  streamingUrl: string;       // Deezer or Apple Music deep link
}

export interface ArtistTopTracks {
  [artistNormalized: string]: {
    name: string;
    source: 'deezer' | 'itunes';
    fetchedAt: string;
    tracks: TopTrack[];
  };
}
