import { createContext, createElement, useContext, type PropsWithChildren } from 'react'
import { createStore, useStore, type StateCreator, type StoreApi } from 'zustand'
import {
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Viewport,
} from '@xyflow/react'
import type { FlowSnapshot } from './flow-snapshot'

export { FLOW_STORAGE_KEY, FLOW_STORAGE_VERSION, sanitizeNodes } from './flow-snapshot'
export type { FlowSnapshot } from './flow-snapshot'

export interface FlowState extends FlowSnapshot {
  /** Bumped whenever the whole flow is replaced; the editor then fits a flow that comes without a viewport. */
  generation: number
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  setNodes: (updater: Node[] | ((nodes: Node[]) => Node[])) => void
  setEdges: (updater: Edge[] | ((edges: Edge[]) => Edge[])) => void
  setViewport: (viewport: Viewport) => void
  replaceFlow: (snapshot: FlowSnapshot) => void
  resetFlow: () => void
}

export type FlowStore = StoreApi<FlowState>

const EMPTY_FLOW: FlowSnapshot = { nodes: [], edges: [] }

/** The flow state and actions; `resetFlow` returns to `initial`. Shared by the memory and persisted stores. */
export const flowStateCreator =
  (initial: FlowSnapshot): StateCreator<FlowState> =>
  (set) => ({
    nodes: initial.nodes,
    edges: initial.edges,
    viewport: initial.viewport,
    generation: 0,
    onNodesChange: (changes) => set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),
    onEdgesChange: (changes) => set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),
    setNodes: (updater) => set((s) => ({ nodes: typeof updater === 'function' ? updater(s.nodes) : updater })),
    setEdges: (updater) => set((s) => ({ edges: typeof updater === 'function' ? updater(s.edges) : updater })),
    setViewport: (viewport) => set({ viewport }),
    replaceFlow: (snapshot) =>
      set((s) => ({
        nodes: snapshot.nodes,
        edges: snapshot.edges,
        viewport: snapshot.viewport,
        generation: s.generation + 1,
      })),
    resetFlow: () =>
      set((s) => ({
        nodes: initial.nodes,
        edges: initial.edges,
        viewport: initial.viewport,
        generation: s.generation + 1,
      })),
  })

/** An in-memory flow store, owned by `/embed` and by each self-hosted widget (the editor persists its own). */
export const createFlowStore = (): FlowStore => createStore<FlowState>()(flowStateCreator(EMPTY_FLOW))

const FlowStoreContext = createContext<FlowStore | null>(null)

export const FlowStoreProvider = ({ store, children }: PropsWithChildren<{ store: FlowStore }>) =>
  createElement(FlowStoreContext.Provider, { value: store }, children)

const useFlowStoreApi = (): FlowStore => {
  const store = useContext(FlowStoreContext)
  if (!store) throw new Error('[plgrnd] useFlowStore must be used inside FlowStoreProvider')
  return store
}

export function useFlowStore<T>(selector: (state: FlowState) => T): T {
  return useStore(useFlowStoreApi(), selector)
}
