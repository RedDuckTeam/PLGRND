import type { Node } from '@xyflow/react'
import type { NodeTypeEnum } from '../../node'
import type { Network } from '@/types/network'
import type { IdlFormat } from '@/utils/idl/format'
import type { ProgramIdl } from '@/utils/idl/model/program-idl'
import type { IdlSource } from '@/utils/idl/sources/resolve'

/** Where a loaded IDL came from; persisted instead of the IDL itself and used to reload it. */
export type IdlRef = {
  programId: string
  network: Network
  source: IdlSource
  format: IdlFormat
  contentHash: string
}

/** What the node shows about the IDL in use (runtime only). */
export type IdlNodeStatus = {
  /** `paste`, or `load:<network>:<programId>`: what this status was computed for. */
  key: string
  /** `source · format` */
  badge?: string
  warnings?: string[]
  error?: string
  /** Why each IDL source failed, when none had the IDL. */
  failures?: string[]
  /** The reference of the loaded IDL when it differs from the saved one. */
  loaded?: IdlRef
}

export type IdlNodeData = {
  /** A pasted IDL in any format (legacy Anchor, Anchor >= 0.30, Codama, Shank). */
  idlJson?: string
  /** The normalized IDL (runtime only). Old snapshots may hold a legacy IDL object here, which consumers ignore. */
  idl?: ProgramIdl | null
  programId?: string
  /** Inline network while the Network handle is unconnected (default MAINNET). */
  network?: Network
  /** Load the IDL by program id. Set on new nodes; nodes from older flows load only after "Load from chain". */
  autoLoad?: boolean
  ref?: IdlRef
  status?: IdlNodeStatus
}

export type IdlNodeType = Node<IdlNodeData, NodeTypeEnum.IDL>
