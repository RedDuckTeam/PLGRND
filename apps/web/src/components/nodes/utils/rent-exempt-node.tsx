import { useEffect, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useQuery } from '@tanstack/react-query'
import { CustomNode } from '../../ui/custom-node'
import { useTypedNodesData } from '@/hooks/flow/use-typed-nodes-data'
import { useTypedReactFlow } from '@/hooks/flow/use-typed-react-flow'
import type { NodeTypeEnum, TargetFieldsForEnum } from '@/types/node'
import type { RentExemptNodeData, RentExemptNodeType } from '@/types/nodes/utils/rent-exempt-node'
import type { Network } from '@/types/network'
import { getSolanaConnection } from '@/constants/solana/connection'
import { useRpcConfig } from '@/providers/rpc-urls-context'
import { toFiniteNumber } from '@/utils/node/logic/logic-node.utils'
import { UtilsLabelValue, UtilsNodeContent } from './utils-node-content'

export const RentExemptNode = (props: NodeProps<RentExemptNodeType>) => {
  const { updateNodeData } = useTypedReactFlow()
  const { urls } = useRpcConfig()
  const resolved = useTypedNodesData<TargetFieldsForEnum<NodeTypeEnum.RENT_EXEMPT>>(props.id)

  const space = useMemo(() => {
    const value = toFiniteNumber(resolved.space?.value)
    if (value === undefined || value < 0) return undefined
    return Math.floor(value)
  }, [resolved.space?.value])

  const network = useMemo(() => resolved.network?.value as Network | undefined, [resolved.network?.value])

  const { data: lamports } = useQuery({
    queryKey: ['rentExempt', network, space],
    queryFn: async () => {
      if (!network || space === undefined) return undefined
      return getSolanaConnection(network, urls).getMinimumBalanceForRentExemption(space)
    },
    enabled: Boolean(network) && space !== undefined,
  })

  const sol = lamports === undefined ? undefined : lamports / LAMPORTS_PER_SOL

  useEffect(() => {
    updateNodeData<RentExemptNodeData>(props.id, { lamports, sol })
  }, [lamports, props.id, sol, updateNodeData])

  return (
    <CustomNode {...props}>
      <UtilsNodeContent>
        <UtilsLabelValue label="lamports" value={lamports?.toString()} />
        <UtilsLabelValue label="sol" value={sol?.toString()} />
      </UtilsNodeContent>
    </CustomNode>
  )
}
