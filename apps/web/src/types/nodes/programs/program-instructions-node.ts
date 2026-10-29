import type { Node } from '@xyflow/react'
import type { NodeTypeEnum } from '../../node'
import type { Transaction } from '@solana/web3.js'
import type { ProgramIdl } from '@/utils/idl/model/program-idl'
import type { RawAccountMeta } from './raw-instruction-node'

/** The meta an imported instruction passed at one position; `pubkey` is used when no edge or inline value gives one. */
export type InstructionMetaOverride = Omit<RawAccountMeta, 'pubkey'> & { pubkey?: string }

export type ProgramInstructionsNodeData = {
  idl?: ProgramIdl | null
  programId?: string
  transactionIn?: Transaction | null
  /** null when the instruction cannot be built (see `error`) or an upstream one failed. */
  transactionOut?: Transaction | null
  /** Source-IDL instruction name. */
  selectedInstruction?: string
  error?: string | null
  /** Values of unconnected inputs by field (`programId`, `account_<name>`, `arg_<name>`); an edge wins. */
  inline?: Record<string, string>
  /** Original metas of an imported instruction, by position: they fix which IDL accounts are passed and their flags. */
  metaOverrides?: InstructionMetaOverride[]
  /** Accounts passed after the IDL's accounts; a `remaining_<i>` edge replaces the pubkey of entry i. */
  remainingAccounts?: RawAccountMeta[]
  /** An ATA `create` sent with empty data (old @solana/spl-token). */
  legacyEmptyData?: boolean
  // Dynamic `account_<name>` and `arg_<name>` inputs (source-IDL names) are added at runtime
  [key: string]: unknown
}

export type ProgramInstructionsNodeType = Node<ProgramInstructionsNodeData, NodeTypeEnum.PROGRAM_INSTRUCTIONS>
