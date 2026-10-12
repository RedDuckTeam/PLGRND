import { createContext, createElement, useContext, type PropsWithChildren } from 'react'
import { createStore, useStore, type StoreApi } from 'zustand'
import type { EmbedConfig, EmbedTheme } from '@/embed/embed-config'
import { resolveTheme, type ResolvedTheme } from '@/embed/embed-theme'
import type { FlowSnapshot } from '@/stores/flow-snapshot'

export type EmbedStatus = 'loading' | 'ready' | 'error'

interface EmbedState {
  config: EmbedConfig
  ignoredParams: string[]
  resolvedTheme: ResolvedTheme
  initialSnapshot: FlowSnapshot | null
  status: EmbedStatus
  fitRequest: number
  setTheme: (theme: EmbedTheme) => void
  setResolvedTheme: (resolvedTheme: ResolvedTheme) => void
  setInitialSnapshot: (snapshot: FlowSnapshot) => void
  setStatus: (status: EmbedStatus) => void
  requestFit: () => void
  /** Self-hosted attribute changes: new options without re-creating the widget. */
  setConfig: (config: EmbedConfig, ignored: string[]) => void
}

export type EmbedStore = StoreApi<EmbedState>

interface EmbedStoreInit {
  config: EmbedConfig
  ignored: string[]
  resolvedTheme: ResolvedTheme
}

export const prefersDark = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Embed state for one widget: config parsed by its host (URL for `/embed`, attributes when self-hosted). */
export const createEmbedStore = ({ config, ignored, resolvedTheme }: EmbedStoreInit): EmbedStore =>
  createStore<EmbedState>()((set) => ({
    config,
    ignoredParams: ignored,
    resolvedTheme,
    initialSnapshot: null,
    status: 'loading',
    fitRequest: 0,
    setTheme: (theme) =>
      set((state) => ({
        config: { ...state.config, theme },
        resolvedTheme: resolveTheme(theme, prefersDark()),
      })),
    setResolvedTheme: (next) => set({ resolvedTheme: next }),
    setInitialSnapshot: (initialSnapshot) => set({ initialSnapshot }),
    setStatus: (status) => set({ status }),
    requestFit: () => set((state) => ({ fitRequest: state.fitRequest + 1 })),
    setConfig: (next, nextIgnored) => set({ config: next, ignoredParams: nextIgnored }),
  }))

const EmbedStoreContext = createContext<EmbedStore | null>(null)

export const EmbedStoreProvider = ({ store, children }: PropsWithChildren<{ store: EmbedStore }>) =>
  createElement(EmbedStoreContext.Provider, { value: store }, children)

export const useEmbedStoreApi = (): EmbedStore => {
  const store = useContext(EmbedStoreContext)
  if (!store) throw new Error('[plgrnd] useEmbedStore must be used inside EmbedStoreProvider')
  return store
}

export function useEmbedStore<T>(selector: (state: EmbedState) => T): T {
  return useStore(useEmbedStoreApi(), selector)
}
