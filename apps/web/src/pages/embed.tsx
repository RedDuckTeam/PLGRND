import { useState } from 'react'
import { EmbedCanvas } from '@/components/embed/embed-canvas'
import { readFlowFromLocation } from '@/utils/flow/share'
import { postReadyMessage } from '@/embed/embed-theme'

export default function EmbedPage() {
  const [snapshot] = useState(readFlowFromLocation)
  return <EmbedCanvas snapshot={snapshot} snapshotKey="location" onReady={postReadyMessage} />
}
