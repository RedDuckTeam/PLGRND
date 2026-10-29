import type { Node } from '@xyflow/react'
import type { Transaction } from '@solana/web3.js'
import type { NodeTypeEnum } from '../../node'

export type RawAccountMeta = {
  pubkey: string
  isSigner: boolean
  isWritable: boolean
}

/** What a decode recognized when its result could not be used (shown read-only). */
export type RawInstructionAnnotations = {
  instruction?: string
  /** Account labels by position. */
  accounts?: string[]
  /** Decoded arguments as inline strings. */
  args?: Record<string, string>
  /** Why the instruction stays raw. */
  reason?: string
}

export type RawInstructionNodeData = {
  programId?: string
  /** Ordered account metas; the `account_<i>` handle overrides the pubkey of position i. */
  accounts?: RawAccountMeta[]
  dataHex?: string
  annotations?: RawInstructionAnnotations
  /** null when the instruction cannot be built (see `error`) or an upstream one failed. */
  transactionOut?: Transaction | null
  error?: string | null
}

export type RawInstructionNodeType = Node<RawInstructionNodeData, NodeTypeEnum.RAW_INSTRUCTION>
