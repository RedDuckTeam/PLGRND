import { lazy, Suspense, useState } from 'react'
import { EmbedCanvas } from '@/components/embed/embed-canvas'
import { readTxParams } from '@/embed/embed-location'
import { readFlowFromLocation } from '@/utils/flow/share'
import { postReadyMessage } from '@/embed/embed-theme'

// Only `?tx=` embeds load the importer's UI.
const EmbedTx = lazy(() => import('@/components/embed/embed-tx').then(({ EmbedTx }) => ({ default: EmbedTx })))

export default function EmbedPage() {
  const [snapshot] = useState(readFlowFromLocation)
  // A `#flow=` payload wins over `?tx=`.
  const [linkedTx] = useState(() => (snapshot ? null : readTxParams()))
  if (linkedTx) {
    return (
      <Suspense fallback={<div className="h-full w-full bg-background" />}>
        <EmbedTx linked={linkedTx} />
      </Suspense>
    )
  }
  return <EmbedCanvas snapshot={snapshot} snapshotKey="location" onReady={postReadyMessage} />
}
