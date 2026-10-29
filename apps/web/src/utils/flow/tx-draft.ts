import { PublicKey } from '@solana/web3.js'
import { NodeTypeEnum } from '@/types/node'
import type { TxDraftMeta } from '@/types/nodes/transactions/transaction-builder-node'
import { getNodeCompute } from '@/utils/node/compute'
import { handleDataField } from './resolve-inputs'

type ChainEdge = { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }

const DRAFT_KEYS = ['version', 'feePayer', 'lookupTables', 'hints', 'original'] as const

/** Whether TX_BUILDER data carries draft meta (set by the importer); a builder dropped from the menu has none. */
export const hasDraftMeta = (data: Record<string, unknown> | undefined): boolean =>
  !!data && DRAFT_KEYS.some((key) => data[key] !== undefined)

/** The draft meta of TX_BUILDER data, keeping only well-formed plain values. */
export function readDraftMeta(data: Record<string, unknown>): TxDraftMeta {
  const { version, feePayer, lookupTables, hints, original } = data as TxDraftMeta
  return {
    version: version === 0 ? 0 : 'legacy',
    feePayer: typeof feePayer === 'string' && feePayer ? feePayer : undefined,
    lookupTables: Array.isArray(lookupTables) ? lookupTables.filter((t) => typeof t === 'string') : [],
    hints: hints && typeof hints === 'object' ? hints : undefined,
    original: original && typeof original === 'object' ? original : undefined,
  }
}

/** A fee payer value from an edge (a public key string or object), or undefined when it is not a valid address. */
export function publicKeyString(value: unknown): string | undefined {
  try {
    if (value instanceof PublicKey) return value.toBase58()
    if (typeof value === 'string' && value.trim()) return new PublicKey(value.trim()).toBase58()
  } catch {
    // Not an address.
  }
  return undefined
}

export type TxChainHead = {
  /** The node feeding the TRANSACTION's transaction input. */
  tailId: string | null
  /** The TX_BUILDER the chain starts from, if the transaction edges reach one. */
  builderId: string | null
  /** The type of the first link between the builder and the TRANSACTION that is not a registry instruction node. */
  badLink: string | null
}

/** The edge that feeds one of `fields` of `target` (the last one wins, as in resolveInputs). */
export const lastEdgeInto = <E extends ChainEdge>(edges: readonly E[], target: string, fields: readonly string[]) => {
  for (let i = edges.length - 1; i >= 0; i--) {
    const e = edges[i]
    if (e.target === target && e.targetHandle && fields.includes(handleDataField(e.targetHandle, target))) return e
  }
  return undefined
}

/**
 * Walks the transaction edges back from a TRANSACTION node to the TX_BUILDER that starts its chain. The links in
 * between must be registry instruction nodes (they can be replayed headlessly); any other type is reported.
 */
export function findTxChainHead(
  transactionNodeId: string,
  edges: readonly ChainEdge[],
  typeOf: (id: string) => string | undefined
): TxChainHead {
  const tailId = lastEdgeInto(edges, transactionNodeId, ['transaction'])?.source ?? null
  let badLink: string | null = null
  let id = tailId
  const seen = new Set([transactionNodeId])
  while (id !== null && !seen.has(id)) {
    seen.add(id)
    const type = typeOf(id)
    if (type === NodeTypeEnum.TRANSACTION_BUILDER) return { tailId, builderId: id, badLink }
    if (!getNodeCompute(type)) badLink ??= type ?? 'unknown'
    id = lastEdgeInto(edges, id, ['transactionIn', 'transaction'])?.source ?? null
  }
  return { tailId, builderId: null, badLink }
}

/** The nodes `nodeId` depends on through any edges (itself included), and the edges between them. */
export function upstreamFlow<N extends { id: string }, E extends { source: string; target: string }>(
  nodeId: string,
  flow: { nodes: N[]; edges: E[] }
): { nodes: N[]; edges: E[] } {
  const ids = new Set([nodeId])
  const queue = [nodeId]
  while (queue.length > 0) {
    const id = queue.pop()!
    for (const e of flow.edges) {
      if (e.target === id && !ids.has(e.source)) {
        ids.add(e.source)
        queue.push(e.source)
      }
    }
  }
  return {
    nodes: flow.nodes.filter((n) => ids.has(n.id)),
    edges: flow.edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
  }
}
