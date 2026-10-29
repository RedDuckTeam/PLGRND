import { useEffect, useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { EmbedError } from '@/components/embed/embed-error'
import type { LinkedTx } from '@/embed/embed-location'
import { IMPORT_STAGES, type ImportResult } from '@/hooks/import/tx-import'
import { useTxImport } from '@/hooks/import/use-tx-import'

interface TxImportViewProps {
  linked: LinkedTx
  /** Offers Retry next to an import error. */
  onRetry?: () => void
  /** The imported flow; `setResult` replaces it (e.g. after an IDL paste). */
  children: (result: ImportResult, setResult: (result: ImportResult) => void) => ReactNode
}

/**
 * An embedded transaction import (`/embed?tx=`, `<plgrnd-flow tx>`): progress, then the result or the error. It runs
 * over the page's RPC and never reads IDLs remembered in the browser.
 */
export const TxImportView = ({ linked, onRetry, children }: TxImportViewProps) => {
  const { run, cancel, stage, error } = useTxImport({ rememberedIdls: false })
  const [result, setResult] = useState<ImportResult | null>(null)

  useEffect(() => {
    void run(linked.input, linked.network).then((imported) => {
      if (imported) setResult(imported)
    })
    return cancel
  }, [linked, run, cancel])

  if (error) return <EmbedError title="This transaction could not be imported" detail={error} onRetry={onRetry} />

  if (!result) {
    const label = IMPORT_STAGES.find((s) => s.stage === stage)?.label ?? 'Loading the importer'
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-background font-mono text-foreground">
        <p className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Importing transaction
        </p>
        <p className="text-xs text-muted-foreground">{label}…</p>
      </div>
    )
  }

  return children(result, setResult)
}
