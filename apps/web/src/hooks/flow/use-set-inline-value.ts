import { useCallback } from 'react'
import { useTypedReactFlow } from './use-typed-react-flow'

/** Sets one field of the node's `data.inline` (an empty value removes it); an edge into the field still wins. */
export const useSetInlineValue = (id: string) => {
  const { updateNodeData } = useTypedReactFlow()
  return useCallback(
    (field: string, value: string) =>
      updateNodeData(id, (node) => {
        const inline = { ...(node.data.inline as Record<string, string> | undefined) }
        if (value) inline[field] = value
        else delete inline[field]
        return { inline: Object.keys(inline).length > 0 ? inline : undefined }
      }),
    [id, updateNodeData]
  )
}
