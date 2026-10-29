import { useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { CustomNode } from '../../ui/custom-node'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTypedNodesData } from '@/hooks/flow/use-typed-nodes-data'
import { useNodeCompute } from '@/hooks/flow/use-node-compute'
import { NodeTypeEnum, type TargetFieldsForEnum } from '@/types/node'
import type { AtaNodeType, AtaTokenProgram } from '@/types/nodes/utils/ata-node'
import { getNodeStyles } from '@/utils/node/node-style.utils'
import { UtilsNodeContent, UtilsTextPreview } from './utils-node-content'

const TOKEN_PROGRAMS: { value: AtaTokenProgram; label: string }[] = [
  { value: 'token', label: 'Token' },
  { value: 'token-2022', label: 'Token-2022' },
]

export const AtaNode = (props: NodeProps<AtaNodeType>) => {
  const [tokenProgram, setTokenProgram] = useState<AtaTokenProgram>(props.data.tokenProgram ?? 'token')
  const resolved = useTypedNodesData<TargetFieldsForEnum<NodeTypeEnum.ATA>>(props.id)
  const nodeStyles = getNodeStyles(props.type)

  useNodeCompute(NodeTypeEnum.ATA, props.id, { tokenProgram }, resolved)

  return (
    <CustomNode {...props}>
      <UtilsNodeContent>
        <Select value={tokenProgram} onValueChange={(value) => setTokenProgram(value as AtaTokenProgram)}>
          <SelectTrigger color={nodeStyles.color} className="h-5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TOKEN_PROGRAMS.map((program) => (
              <SelectItem key={program.value} value={program.value}>
                {program.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <UtilsTextPreview value={props.data.ata ?? ''} />
      </UtilsNodeContent>
    </CustomNode>
  )
}
