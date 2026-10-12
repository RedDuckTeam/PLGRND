import { parseEmbedConfig, type EmbedConfig } from '@/embed/embed-config'
import { PUBLIC_RPC_URLS, type RpcUrls } from '@/constants/solana/connection'
import type { RawAttributes } from '../types/runtime-api'

// AC-A1: the element's attributes mirror the iframe's query parameters (minus editor mode), plus the
// self-hosted-only rpc-* and link-ref. Parsing never throws: invalid values fall back to the defaults and
// are reported as ignored (a dev-only warning, G0-7).

const CONFIG_ATTRIBUTES = new Set([
  'theme',
  'bg',
  'surface',
  'fg',
  'border',
  'accent',
  'radius',
  'font',
  'font-mono',
  'controls',
  'minimap',
  'toolbar',
  'mode',
])
const RPC_ATTRIBUTES = [
  ['rpc-mainnet', 'MAINNET'],
  ['rpc-devnet', 'DEVNET'],
] as const
const LINK_REF_RE = /^[A-Za-z0-9._-]{1,64}$/

export interface WidgetAttributes {
  flow?: string
  config: EmbedConfig
  /** Attribute names whose values were invalid (or unsupported, like mode="editor"). */
  ignored: string[]
  rpcUrls: RpcUrls
  linkRef?: string
}

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function parseWidgetAttributes(raw: RawAttributes): WidgetAttributes {
  const params = new URLSearchParams()
  for (const [name, value] of Object.entries(raw)) {
    if (CONFIG_ATTRIBUTES.has(name)) params.set(name === 'font-mono' ? 'fontMono' : name, value)
  }
  const parsed = parseEmbedConfig(params)
  const ignored = parsed.ignored.map((key) => (key === 'fontMono' ? 'font-mono' : key))
  let config = parsed.config
  // AC-A3: editor mode is not available in the self-hosted widget.
  if (config.mode === 'editor') {
    config = { ...config, mode: 'interactive' }
    ignored.push('mode')
  }

  const rpcUrls: RpcUrls = { ...PUBLIC_RPC_URLS }
  for (const [attribute, network] of RPC_ATTRIBUTES) {
    const value = raw[attribute]
    if (value === undefined) continue
    if (isHttpUrl(value)) rpcUrls[network] = value
    else ignored.push(attribute)
  }

  // `link-ref` everywhere; plain HTML may also use `ref` (React never forwards `ref` as an attribute).
  const refAttribute = raw['link-ref'] !== undefined ? 'link-ref' : raw.ref !== undefined ? 'ref' : null
  let linkRef: string | undefined
  if (refAttribute) {
    const value = raw[refAttribute]
    if (LINK_REF_RE.test(value)) linkRef = value
    else ignored.push(refAttribute)
  }

  return { flow: raw.flow, config, ignored, rpcUrls, linkRef }
}
