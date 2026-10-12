// The contract between the element shell and the lazily loaded runtime. Type-only: the shell imports nothing
// the runtime imports, so the runtime chunk never depends on the entry.

export type ResolvedTheme = 'dark' | 'light'

/** Raw attribute values as the host set them (attributes and properties share one map; last write wins). */
export type RawAttributes = Record<string, string>

export interface RuntimeInit {
  attributes: RawAttributes
  /** The shell resolves `theme`, including `auto` against the host page's markers. */
  resolvedTheme: ResolvedTheme
}

export interface RuntimeCallbacks {
  /** The flow rendered and was fitted; called once per (re)initialization. */
  onReady: () => void
}

export interface RuntimeHandle {
  readonly marker: string
  update: (init: RuntimeInit) => void
  unmount: () => void
}

export interface RuntimeModule {
  mount: (shadow: ShadowRoot, host: HTMLElement, init: RuntimeInit, callbacks: RuntimeCallbacks) => RuntimeHandle
}
