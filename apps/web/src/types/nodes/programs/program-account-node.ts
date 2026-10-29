import type { Node } from '@xyflow/react'
import type { NodeTypeEnum } from '../../node'
import type { Network } from '@/types/network'
import type { ProgramIdl } from '@/utils/idl/model/program-idl'

export type ProgramAccountNodeData = {
  idl?: ProgramIdl | null
  programId?: string
  network?: Network | null
  address?: string
  /** Source-IDL account name. */
  selectedAccount?: string
  decoded?: Record<string, unknown> | null
  error?: string | null
  // Decoded fields are flattened onto data as `field_<source name>` so source handles can read them
  [key: string]: unknown
}

export type ProgramAccountNodeType = Node<ProgramAccountNodeData, NodeTypeEnum.PROGRAM_ACCOUNT>
