import { NodeTypeEnum } from '@/types/node'
import { computeAta } from './ata.compute'
import { computeIdl } from './idl.compute'
import { computeInstructions } from './instructions.compute'
import { computeNetwork } from './network.compute'
import { computeNumber } from './number.compute'
import { computePda } from './pda.compute'
import { computeProgramInstructions } from './program-instructions.compute'
import { computeRawInstruction } from './raw-instruction.compute'
import { computeText } from './text.compute'
import { computeTransactionBuilder } from './transaction-builder.compute'
import { computeWallet } from './wallet.compute'
import type { NodeCompute } from './types'

export type { ComputeContext, NodeCompute, NodeData, NodeInputs, NodeOutputs } from './types'
export { createComputeRunner } from './compute-runner'

/** Pure computes shared by the node components and the headless evaluator. Other node types are opaque value sources. */
export const nodeComputeRegistry = {
  [NodeTypeEnum.TRANSACTION_BUILDER]: computeTransactionBuilder,
  [NodeTypeEnum.INSTRUCTIONS]: computeInstructions,
  [NodeTypeEnum.PROGRAM_INSTRUCTIONS]: computeProgramInstructions,
  [NodeTypeEnum.RAW_INSTRUCTION]: computeRawInstruction,
  [NodeTypeEnum.IDL]: computeIdl,
  [NodeTypeEnum.TEXT]: computeText,
  [NodeTypeEnum.NUMBER]: computeNumber,
  [NodeTypeEnum.WALLET]: computeWallet,
  [NodeTypeEnum.NETWORK]: computeNetwork,
  [NodeTypeEnum.ATA]: computeAta,
  [NodeTypeEnum.PDA]: computePda,
} satisfies Partial<Record<NodeTypeEnum, NodeCompute>>

export const getNodeCompute = (type: string | undefined): NodeCompute | undefined =>
  type && Object.hasOwn(nodeComputeRegistry, type)
    ? nodeComputeRegistry[type as keyof typeof nodeComputeRegistry]
    : undefined
