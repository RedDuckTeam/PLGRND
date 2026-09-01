export type EmbedMode = 'readonly' | 'interactive' | 'editor'
export type EmbedTheme = 'dark' | 'light' | 'auto'

export const COLOR_TOKEN_VARS = {
  bg: ['--background'],
  surface: ['--card', '--popover', '--sidebar'],
  fg: ['--foreground', '--card-foreground', '--popover-foreground'],
  border: ['--border', '--sidebar-border', '--input'],
  accent: ['--primary', '--ring'],
} as const

export type EmbedColorKey = keyof typeof COLOR_TOKEN_VARS

export interface EmbedConfig {
  mode: EmbedMode
  theme: EmbedTheme
  bg?: string
  surface?: string
  fg?: string
  border?: string
  accent?: string
  radius: number
  font?: string
  fontMono?: string
  controls: boolean
  minimap: boolean
  toolbar: boolean
}

export const EMBED_DEFAULTS: EmbedConfig = {
  mode: 'interactive',
  theme: 'dark',
  radius: 8,
  controls: true,
  minimap: false,
  toolbar: true,
}

const HEX_COLOR_RE = /^(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

export const parseHexColor = (raw: string): string | undefined => {
  const value = raw.startsWith('#') ? raw.slice(1) : raw
  return HEX_COLOR_RE.test(value) ? `#${value.toLowerCase()}` : undefined
}

const FONT_FAMILY_RE = /^[A-Za-z0-9 ,'"-]+$/

export const parseFontFamily = (raw: string): string | undefined => {
  const value = raw.trim()
  if (!value || value.length > 100 || !FONT_FAMILY_RE.test(value)) return undefined
  return value
}

export const parseRadius = (raw: string): number | undefined => {
  if (!/^\d{1,2}$/.test(raw)) return undefined
  const value = Number(raw)
  return value >= 0 && value <= 24 ? value : undefined
}

export const parseBool = (raw: string): boolean | undefined => {
  const value = raw.toLowerCase()
  if (value === '1' || value === 'true') return true
  if (value === '0' || value === 'false') return false
  return undefined
}

export const parseMode = (raw: string): EmbedMode | undefined => {
  const value = raw.toLowerCase()
  return value === 'readonly' || value === 'interactive' || value === 'editor' ? value : undefined
}

export const parseTheme = (raw: string): EmbedTheme | undefined => {
  const value = raw.toLowerCase()
  return value === 'dark' || value === 'light' || value === 'auto' ? value : undefined
}

export interface ParsedEmbedConfig {
  config: EmbedConfig
  ignored: string[]
}

/** Never fails: every invalid value degrades to its default. Unknown params are ignored silently. */
export const parseEmbedConfig = (params: URLSearchParams): ParsedEmbedConfig => {
  const ignored: string[] = []
  const take = <T>(key: string, parse: (raw: string) => T | undefined): T | undefined => {
    const raw = params.get(key)
    if (raw === null) return undefined
    const parsed = parse(raw)
    if (parsed === undefined) ignored.push(key)
    return parsed
  }

  const config: EmbedConfig = {
    mode: take('mode', parseMode) ?? EMBED_DEFAULTS.mode,
    theme: take('theme', parseTheme) ?? EMBED_DEFAULTS.theme,
    bg: take('bg', parseHexColor),
    surface: take('surface', parseHexColor),
    fg: take('fg', parseHexColor),
    border: take('border', parseHexColor),
    accent: take('accent', parseHexColor),
    radius: take('radius', parseRadius) ?? EMBED_DEFAULTS.radius,
    font: take('font', parseFontFamily),
    fontMono: take('fontMono', parseFontFamily),
    controls: take('controls', parseBool) ?? EMBED_DEFAULTS.controls,
    minimap: take('minimap', parseBool) ?? EMBED_DEFAULTS.minimap,
    toolbar: take('toolbar', parseBool) ?? EMBED_DEFAULTS.toolbar,
  }

  return { config, ignored }
}
