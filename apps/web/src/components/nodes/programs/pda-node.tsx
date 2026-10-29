import { useEffect, useMemo } from 'react'
import { CustomNode } from '../../ui/custom-node'
import type { PdaNodeType } from '@/types/nodes/programs/pda-node'
import { NodeTypeEnum, type TargetFieldsForEnum } from '@/types/node'
import { useTypedNodesData } from '@/hooks/flow/use-typed-nodes-data'
import { useNodeCompute } from '@/hooks/flow/use-node-compute'
import type { NodeProps } from '@xyflow/react'
import { Position, useUpdateNodeInternals } from '@xyflow/react'
import type { HandleConfig } from '@/types/node-handle'

export const PdaNode = (props: NodeProps<PdaNodeType>) => {
  const updateNodeInternals = useUpdateNodeInternals()

  const resolved = useTypedNodesData<TargetFieldsForEnum<NodeTypeEnum.PDA>>(props.id)

  const seedCount = Object.keys(resolved).filter((k) => k.startsWith('seed#')).length

  const extraHandles: HandleConfig[] = useMemo(() => {
    const handles: HandleConfig[] = []
    for (let i = 1; i < seedCount + 1; i++) {
      handles.push({ position: Position.Left, type: 'target', dataField: `seed#${i}`, label: `Seed ${i + 1}` })
    }
    return handles
  }, [seedCount])

  useEffect(() => {
    updateNodeInternals(props.id)
  }, [extraHandles, props.id, updateNodeInternals])

  useNodeCompute(NodeTypeEnum.PDA, props.id, {}, resolved)

  return <CustomNode {...props} extraHandles={extraHandles} />
}
