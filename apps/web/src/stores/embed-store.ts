import { create } from 'zustand'
import { parseEmbedConfig, type EmbedConfig, type EmbedTheme } from '@/embed/embed-config'
import { parseLocationParams } from '@/embed/embed-location'
import { resolveTheme, type ResolvedTheme } from '@/embed/embed-theme'
import type { FlowSnapshot } from '@/stores/flow-store'

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
}

const prefersDark = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

const initialParsed = parseEmbedConfig(parseLocationParams())

export const useEmbedStore = create<EmbedState>()((set) => ({
  config: initialParsed.config,
  ignoredParams: initialParsed.ignored,
  resolvedTheme: resolveTheme(initialParsed.config.theme, prefersDark()),
  initialSnapshot: null,
  status: 'loading',
  fitRequest: 0,
  setTheme: (theme) =>
    set((state) => ({
      config: { ...state.config, theme },
      resolvedTheme: resolveTheme(theme, prefersDark()),
    })),
  setResolvedTheme: (resolvedTheme) => set({ resolvedTheme }),
  setInitialSnapshot: (initialSnapshot) => set({ initialSnapshot }),
  setStatus: (status) => set({ status }),
  requestFit: () => set((state) => ({ fitRequest: state.fitRequest + 1 })),
}))
