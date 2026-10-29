import type { NodeTypeEnum } from '@/types/node'
import type { Node } from '@xyflow/react'
import type { Network } from '@/types/network'
import type { TxTrace } from '@/utils/tx-import/trace'

export type TxTraceNodeData = {
  /** Inline sources while their handles are unconnected; a signature wins over a serialized transaction. */
  signature?: string
  /** Inline network (default MAINNET). */
  network?: Network
  /** A serialized transaction (base64 or base58), simulated instead of fetched. */
  serialized?: string
  /** Runtime only: the trace of the current source. */
  trace?: TxTrace | null
  /** Runtime only: why the trace could not be loaded. */
  error?: string
  /** Runtime only. */
  status?: 'loading' | 'loaded' | 'error'
}

export type TxTraceNodeType = Node<TxTraceNodeData, NodeTypeEnum.TX_TRACE>
