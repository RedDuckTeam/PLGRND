import type { FlowSnapshot } from '@/stores/flow-store'
import { encodeFlowToHash } from '@/utils/flow/share'
import { EMBED_PATH, FLOW_HASH_KEY } from './embed-location'
import { EMBED_DEFAULTS, type EmbedColorKey, type EmbedConfig } from './embed-config'

const COLOR_PARAM_KEYS: readonly EmbedColorKey[] = ['bg', 'surface', 'fg', 'border', 'accent']

export const serializeEmbedConfig = (config: EmbedConfig): string => {
  const params = new URLSearchParams()
  if (config.mode !== EMBED_DEFAULTS.mode) params.set('mode', config.mode)
  if (config.theme !== EMBED_DEFAULTS.theme) params.set('theme', config.theme)
  for (const key of COLOR_PARAM_KEYS) {
    const value = config[key]
    if (value) params.set(key, value.replace(/^#/, ''))
  }
  if (config.radius !== EMBED_DEFAULTS.radius) params.set('radius', String(config.radius))
  if (config.font) params.set('font', config.font)
  if (config.fontMono) params.set('fontMono', config.fontMono)
  if (config.controls !== EMBED_DEFAULTS.controls) params.set('controls', config.controls ? '1' : '0')
  if (config.minimap !== EMBED_DEFAULTS.minimap) params.set('minimap', config.minimap ? '1' : '0')
  if (config.toolbar !== EMBED_DEFAULTS.toolbar) params.set('toolbar', config.toolbar ? '1' : '0')
  return params.toString()
}

export const buildEmbedUrl = (snapshot: FlowSnapshot, config: EmbedConfig, origin?: string): string => {
  const base = origin ?? window.location.origin
  const query = serializeEmbedConfig(config)
  return `${base}${EMBED_PATH}${query ? `?${query}` : ''}#${FLOW_HASH_KEY}=${encodeFlowToHash(snapshot)}`
}

export const buildEditorUrl = (snapshot: FlowSnapshot, origin?: string): string => {
  const base = origin ?? window.location.origin
  return `${base}/#${FLOW_HASH_KEY}=${encodeFlowToHash(snapshot)}`
}

export const IFRAME_SANDBOX = 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox'
export const IFRAME_ALLOW = 'clipboard-write'

export type EmbedSnippetSize = { kind: 'aspect'; ratio: string } | { kind: 'fixed'; height: number }

export const buildEmbedSnippet = (url: string, size: EmbedSnippetSize): string => {
  const sizing = size.kind === 'aspect' ? `aspect-ratio:${size.ratio}` : `height:${size.height}px`
  return [
    `<div style="position:relative;width:100%;${sizing};overflow:hidden;border-radius:12px">`,
    '  <iframe',
    `    src="${url}"`,
    '    title="PLGRND interactive flow"',
    '    loading="lazy"',
    `    sandbox="${IFRAME_SANDBOX}"`,
    `    allow="${IFRAME_ALLOW}"`,
    '    style="position:absolute;inset:0;width:100%;height:100%;border:0"></iframe>',
    '</div>',
  ].join('\n')
}
