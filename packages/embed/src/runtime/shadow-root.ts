import { createRoot, type Root } from 'react-dom/client'
import { applyThemeTokens, type ResolvedTheme } from '@/embed/embed-theme'
import type { EmbedConfig } from '@/embed/embed-config'
import runtimeCss from './styles.css?inline'

export const ROOT_CLASS = 'plgrnd-root'
const SYSTEM_MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace"
const KEY_EVENTS = ['keydown', 'keyup', 'keypress'] as const

let runtimeSheet: CSSStyleSheet | null = null

const supportsAdoptedSheets = () =>
  typeof CSSStyleSheet === 'function' &&
  'replaceSync' in CSSStyleSheet.prototype &&
  'adoptedStyleSheets' in ShadowRoot.prototype

// One realm-wide sheet, adopted after the shell sheet (M7 order). Browsers without constructable sheets get a
// <style> element inside the shadow root instead (that path needs style-src 'unsafe-inline' on strict hosts).
function adoptRuntimeSheet(shadow: ShadowRoot): HTMLStyleElement | null {
  if (supportsAdoptedSheets()) {
    if (!runtimeSheet) {
      runtimeSheet = new CSSStyleSheet()
      runtimeSheet.replaceSync(runtimeCss)
    }
    if (!shadow.adoptedStyleSheets.includes(runtimeSheet)) {
      shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, runtimeSheet]
    }
    return null
  }
  const style = document.createElement('style')
  style.textContent = runtimeCss
  shadow.append(style)
  return style
}

const isEditable = (target: EventTarget | undefined) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT')

// M8: keys typed into widget inputs stop at the shadow root (bubble phase, after React's root listeners ran),
// so host shortcuts never fire from a widget input.
const stopEditableKeys = (event: Event) => {
  if (isEditable(event.composedPath()[0])) event.stopPropagation()
}

export interface ShadowMount {
  /** `.plgrnd-root`: theme tokens, mode classes, the size container. */
  root: HTMLElement
  /** The React root container. */
  mount: HTMLElement
  /** Portal target for Radix dialogs (M1). */
  portal: HTMLElement
  destroy: () => void
}

/** 2S.1: builds the widget's DOM inside its (already attached) shadow root. */
export function createShadowMount(shadow: ShadowRoot): ShadowMount {
  const fallbackStyle = adoptRuntimeSheet(shadow)
  const root = document.createElement('div')
  root.className = ROOT_CLASS
  root.setAttribute('role', 'region')
  root.setAttribute('aria-label', 'PLGRND interactive flow')
  const mount = document.createElement('div')
  mount.className = 'plgrnd-mount'
  const portal = document.createElement('div')
  portal.setAttribute('data-plgrnd-portal', '')
  root.append(mount, portal)
  shadow.append(root)

  // M6: rem follows the reader's default font size, measured on the root (font-size: medium).
  root.style.setProperty('--plgrnd-rem', getComputedStyle(root).fontSize)
  for (const type of KEY_EVENTS) shadow.addEventListener(type, stopEditableKeys)

  return {
    root,
    mount,
    portal,
    destroy() {
      for (const type of KEY_EVENTS) shadow.removeEventListener(type, stopEditableKeys)
      root.remove()
      fallbackStyle?.remove()
    },
  }
}

/** 2S.5 / M10: theme tokens, mode classes and fonts on the widget root (no web fonts are loaded). */
export function applyRootPresentation(
  root: HTMLElement,
  host: HTMLElement,
  config: EmbedConfig,
  resolvedTheme: ResolvedTheme
): void {
  applyThemeTokens(root, resolvedTheme, config)
  // Sans follows the host page and mono the system stack, unless the `font` / `font-mono` attributes say otherwise.
  if (!config.font) root.style.setProperty('--font-sans', getComputedStyle(host.parentElement ?? host).fontFamily)
  if (!config.fontMono) root.style.setProperty('--font-mono', SYSTEM_MONO)
  const mode = config.mode === 'readonly' ? 'readonly' : 'interactive'
  root.className = `${ROOT_CLASS} plgrnd-embed plgrnd-embed--${mode}`
  root.dataset.mode = mode
}

let rootCount = 0

/** One React root per widget; errors React reports are routed to the console, never to the host window. */
export function createWidgetRoot(container: HTMLElement): Root {
  const report = (kind: string) => (error: unknown) => console.error(`[plgrnd] ${kind}`, error)
  return createRoot(container, {
    identifierPrefix: `plgrnd${++rootCount}-`,
    onUncaughtError: report('uncaught error'),
    onCaughtError: report('caught error'),
    onRecoverableError: report('recoverable error'),
  })
}
