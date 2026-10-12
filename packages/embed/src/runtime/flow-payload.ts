import LZString from 'lz-string'
import type { Edge, Node, Viewport } from '@xyflow/react'
import { FLOW_STORAGE_VERSION, sanitizeNodes, type FlowSnapshot } from '@/stores/flow-snapshot'
import { nodeMap } from '@/utils/node/node-map'

export type FlowPayload =
  | { kind: 'ok'; snapshot: FlowSnapshot }
  | { kind: 'missing' }
  | { kind: 'invalid' }
  /** Written by a newer PLGRND (payload version or node types this widget does not know; G0-9). */
  | { kind: 'newer' }

interface SerializedFlow {
  v?: unknown
  nodes?: unknown
  edges?: unknown
  viewport?: unknown
}

/** Reads the `flow` attribute without throwing; unlike decodeFlowFromHash it says why a payload is unusable. */
export function inspectFlowPayload(encoded: string | undefined): FlowPayload {
  if (!encoded) return { kind: 'missing' }
  let parsed: SerializedFlow
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded)
    if (!json) return { kind: 'invalid' }
    parsed = JSON.parse(json) as SerializedFlow
  } catch {
    return { kind: 'invalid' }
  }
  if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return { kind: 'invalid' }
  if (typeof parsed.v === 'number' && parsed.v > FLOW_STORAGE_VERSION) return { kind: 'newer' }

  const nodes = parsed.nodes as Node[]
  const known = (type: unknown) => typeof type === 'string' && type in nodeMap
  if (!nodes.every((node) => known(node?.type))) return { kind: 'newer' }

  return {
    kind: 'ok',
    snapshot: { nodes: sanitizeNodes(nodes), edges: parsed.edges as Edge[], viewport: parsed.viewport as Viewport },
  }
}
