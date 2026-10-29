import type { Network } from '@/types/network'

export const EMBED_PATH = '/embed'
export const FLOW_HASH_KEY = 'flow'
export const VIEW_PARAM_KEY = 'view'

export interface Loc {
  pathname: string
  search: string
  hash: string
}

export const EMPTY_LOC: Loc = { pathname: '', search: '', hash: '' }

export const resolveLoc = (loc?: Loc): Loc => {
  if (loc) return loc
  if (typeof window === 'undefined') return EMPTY_LOC
  return window.location
}

export const normalizeHash = (rawHash: string): string => {
  const hash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash
  return hash.replace(/\?/g, '&')
}

export const parseLocationParams = (loc?: Loc): URLSearchParams => {
  const resolved = resolveLoc(loc)
  const merged = new URLSearchParams()
  const searchParams = new URLSearchParams(resolved.search)
  for (const [key, value] of searchParams.entries()) merged.set(key, value)
  const normalizedHash = normalizeHash(resolved.hash)
  if (normalizedHash) {
    const hashParams = new URLSearchParams(normalizedHash)
    for (const [key, value] of hashParams.entries()) {
      if (key === FLOW_HASH_KEY) continue
      if (!merged.has(key)) merged.set(key, value)
    }
  }
  return merged
}

export const isEmbedPath = (pathname: string): boolean =>
  pathname === EMBED_PATH || pathname.startsWith(`${EMBED_PATH}/`)

export const isLegacyViewMode = (loc?: Loc): boolean => {
  const resolved = resolveLoc(loc)
  if (isEmbedPath(resolved.pathname)) return false
  const view = parseLocationParams(resolved).get(VIEW_PARAM_KEY)
  return view === 'true' || view === '1'
}

export const isEmbedFromLocation = (loc?: Loc): boolean => {
  const resolved = resolveLoc(loc)
  return isEmbedPath(resolved.pathname) || isLegacyViewMode(resolved)
}

export const TX_PARAM_KEY = 'tx'
export const CLUSTER_PARAM_KEY = 'cluster'

/** A transaction to import from the URL: `?tx=<signature or serialized tx>&cluster=mainnet|devnet`. */
export interface LinkedTx {
  input: string
  /** Unset: a signature is searched on mainnet, then devnet. */
  network?: Network
}

/** `mainnet` (or `mainnet-beta`) and `devnet`, any case; anything else means "not set". */
export const parseCluster = (raw: string | null | undefined): Network | undefined => {
  const value = raw?.trim().toLowerCase()
  if (value === 'mainnet' || value === 'mainnet-beta') return 'MAINNET'
  if (value === 'devnet') return 'DEVNET'
  return undefined
}

export const readTxParams = (loc?: Loc): LinkedTx | null => {
  const params = parseLocationParams(loc)
  // The `+` of unencoded standard base64 arrives as a space.
  const input = params.get(TX_PARAM_KEY)?.replace(/ /g, '+').trim()
  if (!input) return null
  return { input, network: parseCluster(params.get(CLUSTER_PARAM_KEY)) }
}

const TX_KEYS = [TX_PARAM_KEY, CLUSTER_PARAM_KEY]

/** The location's path, query and hash without `tx` and `cluster`; null when it has neither. */
export const urlWithoutTxParams = (loc?: Loc): string | null => {
  const resolved = resolveLoc(loc)
  // Only a part that had them is rewritten, so the rest (e.g. a `#flow=` payload) stays byte for byte.
  const strip = (raw: string, prefix: string) => {
    const params = new URLSearchParams(prefix === '#' ? normalizeHash(raw) : raw)
    if (!TX_KEYS.some((key) => params.has(key))) return null
    for (const key of TX_KEYS) params.delete(key)
    const rest = params.toString()
    return rest ? `${prefix}${rest}` : ''
  }
  const search = strip(resolved.search, '?')
  const hash = strip(resolved.hash, '#')
  if (search === null && hash === null) return null
  return `${resolved.pathname}${search ?? resolved.search}${hash ?? resolved.hash}`
}

export const clearTxParams = () => {
  if (typeof window === 'undefined') return
  const url = urlWithoutTxParams()
  if (url !== null) window.history.replaceState(null, '', url)
}
