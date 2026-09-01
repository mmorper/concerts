/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SETLISTFM_API_KEY: string
  // Ask the Archive (#141): the chat worker base URL (empty = same-origin /api/ask*) and the
  // public Turnstile site key that gates session minting.
  readonly VITE_ASK_BASE_URL?: string
  readonly VITE_TURNSTILE_SITE_KEY?: string
  // Public CARTO basemap key (#448). Unset = the map falls back to Esri's keyless dark canvas.
  readonly VITE_CARTO_API_KEY?: string
  // Add other VITE_ env variables here if needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
