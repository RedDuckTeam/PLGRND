import LZString from 'lz-string'
import type { FlowSnapshot } from '@/stores/flow-store'
import { FLOW_STORAGE_VERSION, sanitizeNodes } from '@/stores/flow-store'
import { FLOW_HASH_KEY, isLegacyViewMode, normalizeHash, parseLocationParams } from '@/embed/embed-location'

export { FLOW_HASH_KEY, parseLocationParams }

export const isViewModeFromLocation = isLegacyViewMode

interface SerializedFlow {
  v: number
  nodes: FlowSnapshot['nodes']
  edges: FlowSnapshot['edges']
  viewport?: FlowSnapshot['viewport']
}

const stripSelection = <T extends { selected?: boolean }>(items: T[]): T[] =>
  items.map((item) => (item.selected ? { ...item, selected: false } : item))

export const encodeFlowToHash = (snapshot: FlowSnapshot): string => {
  const payload: SerializedFlow = {
    v: FLOW_STORAGE_VERSION,
    nodes: stripSelection(sanitizeNodes(snapshot.nodes)),
    edges: stripSelection(snapshot.edges),
    viewport: snapshot.viewport,
  }
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload))
}

export const decodeFlowFromHash = (encoded: string): FlowSnapshot | null => {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded)
    if (!json) return null
    const parsed = JSON.parse(json) as SerializedFlow
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null
    return { nodes: sanitizeNodes(parsed.nodes), edges: parsed.edges, viewport: parsed.viewport }
  } catch {
    return null
  }
}

const extractFlowFromHashString = (hashString: string): FlowSnapshot | null => {
  const normalized = normalizeHash(hashString)
  if (!normalized) return null
  const params = new URLSearchParams(normalized)
  const encoded = params.get(FLOW_HASH_KEY)
  if (!encoded) return null
  return decodeFlowFromHash(encoded)
}

export const readFlowFromLocation = (): FlowSnapshot | null => {
  if (typeof window === 'undefined') return null
  return extractFlowFromHashString(window.location.hash)
}

export const readFlowFromUrl = (url: string): FlowSnapshot | null => {
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    return extractFlowFromHashString(parsed.hash)
  } catch {
    return null
  }
}

export const buildShareUrl = (snapshot: FlowSnapshot): string => {
  const encoded = encodeFlowToHash(snapshot)
  const url = new URL(window.location.href)
  url.hash = `${FLOW_HASH_KEY}=${encoded}`
  return url.toString()
}

export const clearFlowHash = () => {
  if (typeof window === 'undefined') return
  if (!window.location.hash) return
  const hashParams = new URLSearchParams(normalizeHash(window.location.hash))
  if (!hashParams.has(FLOW_HASH_KEY)) return
  hashParams.delete(FLOW_HASH_KEY)
  const searchParams = new URLSearchParams(window.location.search)
  for (const [k, v] of Array.from(hashParams.entries())) {
    if (!searchParams.has(k)) searchParams.set(k, v)
    hashParams.delete(k)
  }
  const remainingHash = hashParams.toString()
  const newHash = remainingHash ? `#${remainingHash}` : ''
  const newSearch = searchParams.toString()
  const newQuery = newSearch ? `?${newSearch}` : ''
  const newUrl = `${window.location.pathname}${newQuery}${newHash}`
  window.history.replaceState(null, '', newUrl)
}
