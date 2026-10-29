import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import {
  ReactFlow,
  addEdge,
  useReactFlow,
  type Connection,
  type Edge,
  type IsValidConnection,
  type Node,
  type Viewport,
  SelectionMode,
} from '@xyflow/react'
import { nodeMap } from '@/utils/node/node-map'
import { useFlowStore } from '@/stores/flow-store'
import type { EmbedMode } from '@/embed/embed-config'
import { areHandleTypesCompatible, canConnectToTargetHandle } from '@/utils/flow/connection.utils'
import { FlowModeContext } from '@/components/flow/flow-mode-context'
import { FLOW_PANE_CLICK, FlowPaneEventsContext } from '@/components/flow/flow-pane-events'

const EDGE_OPTIONS_LOCKED = { selectable: false }
const NO_NODES: Node[] = []
const NO_EDGES: Edge[] = []

interface FlowCanvasProps extends PropsWithChildren {
  mode: EmbedMode
  embedded: boolean
  colorMode?: 'dark' | 'light'
  /** React Flow instance id; distinct per canvas when several share a page. */
  flowId?: string
  /**
   * Self-hosted widget on a third-party page: no React Flow key listeners on the host window/document,
   * and store callbacks that React Flow invokes outside React's dispatch are contained.
   */
  selfHosted?: boolean
}

const containErrors =
  <A extends unknown[]>(where: string, fn: (...args: A) => void) =>
  (...args: A): void => {
    try {
      fn(...args)
    } catch (error) {
      console.error(`[plgrnd] ${where} failed`, error)
    }
  }

export const FlowCanvas = ({
  mode,
  embedded,
  colorMode = 'dark',
  flowId,
  selfHosted = false,
  children,
}: FlowCanvasProps) => {
  const nodes = useFlowStore((s) => s.nodes)
  const edges = useFlowStore((s) => s.edges)
  const viewport = useFlowStore((s) => s.viewport)
  const onNodesChange = useFlowStore((s) => s.onNodesChange)
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange)
  const setNodes = useFlowStore((s) => s.setNodes)
  const setEdges = useFlowStore((s) => s.setEdges)
  const setViewport = useFlowStore((s) => s.setViewport)
  const generation = useFlowStore((s) => s.generation)

  const flowRef = useRef<HTMLDivElement>(null)
  const paneEvents = useMemo(() => new EventTarget(), [])
  const editable = mode === 'editor'

  const flowMode = useMemo(() => ({ mode, embedded }), [mode, embedded])

  // React Flow keys node components by id, and a replaced flow often reuses ids (an import's `ix0`, a link's IDL
  // node). One render without nodes unmounts the old components, so none carries its state into the new flow.
  const [shownGeneration, setShownGeneration] = useState(generation)
  const replacing = shownGeneration !== generation
  useEffect(() => {
    if (replacing) setShownGeneration(generation)
  }, [replacing, generation])

  // The editor shows a replaced flow (a link, an example, an import) at its own viewport, or fits one that has none
  // once every node is measured: React Flow applies `defaultViewport` only on mount, and its `fitView` fits whichever
  // nodes it measured first. Embeds place themselves.
  const { fitView, setViewport: moveViewport } = useReactFlow()
  const [placement, setPlacement] = useState({ generation, viewport, pending: !embedded && !viewport })
  if (placement.generation !== generation) setPlacement({ generation, viewport, pending: !embedded })
  const measured = nodes.length > 0 && nodes.every((node) => node.measured?.width !== undefined)
  useEffect(() => {
    if (!placement.pending || (!placement.viewport && !measured)) return
    setPlacement((p) => ({ ...p, pending: false }))
    void (placement.viewport ? moveViewport(placement.viewport) : fitView())
  }, [placement, measured, fitView, moveViewport])

  // Handle lookups stay inside this canvas's own tree (document, or a widget's shadow root).
  const queryRoot = useCallback((): ParentNode => (flowRef.current?.getRootNode() ?? document) as ParentNode, [])

  const onConnect = useCallback(
    (params: Connection) => {
      const root = queryRoot()
      setEdges((edgesSnapshot) => {
        if (!canConnectToTargetHandle(params.targetHandle, edgesSnapshot, root)) return edgesSnapshot
        return addEdge(params, edgesSnapshot)
      })
      const all = Array.from(root.querySelectorAll('[data-handle-type]')) as HTMLElement[]
      for (const el of all) el.classList.remove('handle--dim', 'handle--highlight')
    },
    [setEdges, queryRoot]
  )
  const isValidConnection: IsValidConnection = useCallback(
    (edge) => {
      if (!('sourceHandle' in edge) || !('targetHandle' in edge)) return true
      const c = edge as Connection
      const root = queryRoot()
      if (!canConnectToTargetHandle(c.targetHandle, edges, root)) return false

      const sourceEl = root.querySelector(`[data-id="${c.sourceHandle}"]`) as HTMLElement | null
      const targetEl = root.querySelector(`[data-id="${c.targetHandle}"]`) as HTMLElement | null
      const srcType = sourceEl?.getAttribute('data-type')
      const tgtType = targetEl?.getAttribute('data-type')
      return areHandleTypesCompatible(srcType, tgtType)
    },
    [edges, queryRoot]
  )
  const onConnectStart = useCallback(
    (_: unknown, params: { handleId: string | null; nodeId: string | null; handleType: string | null }) => {
      if (!params?.handleId) return
      const root = queryRoot()
      const sourceEl = root.querySelector(`[data-id="${params.handleId}"]`) as HTMLElement | null
      const srcType = sourceEl?.getAttribute('data-type')
      const allTargets = Array.from(root.querySelectorAll('[data-handle-type="target"]')) as HTMLElement[]
      for (const el of allTargets) {
        const targetHandle = el.getAttribute('data-id')
        const tgtType = el.getAttribute('data-type')
        const hasAvailableSlot = canConnectToTargetHandle(targetHandle, edges, root)
        const isCompatible = areHandleTypesCompatible(srcType, tgtType)

        if (hasAvailableSlot && isCompatible) {
          el.classList.remove('handle--dim')
        } else {
          el.classList.add('handle--dim')
          el.classList.remove('handle--highlight')
        }
      }
    },
    [edges, queryRoot]
  )
  const onConnectEnd = useCallback(() => {
    const all = Array.from(queryRoot().querySelectorAll('[data-handle-type]')) as HTMLElement[]
    for (const el of all) el.classList.remove('handle--dim', 'handle--highlight')
  }, [queryRoot])

  const onPaneClick = useCallback(() => {
    paneEvents.dispatchEvent(new Event(FLOW_PANE_CLICK))
  }, [paneEvents])

  const onViewportChange = useCallback((vp: Viewport) => setViewport(vp), [setViewport])

  // React Flow calls these from its ResizeObserver and d3-zoom handlers, outside React's dispatch.
  // On a self-hosted page an exception there would surface on the host window, so it is contained.
  const handleNodesChange = useMemo(
    () => (selfHosted ? containErrors('onNodesChange', onNodesChange) : onNodesChange),
    [selfHosted, onNodesChange]
  )
  const handleEdgesChange = useMemo(
    () => (selfHosted ? containErrors('onEdgesChange', onEdgesChange) : onEdgesChange),
    [selfHosted, onEdgesChange]
  )
  const handleViewportChange = useMemo(
    () => (selfHosted ? containErrors('onViewportChange', onViewportChange) : onViewportChange),
    [selfHosted, onViewportChange]
  )

  useEffect(() => {
    if (!editable) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && e.target === document.body) {
        const selectedNodes = nodes.filter((node) => (node as Node).selected)
        if (selectedNodes.length > 0) {
          setNodes((nds) => nds.filter((node) => !(node as Node).selected))
          setEdges((eds) =>
            eds.filter((edge) => !selectedNodes.some((node) => node.id === edge.source || node.id === edge.target))
          )
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editable, nodes, setNodes, setEdges])

  return (
    <FlowModeContext.Provider value={flowMode}>
      <FlowPaneEventsContext.Provider value={paneEvents}>
        <ReactFlow
          ref={flowRef}
          id={flowId}
          colorMode={colorMode}
          nodes={replacing ? NO_NODES : nodes}
          edges={replacing ? NO_EDGES : edges}
          nodeTypes={nodeMap}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onPaneClick={onPaneClick}
          onViewportChange={handleViewportChange}
          isValidConnection={isValidConnection}
          nodesDraggable={editable}
          nodesConnectable={editable}
          elementsSelectable={mode !== 'readonly'}
          nodesFocusable={editable}
          edgesFocusable={editable}
          deleteKeyCode={editable ? undefined : null}
          selectionKeyCode={editable ? undefined : null}
          multiSelectionKeyCode={editable ? undefined : null}
          panActivationKeyCode={selfHosted ? null : undefined}
          zoomActivationKeyCode={selfHosted ? null : undefined}
          defaultEdgeOptions={editable ? undefined : EDGE_OPTIONS_LOCKED}
          preventScrolling={!embedded}
          zoomOnScroll={!embedded}
          zoomOnDoubleClick={!embedded}
          // Low enough to fit an imported transaction's flow (up to ~2000 x 2500 px) in the editor.
          minZoom={embedded ? 0.1 : 0.2}
          panOnScroll={false}
          zoomOnPinch={true}
          defaultViewport={embedded ? undefined : viewport}
          selectionOnDrag={false}
          selectionMode={SelectionMode.Full}
          panOnDrag={true}
          className="h-full w-full"
        >
          {children}
        </ReactFlow>
      </FlowPaneEventsContext.Provider>
    </FlowModeContext.Provider>
  )
}
