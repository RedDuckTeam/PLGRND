import { useCallback, useEffect, useRef, useState } from 'react'
import { useRpcConfig } from '@/providers/rpc-urls-context'
import type { Network } from '@/types/network'
import { importErrorMessage, importTx, type ImportResult, type ImportStage } from './tx-import'

export interface TxImportStatus {
  running: boolean
  stage?: ImportStage
  error?: string
}

/**
 * Imports over the page's RPC with progress and errors. `run` resolves to the result, or null when the import failed
 * (see `error`) or was dropped: a new run, `cancel` and unmounting abort the previous one.
 */
export function useTxImport({ rememberedIdls }: { rememberedIdls: boolean }) {
  const rpc = useRpcConfig()
  const [status, setStatus] = useState<TxImportStatus>({ running: false })
  const current = useRef<AbortController | null>(null)

  useEffect(() => () => current.current?.abort(), [])

  const cancel = useCallback(() => {
    current.current?.abort()
    current.current = null
    setStatus({ running: false })
  }, [])

  const run = useCallback(
    async (input: string, network?: Network): Promise<ImportResult | null> => {
      current.current?.abort()
      const controller = new AbortController()
      current.current = controller
      const live = () => !controller.signal.aborted
      setStatus({ running: true })
      try {
        const result = await importTx(rpc, input, {
          network,
          rememberedIdls,
          signal: controller.signal,
          onStage: (stage) => {
            if (live()) setStatus({ running: true, stage })
          },
        })
        if (!live()) return null
        current.current = null
        setStatus({ running: false })
        return result
      } catch (error) {
        if (live()) {
          current.current = null
          // The stage stays, to show where it failed.
          setStatus((s) => ({ running: false, stage: s.stage, error: importErrorMessage(error) }))
        }
        return null
      }
    },
    [rpc, rememberedIdls]
  )

  return { ...status, run, cancel }
}
