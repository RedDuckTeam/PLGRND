import { useEffect, useMemo, useState } from 'react'
import { CustomNode } from '../../ui/custom-node'
import type {
  InstructionKind,
  InstructionsNodeData,
  InstructionsNodeType,
} from '@/types/nodes/programs/instructions-node'
import { useTypedNodesData } from '@/hooks/flow/use-typed-nodes-data'
import { NodeTypeEnum, type ActionsFor } from '@/types/node'
import { useTypedReactFlow } from '@/hooks/flow/use-typed-react-flow'
import { useNodeActions } from '@/hooks/flow/use-node-actions'
import { useNodeCompute } from '@/hooks/flow/use-node-compute'
import type { NodeProps } from '@xyflow/react'
import { Position, useUpdateNodeInternals } from '@xyflow/react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getInstructionById } from '@/constants/solana/instructions-config'

export const InstructionsNode = (props: NodeProps<InstructionsNodeType>) => {
  const { updateNodeData } = useTypedReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()

  const resolved = useTypedNodesData<'transactionIn'>(props.id)

  const [selected, setSelected] = useState<InstructionKind>(props.data.instruction ?? 'systemTransfer')

  const extraHandles = useMemo(() => {
    const def = getInstructionById(selected)
    const handles: {
      position: Position
      type: 'target' | 'source'
      dataField: string
      label: string
      dataType?: string
    }[] = []
    if (!def) return handles
    for (const f of def.fields) {
      handles.push({ position: Position.Left, type: 'target', dataField: f.key, label: f.label, dataType: f.type })
    }
    return handles
  }, [selected])

  useEffect(() => {
    updateNodeInternals(props.id)
  }, [extraHandles, props.id, updateNodeInternals])

  useEffect(() => {
    updateNodeData<InstructionsNodeData>(props.id, { instruction: selected })
  }, [props.id, selected, updateNodeData])

  useNodeCompute(NodeTypeEnum.INSTRUCTIONS, props.id, { instruction: selected }, resolved)

  const actions = useNodeActions<ActionsFor<NodeTypeEnum.INSTRUCTIONS>>(props.type, {})

  return (
    <CustomNode {...props} actions={actions} extraHandles={extraHandles}>
      <div className="mt-2 px-10">
        <Select value={selected} onValueChange={(v) => setSelected(v as InstructionKind)}>
          <SelectTrigger>
            <SelectValue placeholder="Select instruction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="systemTransfer">System transfer</SelectItem>
            <SelectItem value="computeUnitLimit">Compute unit limit</SelectItem>
            <SelectItem value="computeUnitPrice">Compute unit price</SelectItem>
            <SelectItem value="splTransfer">SPL transfer</SelectItem>
            <SelectItem value="splCreateAta">SPL create ATA</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </CustomNode>
  )
}
