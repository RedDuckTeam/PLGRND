import { useEffect, useRef, useState } from 'react'
import { Controls, MiniMap, useNodesInitialized, useReactFlow } from '@xyflow/react'
import { FlowCanvas } from '@/components/flow/flow-canvas'
import { EmbedToolbar } from '@/components/embed/embed-toolbar'
import { EmbedBadge } from '@/components/embed/embed-badge'
import { EmbedError } from '@/components/embed/embed-error'
import { useEmbedStore } from '@/stores/embed-store'
import { useFlowStore } from '@/stores/flow-store'
import { readFlowFromLocation } from '@/utils/flow/share'
import { postReadyMessage } from '@/embed/embed-theme'

export default function EmbedPage() {
  const config = useEmbedStore((s) => s.config)
  const resolvedTheme = useEmbedStore((s) => s.resolvedTheme)
  const status = useEmbedStore((s) => s.status)
  const fitRequest = useEmbedStore((s) => s.fitRequest)
  const setInitialSnapshot = useEmbedStore((s) => s.setInitialSnapshot)
  const setStatus = useEmbedStore((s) => s.setStatus)
  const replaceFlow = useFlowStore((s) => s.replaceFlow)

  const { fitView } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const readyPostedRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [resetState, setResetState] = useState({ applied: 0, epoch: 0 })

  useEffect(() => {
    const snapshot = readFlowFromLocation()
    if (!snapshot) {
      setStatus('error')
      return
    }
    replaceFlow(snapshot)
    setInitialSnapshot(structuredClone(snapshot))
    setStatus('ready')
  }, [replaceFlow, setInitialSnapshot, setStatus])

  useEffect(() => {
    if (status !== 'ready' || !nodesInitialized) return
    void fitView({ padding: 0.1 })
    if (!readyPostedRef.current) {
      readyPostedRef.current = true
      postReadyMessage()
    }
  }, [status, nodesInitialized, fitRequest, fitView])

  useEffect(() => {
    if (fitRequest === 0 || fitRequest === resetState.applied) return
    const snapshot = useEmbedStore.getState().initialSnapshot
    if (snapshot) replaceFlow(structuredClone(snapshot))
    setResetState((state) => ({ applied: fitRequest, epoch: state.epoch + 1 }))
  }, [fitRequest, resetState.applied, replaceFlow])

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let timer: number | undefined
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        fitView({ padding: 0.1 })
      }, 150)
    })
    observer.observe(el)
    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
    }
  }, [fitView])

  if (status === 'error') return <EmbedError />

  const resetting = fitRequest !== 0 && fitRequest !== resetState.applied

  return (
    <div ref={containerRef} className="h-full w-full">
      {!resetting && (
        <FlowCanvas key={resetState.epoch} mode={config.mode} embedded colorMode={resolvedTheme}>
          {config.controls && <Controls showInteractive={false} />}
          {config.minimap && <MiniMap className="mb-8" />}
          {config.toolbar && <EmbedToolbar />}
          <EmbedBadge />
        </FlowCanvas>
      )}
    </div>
  )
}
