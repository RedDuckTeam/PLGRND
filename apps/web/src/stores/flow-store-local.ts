import { createStore } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import type { Node } from '@xyflow/react'
import { NodeTypeEnum } from '@/types/node'
import { isEmbedPath } from '@/embed/embed-location'
import { FLOW_STORAGE_KEY, FLOW_STORAGE_VERSION, sanitizeNodes, type FlowSnapshot } from './flow-snapshot'
import { flowStateCreator, type FlowState, type FlowStore } from './flow-store'

// App-only: the editor's flow survives reloads in localStorage. Embeds never import this module.

const guardedLocalStorage: StateStorage = {
  getItem: (name) => window.localStorage.getItem(name),
  setItem: (name, value) => {
    if (isEmbedPath(window.location.pathname)) {
      console.error('[plgrnd] blocked a localStorage write from an embed document')
      return
    }
    window.localStorage.setItem(name, value)
  },
  removeItem: (name) => {
    if (isEmbedPath(window.location.pathname)) {
      console.error('[plgrnd] blocked a localStorage removal from an embed document')
      return
    }
    window.localStorage.removeItem(name)
  },
}

const DEFAULT_FLOW: FlowSnapshot = {
  nodes: [
    { id: 'default1', position: { x: 0, y: 0 }, type: NodeTypeEnum.TEXT, data: { text: 'Welcome to PLGRND!' } },
    {
      id: 'default2',
      position: { x: 0, y: 70 },
      type: NodeTypeEnum.TEXT,
      data: { text: "I hope we've made your Solana learning journey much easier!" },
    },
  ],
  edges: [],
}

export const createLocalFlowStore = (): FlowStore =>
  createStore<FlowState>()(
    persist(flowStateCreator(DEFAULT_FLOW), {
      name: FLOW_STORAGE_KEY,
      version: FLOW_STORAGE_VERSION,
      storage: createJSONStorage(() => guardedLocalStorage),
      partialize: (state) => ({
        nodes: sanitizeNodes(state.nodes),
        edges: state.edges,
        viewport: state.viewport,
      }),
      migrate: (persisted) => {
        const p = persisted as Partial<FlowSnapshot> | undefined
        if (!p) return p
        return {
          ...p,
          nodes: Array.isArray(p.nodes) ? sanitizeNodes(p.nodes as Node[]) : [],
        }
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<FlowSnapshot> | undefined
        if (!p) return current
        return {
          ...current,
          ...p,
          nodes: Array.isArray(p.nodes) ? sanitizeNodes(p.nodes as Node[]) : current.nodes,
        }
      },
    })
  )
