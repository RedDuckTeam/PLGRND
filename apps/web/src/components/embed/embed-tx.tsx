import { lazy, Suspense, useState } from 'react'
import { EmbedCanvas } from '@/components/embed/embed-canvas'
import { TxImportView } from '@/components/embed/tx-import-view'
import type { LinkedTx } from '@/embed/embed-location'
import { postReadyMessage } from '@/embed/embed-theme'
import { useEmbedStore } from '@/stores/embed-store'

const ImportSummary = lazy(() =>
  import('@/components/flow/import/import-summary').then(({ ImportSummary }) => ({ default: ImportSummary }))
)

/** `/embed?tx=`: the imported transaction's flow; editor mode also offers an IDL paste for programs without one. */
export const EmbedTx = ({ linked }: { linked: LinkedTx }) => {
  const editor = useEmbedStore((s) => s.config.mode === 'editor')
  const [summaryOpen, setSummaryOpen] = useState(true)

  return (
    <TxImportView linked={linked}>
      {(result, setResult) => (
        <div className="relative h-full w-full">
          <EmbedCanvas snapshot={result.snapshot} snapshotKey="tx" onReady={postReadyMessage} />
          {editor && summaryOpen && (
            <Suspense fallback={null}>
              <ImportSummary
                result={result}
                onResult={setResult}
                onDismiss={() => setSummaryOpen(false)}
                canRemember={false}
              />
            </Suspense>
          )}
        </div>
      )}
    </TxImportView>
  )
}
