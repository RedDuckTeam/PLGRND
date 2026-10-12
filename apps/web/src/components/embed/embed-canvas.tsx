import { useEffect, useRef, useState } from 'react'
import { Controls, MiniMap, useNodesInitialized, useReactFlow } from '@xyflow/react'
import { FlowCanvas } from '@/components/flow/flow-canvas'
import { EmbedToolbar } from '@/components/embed/embed-toolbar'
import { EmbedBadge } from '@/components/embed/embed-badge'
import { EmbedError } from '@/components/embed/embed-error'
import { useEmbedStore, useEmbedStoreApi } from '@/stores/embed-store'
import { useFlowStore } from '@/stores/flow-store'
import type { FlowSnapshot } from '@/stores/flow-snapshot'

interface EmbedCanvasProps {
  /** The flow to show; `null` renders the error state. */
  snapshot: FlowSnapshot | null
  /** Identity of `snapshot`: a new key re-initializes the canvas and the Reset snapshot. */
  snapshotKey: string
  /** Called once per key, after the flow has rendered and been fitted. */
  onReady: () => void
  /** Self-hosted widget on a third-party page (see FlowCanvas). */
  selfHosted?: boolean
  flowId?: string
}

const runContained = (where: string, fn: () => void) => {
  try {
    fn()
  } catch (error) {
    console.error(`[plgrnd] ${where} failed`, error)
  }
}
const runPlain = (_: string, fn: () => void) => fn()

export const EmbedCanvas = ({ snapshot, snapshotKey, onReady, selfHosted = false, flowId }: EmbedCanvasProps) => {
  const config = useEmbedStore((s) => s.config)
  const resolvedTheme = useEmbedStore((s) => s.resolvedTheme)
  const status = useEmbedStore((s) => s.status)
  const fitRequest = useEmbedStore((s) => s.fitRequest)
  const setInitialSnapshot = useEmbedStore((s) => s.setInitialSnapshot)
  const setStatus = useEmbedStore((s) => s.setStatus)
  const embedStore = useEmbedStoreApi()
  const replaceFlow = useFlowStore((s) => s.replaceFlow)

  const { fitView } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const readyKeyRef = useRef<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [resetState, setResetState] = useState({ applied: 0, epoch: 0 })
  // Callbacks that run outside React's dispatch must not throw onto a host page (self-hosted only).
  const contained = selfHosted ? runContained : runPlain

  useEffect(() => {
    if (!snapshot) {
      setStatus('error')
      return
    }
    replaceFlow(structuredClone(snapshot))
    setInitialSnapshot(structuredClone(snapshot))
    setStatus('ready')
  }, [snapshot, snapshotKey, replaceFlow, setInitialSnapshot, setStatus])

  useEffect(() => {
    if (status !== 'ready' || !nodesInitialized) return
    void fitView({ padding: 0.1 })
    if (readyKeyRef.current !== snapshotKey) {
      readyKeyRef.current = snapshotKey
      onReady()
    }
  }, [status, nodesInitialized, fitRequest, fitView, snapshotKey, onReady])

  useEffect(() => {
    if (fitRequest === 0 || fitRequest === resetState.applied) return
    const initial = embedStore.getState().initialSnapshot
    if (initial) replaceFlow(structuredClone(initial))
    setResetState((state) => ({ applied: fitRequest, epoch: state.epoch + 1 }))
  }, [fitRequest, resetState.applied, replaceFlow, embedStore])

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let timer: number | undefined
    const observer = new ResizeObserver(() =>
      contained('resize', () => {
        window.clearTimeout(timer)
        timer = window.setTimeout(() => contained('refit', () => void fitView({ padding: 0.1 })), 150)
      })
    )
    observer.observe(el)
    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
    }
  }, [fitView, contained])

  if (status === 'error') return <EmbedError />

  const resetting = fitRequest !== 0 && fitRequest !== resetState.applied

  return (
    <div ref={containerRef} className="h-full w-full">
      {!resetting && (
        <FlowCanvas
          key={resetState.epoch}
          mode={config.mode}
          embedded
          selfHosted={selfHosted}
          flowId={flowId}
          colorMode={resolvedTheme}
        >
          {config.controls && <Controls showInteractive={false} />}
          {config.minimap && <MiniMap className="mb-8" />}
          {config.toolbar && <EmbedToolbar />}
          <EmbedBadge />
        </FlowCanvas>
      )}
    </div>
  )
}
