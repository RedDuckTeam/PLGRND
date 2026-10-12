import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { toast } from 'sonner'
import { buildEditorUrl } from '@/embed/embed-url'
import { useEmbedHost } from '@/embed/embed-host-context'

export const useOpenInEditor = () => {
  const { getNodes, getEdges, getViewport } = useReactFlow()
  const { editorOrigin, linkRef } = useEmbedHost()

  return useCallback(() => {
    const url = buildEditorUrl({ nodes: getNodes(), edges: getEdges(), viewport: getViewport() }, editorOrigin, linkRef)
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
  }, [getNodes, getEdges, getViewport, editorOrigin, linkRef])
}
