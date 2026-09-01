import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { toast } from 'sonner'
import { useFlowStore } from '@/stores/flow-store'
import { buildEditorUrl } from '@/embed/embed-url'

export const useOpenInEditor = () => {
  const { getViewport } = useReactFlow()

  return useCallback(() => {
    const { nodes, edges } = useFlowStore.getState()
    const url = buildEditorUrl({ nodes, edges, viewport: getViewport() })
    const win = window.open(url, '_blank')
    if (win) {
      win.opener = null
      return
    }
    toast.info('Popup blocked — copy the editor link instead', {
      description: url,
      action: {
        label: 'Copy',
        onClick: () => {
          navigator.clipboard.writeText(url).catch(() => toast.error('Failed to copy link'))
        },
      },
    })
  }, [getViewport])
}
