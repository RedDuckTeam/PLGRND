import type { Edge, Node } from '@xyflow/react'
import { FLOW_V3_SHAPE } from '@/constants/flow-v3-shape'
import { matchesKeyPattern } from '@/stores/flow-snapshot'
import { detectIdlFormat } from '@/utils/idl/format'
import { handleDataField } from './resolve-inputs'

// Keys a version-3 widget ignores without changing what it builds; they never force version 4 on their own.
const IGNORABLE_KEYS = new Set(['autoLoad'])

const isLegacyIdlJson = (idlJson: string) => {
  try {
    return detectIdlFormat(JSON.parse(idlJson)) === 'anchor-legacy'
  } catch {
    // Unparseable JSON is shown as an error by every version alike.
    return true
  }
}

/**
 * Whether a (sanitized) flow uses anything a version-3 reader — such as a pinned @plgrnd/embed 1.0.x — does not
 * understand: an unknown node type, data key or handle, or a non-legacy IDL. Such flows are written as version 4,
 * which older widgets report as "made with a newer PLGRND" instead of rendering them wrongly.
 */
export function requiresV4(flow: { nodes: Node[]; edges: Edge[] }): boolean {
  const types = new Map(flow.nodes.map((n) => [n.id, n.type ?? '']))
  for (const node of flow.nodes) {
    const shape = FLOW_V3_SHAPE[node.type ?? '']
    if (!shape) return true
    const data = (node.data ?? {}) as Record<string, unknown>
    for (const key of Object.keys(data)) {
      if (!IGNORABLE_KEYS.has(key) && !matchesKeyPattern(shape.data, key)) return true
    }
    if (
      node.type === 'IDL' &&
      typeof data.idlJson === 'string' &&
      data.idlJson.trim() &&
      !isLegacyIdlJson(data.idlJson)
    ) {
      return true
    }
  }
  for (const edge of flow.edges) {
    for (const [nodeId, handle] of [
      [edge.source, edge.sourceHandle],
      [edge.target, edge.targetHandle],
    ] as const) {
      const shape = FLOW_V3_SHAPE[types.get(nodeId) ?? '']
      if (!shape || !handle || !matchesKeyPattern(shape.handles, handleDataField(handle, nodeId))) return true
    }
  }
  return false
}
