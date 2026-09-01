import { useCallback, useEffect, useMemo, type PropsWithChildren } from 'react'
import {
  ReactFlow,
  addEdge,
  type Connection,
  type IsValidConnection,
  type Node,
  type Viewport,
  SelectionMode,
} from '@xyflow/react'
import { nodeMap } from '@/utils/node/node-map'
import { useFlowStore } from '@/stores/flow-store'
import { IS_EMBED } from '@/embed/embed-location'
import type { EmbedMode } from '@/embed/embed-config'
import { areHandleTypesCompatible, canConnectToTargetHandle } from '@/utils/flow/connection.utils'
import { FlowModeContext } from '@/components/flow/flow-mode-context'

const EDGE_OPTIONS_LOCKED = { selectable: false }

interface FlowCanvasProps extends PropsWithChildren {
  mode: EmbedMode
  embedded: boolean
  colorMode?: 'dark' | 'light'
}

export const FlowCanvas = ({ mode, embedded, colorMode = 'dark', children }: FlowCanvasProps) => {
  const nodes = useFlowStore((s) => s.nodes)
  const edges = useFlowStore((s) => s.edges)
  const viewport = useFlowStore((s) => s.viewport)
  const onNodesChange = useFlowStore((s) => s.onNodesChange)
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange)
  const setNodes = useFlowStore((s) => s.setNodes)
  const setEdges = useFlowStore((s) => s.setEdges)
  const setViewport = useFlowStore((s) => s.setViewport)

  const editable = mode === 'editor'

  if (import.meta.env.DEV && embedded !== IS_EMBED) {
    console.error('[plgrnd] FlowCanvas embedded prop disagrees with IS_EMBED')
  }

  const flowMode = useMemo(() => ({ mode, embedded }), [mode, embedded])

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((edgesSnapshot) => {
        if (!canConnectToTargetHandle(params.targetHandle, edgesSnapshot)) return edgesSnapshot
        return addEdge(params, edgesSnapshot)
      })
      const all = Array.from(document.querySelectorAll('[data-handle-type]')) as HTMLElement[]
      for (const el of all) el.classList.remove('handle--dim', 'handle--highlight')
      document.body.removeAttribute('data-connecting-type')
    },
    [setEdges]
  )
  const isValidConnection: IsValidConnection = useCallback(
    (edge) => {
      if (!('sourceHandle' in edge) || !('targetHandle' in edge)) return true
      const c = edge as Connection
      if (!canConnectToTargetHandle(c.targetHandle, edges)) return false

      const sourceEl = document.querySelector(`[data-id="${c.sourceHandle}"]`) as HTMLElement | null
      const targetEl = document.querySelector(`[data-id="${c.targetHandle}"]`) as HTMLElement | null
      const srcType = sourceEl?.getAttribute('data-type')
      const tgtType = targetEl?.getAttribute('data-type')
      return areHandleTypesCompatible(srcType, tgtType)
    },
    [edges]
  )
  const onConnectStart = useCallback(
    (_: unknown, params: { handleId: string | null; nodeId: string | null; handleType: string | null }) => {
      if (!params?.handleId) return
      const sourceEl = document.querySelector(`[data-id="${params.handleId}"]`) as HTMLElement | null
      const srcType = sourceEl?.getAttribute('data-type')
      const allTargets = Array.from(document.querySelectorAll('[data-handle-type="target"]')) as HTMLElement[]
      for (const el of allTargets) {
        const targetHandle = el.getAttribute('data-id')
        const tgtType = el.getAttribute('data-type')
        const hasAvailableSlot = canConnectToTargetHandle(targetHandle, edges)
        const isCompatible = areHandleTypesCompatible(srcType, tgtType)

        if (hasAvailableSlot && isCompatible) {
          el.classList.remove('handle--dim')
        } else {
          el.classList.add('handle--dim')
          el.classList.remove('handle--highlight')
        }
      }
    },
    [edges]
  )
  const onConnectEnd = useCallback(() => {
    const all = Array.from(document.querySelectorAll('[data-handle-type]')) as HTMLElement[]
    for (const el of all) el.classList.remove('handle--dim', 'handle--highlight')
  }, [])

  const onPaneClick = useCallback(() => {
    window.dispatchEvent(new Event('flow-pane-click'))
  }, [])

  const onViewportChange = useCallback((vp: Viewport) => setViewport(vp), [setViewport])

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
      <ReactFlow
        colorMode={colorMode}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeMap}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onPaneClick={onPaneClick}
        onViewportChange={onViewportChange}
        isValidConnection={isValidConnection}
        nodesDraggable={editable}
        nodesConnectable={editable}
        elementsSelectable={mode !== 'readonly'}
        nodesFocusable={editable}
        edgesFocusable={editable}
        deleteKeyCode={editable ? undefined : null}
        selectionKeyCode={editable ? undefined : null}
        multiSelectionKeyCode={editable ? undefined : null}
        defaultEdgeOptions={editable ? undefined : EDGE_OPTIONS_LOCKED}
        preventScrolling={!embedded}
        zoomOnScroll={!embedded}
        zoomOnDoubleClick={!embedded}
        minZoom={embedded ? 0.1 : 0.5}
        panOnScroll={false}
        zoomOnPinch={true}
        defaultViewport={embedded ? undefined : viewport}
        fitView={embedded ? false : !viewport}
        selectionOnDrag={false}
        selectionMode={SelectionMode.Full}
        panOnDrag={true}
        className="h-full w-full"
      >
        {children}
      </ReactFlow>
    </FlowModeContext.Provider>
  )
}
