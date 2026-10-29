import { useMemo } from 'react'
import { useNodeConnections, useNodesData, type Node } from '@xyflow/react'
import type { NodeTypeEnum, TargetFieldsForEnum } from '@/types/node'
import { resolveInputs } from '@/utils/flow/resolve-inputs'

export function useTypedNodesData<T extends TargetFieldsForEnum<NodeTypeEnum>>(
  id: string,
  inline?: Partial<Record<T, unknown>>
) {
  const connections = useNodeConnections({ handleType: 'target', id })

  const sourceIds = useMemo(() => {
    return (connections ?? []).map((c) => c.source).filter((id): id is string => Boolean(id))
  }, [connections])

  const nodes = useNodesData<Node>(sourceIds)

  const dataById = useMemo(() => {
    const map = new Map<string, Node['data']>()
    for (const n of nodes) map.set(n.id, n.data)
    return map
  }, [nodes])

  return useMemo(() => resolveInputs<T>(connections, dataById, inline), [connections, dataById, inline])
}
