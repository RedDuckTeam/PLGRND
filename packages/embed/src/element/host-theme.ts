import type { ResolvedTheme } from '../types/runtime-api'

// theme="auto": follow the host page's own theme marker, in this order:
//   1. <body data-md-color-scheme> (MkDocs Material): slate/dark -> dark, default/light -> light, otherwise the
//      luminance of the body background (custom schemes such as custom-dark / custom-light);
//   2. <html data-theme="dark|light"> (Docusaurus);
//   3. a dark / light class on <html> (Mintlify, next-themes, Fumadocs);
//   4. prefers-color-scheme.
// One realm-wide, ref-counted observer watches the markers; it only reads the host page.

const luminance = (color: string): number | null => {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/.exec(color)
  if (!m) return null
  if (m[4] !== undefined && Number(m[4]) === 0) return null
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => {
    const c = Number(v) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const prefersDark = () =>
  typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)').matches : true

export function detectHostTheme(): ResolvedTheme {
  const { body, documentElement: html } = document
  const scheme = body?.getAttribute('data-md-color-scheme')
  if (scheme) {
    if (/dark|slate/i.test(scheme)) return 'dark'
    if (/light|default/i.test(scheme)) return 'light'
    const lum = luminance(getComputedStyle(body).backgroundColor)
    if (lum !== null) return lum < 0.5 ? 'dark' : 'light'
  }
  const dataTheme = html.getAttribute('data-theme')
  if (dataTheme === 'dark' || dataTheme === 'light') return dataTheme
  if (html.classList.contains('dark')) return 'dark'
  if (html.classList.contains('light')) return 'light'
  return prefersDark() ? 'dark' : 'light'
}

type Listener = (theme: ResolvedTheme) => void

const listeners = new Set<Listener>()
let observer: MutationObserver | null = null
let media: MediaQueryList | null = null
let current: ResolvedTheme | null = null

const notify = () => {
  const next = detectHostTheme()
  if (next === current) return
  current = next
  for (const listener of listeners) listener(next)
}

/** Calls `listener` whenever the host theme changes; returns the unsubscribe. */
export function watchHostTheme(listener: Listener): () => void {
  listeners.add(listener)
  if (!observer) {
    current = detectHostTheme()
    observer = new MutationObserver(notify)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    if (document.body) {
      observer.observe(document.body, { attributes: true, attributeFilter: ['data-md-color-scheme', 'class', 'style'] })
    }
    if (typeof window.matchMedia === 'function') {
      media = window.matchMedia('(prefers-color-scheme: dark)')
      media.addEventListener('change', notify)
    }
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && observer) {
      observer.disconnect()
      observer = null
      media?.removeEventListener('change', notify)
      media = null
      current = null
    }
  }
}
