import type { Node } from '@xyflow/react'
import type { NodeTypeEnum } from '../../node'
import type { Transaction } from '@solana/web3.js'
import type { MessageHints, MessageVersion } from '@/utils/solana/message-compiler'

/** What an imported transaction looked like, so Send can tell whether the flow still builds it unchanged. */
export type TxDraftOriginal = {
  /** Hex sha256 of the original message bytes. */
  messageHash: string
  blockhash: string
  /** Durable-nonce transactions (instruction 0 is AdvanceNonceAccount). */
  nonce?: { account: string; authority: string }
  /** Signatures by signer (base58); only for serialized inputs that have not landed. */
  signatures?: Record<string, string>
}

/**
 * Draft meta (plain JSON): with any of it, TRANSACTION compiles the chain itself (v0, lookup tables, original key
 * order) instead of sending the legacy Transaction. A builder dropped from the menu has none.
 */
export type TxDraftMeta = {
  version?: MessageVersion
  /** Inline fee payer; an edge into the `feePayer` handle beats it. */
  feePayer?: string
  lookupTables?: string[]
  hints?: MessageHints
  original?: TxDraftOriginal
}

export type TransactionBuilderNodeData = TxDraftMeta & {
  transaction: Transaction | null
}

export type TransactionBuilderNodeType = Node<TransactionBuilderNodeData, NodeTypeEnum.TRANSACTION_BUILDER>
