import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Controls, MiniMap } from '@xyflow/react'
import { useFlowStore } from '@/stores/flow-store'
import { readFlowFromLocation, clearFlowHash } from '@/utils/flow/share'
import { clearTxParams, readTxParams } from '@/embed/embed-location'
import { FlowCanvas } from '@/components/flow/flow-canvas'
import { FlowToolbar } from '@/components/flow/flow-toolbar'

const EditorTxImport = lazy(() => import('@/components/flow/import/editor-tx-import'))

// A `#flow=` link wins over `?tx=`.
const readLinkedTx = () => (readFlowFromLocation() ? null : readTxParams())

export default function Home() {
  const replaceFlow = useFlowStore((s) => s.replaceFlow)
  const [linkedTx] = useState(readLinkedTx)
  const [importOpen, setImportOpen] = useState(linkedTx !== null)
  // Loaded on first use, then kept: it holds the summary of the imported flow.
  const [importUsed, setImportUsed] = useState(importOpen)

  const openImport = useCallback(() => {
    setImportUsed(true)
    setImportOpen(true)
  }, [])

  useEffect(() => {
    const shared = readFlowFromLocation()
    if (shared) {
      replaceFlow(shared)
      clearFlowHash()
    }
    clearTxParams()
  }, [replaceFlow])

  return (
    <div style={{ position: 'relative', width: '100vw', height: 'calc(100vh - 74px)' }}>
      <FlowCanvas mode="editor" embedded={false}>
        <MiniMap />
        <Controls />
        <FlowToolbar onImport={openImport} />
      </FlowCanvas>
      {importUsed && (
        <Suspense fallback={null}>
          <EditorTxImport open={importOpen} onOpenChange={setImportOpen} linked={linkedTx} />
        </Suspense>
      )}
    </div>
  )
}
