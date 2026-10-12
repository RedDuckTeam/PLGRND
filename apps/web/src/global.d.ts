import type { Buffer } from 'buffer'

declare global {
  interface Window {
    Buffer: typeof Buffer
  }
  /** The @plgrnd/embed version (packages/embed/package.json), baked in by vite.config.ts. */
  const __PLGRND_EMBED_VERSION__: string
  /** apps/web/public/sdk/<version>/ exists, so plgrnd.io serves the versioned downloads. */
  const __PLGRND_EMBED_RELEASED__: boolean
  /** packages/embed/release-state.json lists <version> as published to npm. */
  const __PLGRND_EMBED_NPM_PUBLISHED__: boolean
}

export {}
