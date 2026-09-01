import { EMBED_DEFAULTS, parseEmbedConfig, type EmbedColorKey, type EmbedConfig } from '@/embed/embed-config'
import { serializeEmbedConfig, type EmbedSnippetSize } from '@/embed/embed-url'

const EMBED_BUILDER_STORAGE_KEY = 'sol-learn:embed-builder'

export type SizePresetId = '16:9' | '4:3' | '1:1' | '9:16' | 'fixed'

export const SIZE_PRESETS: { id: SizePresetId; label: string }[] = [
  { id: '16:9', label: '16:9' },
  { id: '4:3', label: '4:3' },
  { id: '1:1', label: '1:1' },
  { id: '9:16', label: '9:16' },
  { id: 'fixed', label: 'Fixed' },
]

const ASPECT_RATIOS: Record<Exclude<SizePresetId, 'fixed'>, string> = {
  '16:9': '16/9',
  '4:3': '4/3',
  '1:1': '1/1',
  '9:16': '9/16',
}

export const MIN_FIXED_HEIGHT = 120
export const MAX_FIXED_HEIGHT = 2000

export const resolveSnippetSize = (sizeId: SizePresetId, fixedHeight: number): EmbedSnippetSize =>
  sizeId === 'fixed' ? { kind: 'fixed', height: fixedHeight } : { kind: 'aspect', ratio: ASPECT_RATIOS[sizeId] }

interface FontPresetOption {
  id: string
  label: string
  value?: string
}

export const FONT_PRESETS: FontPresetOption[] = [
  { id: 'default', label: 'PLGRND default' },
  { id: 'system-sans', label: 'System sans', value: 'system-ui, sans-serif' },
  { id: 'system-serif', label: 'System serif', value: 'ui-serif, Georgia, serif' },
  { id: 'system-mono', label: 'System mono', value: 'ui-monospace, monospace' },
]

export const CUSTOM_FONT_ID = 'custom'

export const COLOR_FIELDS: { key: EmbedColorKey; label: string }[] = [
  { key: 'bg', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'fg', label: 'Text' },
  { key: 'border', label: 'Border' },
  { key: 'accent', label: 'Accent' },
]

export const THEME_PICKER_DEFAULTS: Record<'dark' | 'light', Record<EmbedColorKey, string>> = {
  dark: { bg: '#171717', surface: '#171717', fg: '#e2e8f0', border: '#1f1f1f', accent: '#006239' },
  light: { bg: '#f4f4f5', surface: '#ffffff', fg: '#171717', border: '#d4d4d8', accent: '#006239' },
}

export interface BuilderSettings {
  config: EmbedConfig
  sizeId: SizePresetId
  fixedHeight: number
}

const DEFAULT_BUILDER_SETTINGS: BuilderSettings = {
  config: EMBED_DEFAULTS,
  sizeId: '16:9',
  fixedHeight: 480,
}

const clampFixedHeight = (value: number): number =>
  Math.min(MAX_FIXED_HEIGHT, Math.max(MIN_FIXED_HEIGHT, Math.round(value)))

export const loadBuilderSettings = (): BuilderSettings => {
  try {
    const raw = window.localStorage.getItem(EMBED_BUILDER_STORAGE_KEY)
    if (!raw) return DEFAULT_BUILDER_SETTINGS
    const parsed = JSON.parse(raw) as { query?: unknown; sizeId?: unknown; fixedHeight?: unknown }
    const query = typeof parsed.query === 'string' ? parsed.query : ''
    const { config } = parseEmbedConfig(new URLSearchParams(query))
    const sizeId = SIZE_PRESETS.some((preset) => preset.id === parsed.sizeId)
      ? (parsed.sizeId as SizePresetId)
      : DEFAULT_BUILDER_SETTINGS.sizeId
    const fixedHeight =
      typeof parsed.fixedHeight === 'number' && Number.isFinite(parsed.fixedHeight)
        ? clampFixedHeight(parsed.fixedHeight)
        : DEFAULT_BUILDER_SETTINGS.fixedHeight
    return { config, sizeId, fixedHeight }
  } catch {
    return DEFAULT_BUILDER_SETTINGS
  }
}

export const saveBuilderSettings = (settings: BuilderSettings): void => {
  try {
    window.localStorage.setItem(
      EMBED_BUILDER_STORAGE_KEY,
      JSON.stringify({
        query: serializeEmbedConfig(settings.config),
        sizeId: settings.sizeId,
        fixedHeight: settings.fixedHeight,
      })
    )
  } catch {
    // Storage unavailable (private mode etc.) — the builder still works per-session.
  }
}
