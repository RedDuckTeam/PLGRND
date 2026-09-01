import { useEffect, useLayoutEffect } from 'react'
import { useEmbedStore } from '@/stores/embed-store'
import { applyThemeToDocument, parseThemeMessage, type ResolvedTheme } from '@/embed/embed-theme'

export const useEmbedTheme = (): ResolvedTheme => {
  const config = useEmbedStore((s) => s.config)
  const resolvedTheme = useEmbedStore((s) => s.resolvedTheme)
  const ignoredParams = useEmbedStore((s) => s.ignoredParams)
  const setTheme = useEmbedStore((s) => s.setTheme)
  const setResolvedTheme = useEmbedStore((s) => s.setResolvedTheme)

  useLayoutEffect(() => {
    applyThemeToDocument(resolvedTheme, config)
  }, [resolvedTheme, config])

  useEffect(() => {
    if (config.theme !== 'auto') return
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setResolvedTheme(event.matches ? 'dark' : 'light')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [config.theme, setResolvedTheme])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const theme = parseThemeMessage(event.data)
      if (theme) setTheme(theme)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [setTheme])

  useEffect(() => {
    if (import.meta.env.DEV && ignoredParams.length > 0) {
      console.warn('[plgrnd] ignored invalid embed parameters:', ignoredParams.join(', '))
    }
  }, [ignoredParams])

  return resolvedTheme
}
