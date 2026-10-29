import type { PdaNodeData } from '@/types/nodes/programs/pda-node'
import { getPda } from '@/utils/solana/pda.utils'
import type { NodeData, NodeInputs } from './types'

export const computePda = (_data: NodeData, inputs: NodeInputs): PdaNodeData => {
  const seeds = Object.entries(inputs)
    .filter(([k]) => k.startsWith('seed#'))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => v)
  return getPda(String(inputs.programId ?? ''), seeds)
}
