import { useEffect, useMemo, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import { CustomNode } from '../../ui/custom-node'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTypedNodesData } from '@/hooks/flow/use-typed-nodes-data'
import { useTypedReactFlow } from '@/hooks/flow/use-typed-react-flow'
import type { NodeTypeEnum, TargetFieldsForEnum } from '@/types/node'
import type { AtaNodeData, AtaNodeType, AtaTokenProgram } from '@/types/nodes/utils/ata-node'
import { getNodeStyles } from '@/utils/node/node-style.utils'
import { toText } from '@/utils/string/string-node.utils'
import { UtilsNodeContent, UtilsTextPreview } from './utils-node-content'

const TOKEN_PROGRAMS: { value: AtaTokenProgram; label: string; programId: PublicKey }[] = [
  { value: 'token', label: 'Token', programId: TOKEN_PROGRAM_ID },
  { value: 'token-2022', label: 'Token-2022', programId: TOKEN_2022_PROGRAM_ID },
]

export const AtaNode = (props: NodeProps<AtaNodeType>) => {
  const [tokenProgram, setTokenProgram] = useState<AtaTokenProgram>(props.data.tokenProgram ?? 'token')
  const { updateNodeData } = useTypedReactFlow()
  const resolved = useTypedNodesData<TargetFieldsForEnum<NodeTypeEnum.ATA>>(props.id)
  const nodeStyles = getNodeStyles(props.type)

  const owner = useMemo(() => toText(resolved.owner?.value).trim(), [resolved.owner?.value])
  const mint = useMemo(() => toText(resolved.mint?.value).trim(), [resolved.mint?.value])

  const ata = useMemo(() => {
    try {
      if (!owner || !mint) return ''
      const programId = TOKEN_PROGRAMS.find((p) => p.value === tokenProgram)?.programId ?? TOKEN_PROGRAM_ID
      return getAssociatedTokenAddressSync(new PublicKey(mint), new PublicKey(owner), true, programId).toBase58()
    } catch {
      return ''
    }
  }, [mint, owner, tokenProgram])

  useEffect(() => {
    updateNodeData<AtaNodeData>(props.id, { ata, tokenProgram })
  }, [ata, props.id, tokenProgram, updateNodeData])

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
        <UtilsTextPreview value={ata} />
      </UtilsNodeContent>
    </CustomNode>
  )
}
