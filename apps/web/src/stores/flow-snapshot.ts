import type { Node, Edge, Viewport } from '@xyflow/react'

export const FLOW_STORAGE_KEY = 'sol-learn:flow'
export const FLOW_STORAGE_VERSION = 3

export interface FlowSnapshot {
  nodes: Node[]
  edges: Edge[]
  viewport?: Viewport
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

const looksLikeSerializedTransaction = (value: Record<string, unknown>): boolean =>
  Array.isArray(value.instructions) && Array.isArray(value.signatures)

const looksLikeSerializedBuffer = (value: Record<string, unknown>): boolean =>
  value.type === 'Buffer' && Array.isArray(value.data)

const sanitizeForPersist = (value: unknown): unknown => {
  if (value === null || value === undefined) return value
  const t = typeof value
  if (t === 'string' || t === 'number' || t === 'boolean') return value
  if (Array.isArray(value)) {
    const out: unknown[] = []
    for (const item of value) {
      const cleaned = sanitizeForPersist(item)
      if (cleaned !== undefined) out.push(cleaned)
    }
    return out
  }
  if (isPlainObject(value)) {
    // Drop plain objects that are residue from previously-serialized class instances
    // (Transaction, Buffer, etc). Their methods are gone and they crash any consumer
    // that expects the real type.
    if (looksLikeSerializedTransaction(value)) return undefined
    if (looksLikeSerializedBuffer(value)) return undefined
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      const cleaned = sanitizeForPersist(v)
      if (cleaned !== undefined) out[k] = cleaned
    }
    return out
  }
  // Class instances (Transaction, PublicKey, Buffer, Keypair, BN, ...) get dropped.
  // Derived fields are recomputed by the corresponding node hooks on rehydration.
  return undefined
}

export const sanitizeNodes = (nodes: Node[]): Node[] =>
  nodes.map((node) => ({
    ...node,
    data: (sanitizeForPersist(node.data) as Node['data']) ?? {},
  }))
