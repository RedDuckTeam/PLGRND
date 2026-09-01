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

export const IS_EMBED = isEmbedFromLocation()
