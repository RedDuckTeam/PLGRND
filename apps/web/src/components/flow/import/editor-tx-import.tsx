import { useCallback, useEffect, useRef, useState } from 'react'
import type { LinkedTx } from '@/embed/embed-location'
import type { ImportResult } from '@/hooks/import/tx-import'
import { useTxImport } from '@/hooks/import/use-tx-import'
import { useFlowStore } from '@/stores/flow-store'
import type { Network } from '@/types/network'
import { ImportDialog } from './import-dialog'
import { ImportSummary } from './import-summary'

interface EditorTxImportProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `?tx=` of the page's URL: imported on mount without asking, like a `#flow=` link. */
  linked: LinkedTx | null
}

interface Applied {
  result: ImportResult
  /** The flow store's generation once this result was on the canvas. */
  generation: number
  /** A new import (not a paste) gets a new summary. */
  id: number
}

/** The editor's import dialog, and the summary of the imported flow while it is the one on the canvas. */
export default function EditorTxImport({ open, onOpenChange, linked }: EditorTxImportProps) {
  const replaceFlow = useFlowStore((s) => s.replaceFlow)
  const generation = useFlowStore((s) => s.generation)
  const nodeCount = useFlowStore((s) => s.nodes.length)
  const { run, cancel, ...status } = useTxImport({ rememberedIdls: true })
  const [applied, setApplied] = useState<Applied | null>(null)
  const generationRef = useRef(generation)

  useEffect(() => {
    generationRef.current = generation
  }, [generation])

  // replaceFlow bumps the generation; Reset, an example or a shared link bump it again, which hides the summary.
  const apply = useCallback(
    (result: ImportResult, fresh: boolean) => {
      replaceFlow(result.snapshot)
      const next = ++generationRef.current
      setApplied((prev) => ({ result, generation: next, id: fresh || !prev ? (prev?.id ?? 0) + 1 : prev.id }))
    },
    [replaceFlow]
  )

  const start = useCallback(
    async (input: string, network?: Network) => {
      const result = await run(input, network)
      if (!result) return
      apply(result, true)
      onOpenChange(false)
    },
    [run, apply, onOpenChange]
  )

  useEffect(() => {
    if (!linked) return
    void start(linked.input, linked.network)
    return cancel
  }, [linked, start, cancel])

  const handleOpenChange = (next: boolean) => {
    if (!next && status.running) cancel()
    onOpenChange(next)
  }

  return (
    <>
      <ImportDialog
        open={open}
        onOpenChange={handleOpenChange}
        status={status}
        onImport={(input, network) => void start(input, network)}
        onStop={cancel}
        nodeCount={nodeCount}
        initialInput={linked?.input}
        initialNetwork={linked?.network}
      />
      {applied && applied.generation === generation && (
        <ImportSummary
          key={applied.id}
          result={applied.result}
          onResult={(result) => apply(result, false)}
          onDismiss={() => setApplied(null)}
          canRemember
        />
      )}
    </>
  )
}
