import { useEffect } from 'react'
import { Controls, MiniMap } from '@xyflow/react'
import { useFlowStore } from '@/stores/flow-store'
import { readFlowFromLocation, clearFlowHash } from '@/utils/flow/share'
import { FlowCanvas } from '@/components/flow/flow-canvas'
import { FlowToolbar } from '@/components/flow/flow-toolbar'

export default function Home() {
  const replaceFlow = useFlowStore((s) => s.replaceFlow)

  useEffect(() => {
    const shared = readFlowFromLocation()
    if (shared) {
      replaceFlow(shared)
      clearFlowHash()
    }
  }, [replaceFlow])

  return (
    <div style={{ width: '100vw', height: 'calc(100vh - 74px)' }}>
      <FlowCanvas mode="editor" embedded={false}>
        <MiniMap />
        <Controls />
        <FlowToolbar />
      </FlowCanvas>
    </div>
  )
}
