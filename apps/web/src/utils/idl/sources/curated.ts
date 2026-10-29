import { sha256 } from 'js-sha256'

// Programs whose IDL is published by its authors but not on chain. Pinned to a commit and checked by sha256, so a
// moved or edited file is rejected rather than trusted. Fetched at runtime (never redistributed); app only.
export const CURATED_IDLS: Record<string, { url: string; sha256: string }> = {
  // Metaplex Token Metadata (Shank IDL, v1.14.0)
  metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s: {
    url: 'https://cdn.jsdelivr.net/gh/metaplex-foundation/mpl-token-metadata@7c95f9948d7fed8db9947188b8040f0d560ac2d3/idls/token_metadata.json',
    sha256: '58f1a1397a1e4f6c671d2a3bf8f6e9465eedd8abb0025c943d42030180ff411f',
  },
}

export async function loadCuratedIdl(programId: string, fetchText: (url: string) => Promise<string>) {
  const entry = CURATED_IDLS[programId]
  if (!entry) return null
  const body = await fetchText(entry.url)
  if (sha256(body) !== entry.sha256) throw new Error(`Curated IDL for ${programId} changed upstream`)
  return JSON.parse(body) as unknown
}
