import { COLOR_TOKEN_VARS, type EmbedColorKey, type EmbedConfig, type EmbedTheme } from './embed-config'

export type ResolvedTheme = 'dark' | 'light'

export const resolveTheme = (theme: EmbedTheme, prefersDark: boolean): ResolvedTheme =>
  theme === 'auto' ? (prefersDark ? 'dark' : 'light') : theme

export const applyThemeToDocument = (resolved: ResolvedTheme, config: EmbedConfig): void => {
  const root = document.documentElement
  root.dataset.theme = resolved
  const style = root.style
  for (const key of Object.keys(COLOR_TOKEN_VARS) as EmbedColorKey[]) {
    const value = config[key]
    for (const cssVar of COLOR_TOKEN_VARS[key]) {
      if (value) style.setProperty(cssVar, value)
      else style.removeProperty(cssVar)
    }
  }
  if (config.font) style.setProperty('--font-sans', config.font)
  else style.removeProperty('--font-sans')
  if (config.fontMono) style.setProperty('--font-mono', config.fontMono)
  else style.removeProperty('--font-mono')
  style.setProperty('--radius', `${config.radius}px`)
}

export const parseThemeMessage = (data: unknown): EmbedTheme | null => {
  if (typeof data !== 'object' || data === null) return null
  const record = data as Record<string, unknown>
  if (record.type !== 'plgrnd:theme') return null
  const theme = record.theme
  if (theme === 'dark' || theme === 'light' || theme === 'auto') return theme
  return null
}

export const postReadyMessage = (): void => {
  if (typeof window === 'undefined' || window.parent === window) return
  window.parent.postMessage({ type: 'plgrnd:ready' }, '*')
}
