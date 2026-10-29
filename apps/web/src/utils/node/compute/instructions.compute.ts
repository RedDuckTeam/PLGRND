import { Transaction } from '@solana/web3.js'
import { getInstructionById } from '@/constants/solana/instructions-config'
import type { InstructionKind, InstructionsNodeData } from '@/types/nodes/programs/instructions-node'
import type { NodeData, NodeInputs } from './types'

export const computeInstructions = async (data: NodeData, inputs: NodeInputs): Promise<InstructionsNodeData> => {
  // An upstream instruction failed: keep the chain unsendable instead of dropping its instruction.
  if (inputs.transactionIn === null) return { transactionOut: null }
  const base = (inputs.transactionIn as Transaction | null | undefined) ?? new Transaction()
  const ixs = [...base.instructions]
  const def = getInstructionById((data.instruction as InstructionKind | undefined) ?? 'systemTransfer')
  if (def) {
    const fields: Record<string, unknown> = {}
    for (const f of def.fields) {
      fields[f.key] = inputs[f.key]
    }
    const built = await def.build(base, fields)
    ixs.push(...built)
  }
  const transactionOut = new Transaction()
  if (ixs.length > 0) transactionOut.add(...ixs)
  return { transactionOut }
}
