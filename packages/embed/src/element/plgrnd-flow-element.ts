import type { RawAttributes, ResolvedTheme, RuntimeHandle, RuntimeModule } from '../types/runtime-api'
import { adoptShellSheet } from './styles'
import { detectHostTheme, watchHostTheme } from './host-theme'
import { plgrndHref } from './links'

/** Observed attributes (AC-A1); `ref` is the plain-HTML alias of `link-ref`. */
export const ATTRIBUTES = [
  'flow',
  'tx',
  'cluster',
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
  'rpc-mainnet',
  'rpc-devnet',
  'link-ref',
  'ref',
] as const

/** camelCase properties and the attribute each one shares a value with. Properties do not reflect. */
export const PROPERTIES: Record<string, (typeof ATTRIBUTES)[number]> = {
  flow: 'flow',
  tx: 'tx',
  cluster: 'cluster',
  theme: 'theme',
  bg: 'bg',
  surface: 'surface',
  fg: 'fg',
  border: 'border',
  accent: 'accent',
  radius: 'radius',
  font: 'font',
  fontMono: 'font-mono',
  controls: 'controls',
  minimap: 'minimap',
  toolbar: 'toolbar',
  mode: 'mode',
  rpcMainnet: 'rpc-mainnet',
  rpcDevnet: 'rpc-devnet',
  linkRef: 'link-ref',
}

export interface ElementOptions {
  version: string
  /** Loads (ESM) or evaluates (IIFE) the runtime; repeated calls must be safe. */
  load: () => Promise<RuntimeModule>
  /** ESM: start loading the runtime chunk as soon as an element connects (AC-D2). IIFE: at first intersection. */
  eager: boolean
}

interface WidgetState {
  values: Map<string, string>
  handle: RuntimeHandle | null
  observer: IntersectionObserver | null
  shell: HTMLElement | null
  /** Bumped on disconnect, so a mount that resolves later for a detached element is dropped. */
  token: number
  unmountQueued: boolean
  updateQueued: boolean
  stopTheme: (() => void) | null
}

const STATES = new WeakMap<HTMLElement, WidgetState>()

const resolveTheme = (theme: string | undefined): ResolvedTheme => {
  if (theme === 'light' || theme === 'dark') return theme
  if (theme === 'auto') return detectHostTheme()
  return 'dark' // G0-6: same default as the iframe
}

/** Creates the element class; called inside define(), so module evaluation never touches DOM globals (SSR). */
export function createElementClass({ version, load, eager }: ElementOptions): CustomElementConstructor {
  class PlgrndFlowElement extends HTMLElement {
    static readonly version = version

    static get observedAttributes(): string[] {
      return [...ATTRIBUTES]
    }

    constructor() {
      super()
      const shadow = this.attachShadow({ mode: 'open' })
      adoptShellSheet(shadow)
      STATES.set(this, {
        values: new Map(),
        handle: null,
        observer: null,
        shell: null,
        token: 0,
        unmountQueued: false,
        updateQueued: false,
        stopTheme: null,
      })
      // L2: properties set on the element before it was defined shadow the accessors; re-apply them through them.
      const own = this as unknown as Record<string, unknown>
      for (const property of Object.keys(PROPERTIES)) {
        if (Object.prototype.hasOwnProperty.call(this, property)) {
          const value = own[property]
          delete own[property]
          own[property] = value
        }
      }
    }

    connectedCallback() {
      const state = this.#state
      if (state.unmountQueued) {
        state.unmountQueued = false // moved within the document
        if (state.handle) return
      }
      if (state.handle || state.observer) return
      this.#showShell('loading')
      if (eager) load().catch(() => undefined) // a failure surfaces at mount time, with Retry
      const token = ++state.token
      // Mount within one viewport of becoming visible (the iframe embed uses loading="lazy").
      state.observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return
          state.observer?.disconnect()
          state.observer = null
          this.#mount(token)
        },
        { rootMargin: '100% 0px' }
      )
      state.observer.observe(this)
    }

    disconnectedCallback() {
      const state = this.#state
      state.observer?.disconnect()
      state.observer = null
      state.token++
      // Deferred, so a move within the document (disconnect + connect in one task) keeps the widget.
      state.unmountQueued = true
      queueMicrotask(() => {
        if (!state.unmountQueued) return
        state.unmountQueued = false
        state.stopTheme?.()
        state.stopTheme = null
        state.handle?.unmount()
        state.handle = null
        this.#hideShell()
      })
    }

    attributeChangedCallback(name: string, _old: string | null, value: string | null) {
      this.#write(name, value)
    }

    get #state(): WidgetState {
      return STATES.get(this) as WidgetState
    }

    /** Attributes and properties share one map: the last write wins. */
    #write(attribute: string, value: unknown) {
      const values = this.#state.values
      if (value === null || value === undefined) values.delete(attribute)
      else values.set(attribute, String(value))
      this.#queueUpdate()
    }

    #read(attribute: string): string | null {
      return this.#state.values.get(attribute) ?? null
    }

    #init() {
      const attributes: RawAttributes = Object.fromEntries(this.#state.values)
      return { attributes, resolvedTheme: resolveTheme(attributes.theme) }
    }

    #syncThemeWatch() {
      const state = this.#state
      const auto = state.values.get('theme') === 'auto'
      if (auto && !state.stopTheme && state.handle) state.stopTheme = watchHostTheme(() => this.#queueUpdate())
      if (!auto && state.stopTheme) {
        state.stopTheme()
        state.stopTheme = null
      }
    }

    #queueUpdate() {
      const state = this.#state
      if (state.updateQueued) return
      state.updateQueued = true
      queueMicrotask(() => {
        state.updateQueued = false
        if (!state.handle) return
        try {
          state.handle.update(this.#init())
        } catch (error) {
          console.error('[plgrnd] widget update failed', error)
        }
        this.#syncThemeWatch()
      })
    }

    #mount(token: number) {
      const state = this.#state
      load().then(
        (runtime) => {
          if (token !== state.token || !this.isConnected || state.handle || !this.shadowRoot) return
          try {
            this.#hideShell()
            state.handle = runtime.mount(this.shadowRoot, this, this.#init(), {
              onReady: () =>
                this.dispatchEvent(
                  new CustomEvent('plgrnd:ready', { bubbles: true, composed: true, detail: { version } })
                ),
            })
            this.#syncThemeWatch()
          } catch (error) {
            console.error('[plgrnd] the widget could not be mounted', error)
            this.#showShell('error')
          }
        },
        (error) => {
          if (token !== state.token) return
          console.error('[plgrnd] the widget runtime could not be loaded', error)
          this.#showShell('error')
        }
      )
    }

    #showShell(kind: 'loading' | 'error') {
      const state = this.#state
      const shadow = this.shadowRoot
      if (!shadow) return
      state.shell?.remove()
      const shell = document.createElement('div')
      shell.className = 'plgrnd-shell'
      shell.setAttribute('data-theme', resolveTheme(state.values.get('theme')))
      if (kind === 'loading') {
        shell.setAttribute('role', 'status')
        shell.setAttribute('aria-label', 'Loading PLGRND flow')
        const spinner = document.createElement('div')
        spinner.className = 'plgrnd-spinner'
        const wordmark = document.createElement('div')
        wordmark.className = 'plgrnd-wordmark'
        wordmark.textContent = 'PLGRND'
        shell.append(spinner, wordmark)
      } else {
        shell.setAttribute('role', 'alert')
        const message = document.createElement('p')
        message.textContent = 'The PLGRND widget could not be loaded'
        const retry = document.createElement('button')
        retry.type = 'button'
        retry.textContent = 'Retry'
        retry.addEventListener('click', () => {
          this.#showShell('loading')
          this.#mount(++state.token)
        })
        const link = document.createElement('a')
        link.href = plgrndHref(state.values.get('link-ref') ?? state.values.get('ref'))
        link.target = '_blank'
        link.rel = 'noopener'
        link.textContent = 'plgrnd.io'
        shell.append(message, retry, link)
      }
      shadow.append(shell)
      state.shell = shell
    }

    #hideShell() {
      const state = this.#state
      state.shell?.remove()
      state.shell = null
    }

    /** Used by the property accessors defined below. */
    static writeValue(element: PlgrndFlowElement, attribute: string, value: unknown) {
      element.#write(attribute, value)
    }

    static readValue(element: PlgrndFlowElement, attribute: string): string | null {
      return element.#read(attribute)
    }
  }

  for (const [property, attribute] of Object.entries(PROPERTIES)) {
    Object.defineProperty(PlgrndFlowElement.prototype, property, {
      configurable: true,
      enumerable: true,
      get(this: PlgrndFlowElement) {
        return PlgrndFlowElement.readValue(this, attribute)
      },
      set(this: PlgrndFlowElement, value: unknown) {
        PlgrndFlowElement.writeValue(this, attribute, value)
      },
    })
  }

  return PlgrndFlowElement
}
