import type { Network } from '@/types/network'
import type { IdlSource, ResolveResult } from '@/utils/idl/sources/resolve'

/** A node's own data; in the evaluator, its outputs merged over it (as updateNodeData does on the canvas). */
export type NodeData = Record<string, unknown>

/** Resolved input values by target field; unconnected fields are absent. */
export type NodeInputs = Record<string, unknown>

export type NodeOutputs = Record<string, unknown>

/** Finds a program's IDL on `network` (on chain, vendored, curated…), trying `prefer` first. */
export type ResolveIdl = (
  programId: string,
  options: { network: Network; prefer?: IdlSource }
) => Promise<ResolveResult>

export type ComputeContext = {
  signal?: AbortSignal
  /** The connected wallet, read by WALLET nodes. */
  walletPublicKey?: string | null
  /** IDL lookup for IDL nodes that load by program id; without it they only parse a pasted IDL. */
  resolveIdl?: ResolveIdl
  /** Remembers a pasted IDL for its program (editor only). */
  rememberIdl?: (programId: string, idlJson: string) => void
}

export type NodeCompute = (
  data: NodeData,
  inputs: NodeInputs,
  ctx: ComputeContext
) => NodeOutputs | Promise<NodeOutputs>
