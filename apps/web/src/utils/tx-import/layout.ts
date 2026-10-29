import type { Edge, Node } from '@xyflow/react'
import { NodeTypeEnum, type NodeType } from '@/types/node'
import type { NodeConfig } from '@/types/node-config'
import { handleDataField } from '@/utils/flow/resolve-inputs'
import { getNodeConfig } from '@/utils/node/node-config-registry'
import { getNodeStyles } from '@/utils/node/node-style.utils'

export interface Box {
  id: string
  x: number
  y: number
  width: number
  height: number
}

const COLUMN_GAP = 100
const ROW_GAP = 40
// CustomNode makes a node at least 16 px tall per handle row; inline fields sit inside those rows.
const HANDLE_ROW = 16
// Padding and the label tab.
const CHROME = 40
// Content beside or below the handle rows (inputs, selects, status), rounded up.
const BODY: Partial<Record<NodeType, number>> = {
  [NodeTypeEnum.TEXT]: 40,
  [NodeTypeEnum.NUMBER]: 32,
  [NodeTypeEnum.NETWORK]: 40,
  [NodeTypeEnum.ATA]: 56,
  [NodeTypeEnum.PDA]: 24,
  // Program, program ID, network and the IDL textarea, plus a status or error line.
  [NodeTypeEnum.IDL]: 300,
  [NodeTypeEnum.TRANSACTION_BUILDER]: 32,
  [NodeTypeEnum.PROGRAM_INSTRUCTIONS]: 96,
  [NodeTypeEnum.RAW_INSTRUCTION]: 140,
  [NodeTypeEnum.TRANSACTION]: 180,
  [NodeTypeEnum.TX_TRACE]: 420,
}
const SIGNER_BUTTON = 24
const ANNOTATION_ROW = 12

const VALUE_TYPES = new Set<string>([NodeTypeEnum.TEXT, NodeTypeEnum.NUMBER, NodeTypeEnum.ATA, NodeTypeEnum.PDA])
const CHAIN_TYPES = new Set<string>([
  NodeTypeEnum.TRANSACTION_BUILDER,
  NodeTypeEnum.PROGRAM_INSTRUCTIONS,
  NodeTypeEnum.RAW_INSTRUCTION,
])

const length = (value: unknown) => (Array.isArray(value) ? value.length : 0)

/** Handle rows on the left and right: the type's handles plus the ones a generated node adds at runtime. */
function handleRows(node: Node, targetFields: ReadonlySet<string>): number {
  const config = getNodeConfig(node.type as NodeType) as NodeConfig
  const count = (position: string) => config.handles.filter((h) => h.position === position).length
  let left = count('left')
  const right = count('right') + (config.actions ?? []).filter((a) => a.position === 'right').length
  const data = node.data as Record<string, unknown>
  switch (node.type) {
    case NodeTypeEnum.PROGRAM_INSTRUCTIONS: {
      const args = new Set([...Object.keys((data.inline as Record<string, string> | undefined) ?? {}), ...targetFields])
      left += length(data.metaOverrides) + length(data.remainingAccounts)
      left += [...args].filter((field) => field.startsWith('arg_')).length
      break
    }
    case NodeTypeEnum.RAW_INSTRUCTION:
      left += length(data.accounts)
      break
    case NodeTypeEnum.PDA:
      // One more seed slot than connected seeds.
      left += [...targetFields].filter((field) => field.startsWith('seed#')).length
      break
  }
  left += (config.actions ?? []).filter((a) => a.position === 'left').length
  return Math.max(left, right)
}

/** Estimated canvas size of a generated node: its handle rows or its content, whichever is taller. */
function nodeSize(node: Node, targetFields: ReadonlySet<string> = new Set()) {
  const style = getNodeStyles(node.type as NodeType)
  const data = node.data as Record<string, unknown>
  let body = BODY[node.type as NodeType] ?? 40
  if (node.type === NodeTypeEnum.TEXT && data.signer) body += SIGNER_BUTTON
  if (node.type === NodeTypeEnum.RAW_INSTRUCTION && data.annotations) {
    const annotations = data.annotations as { args?: Record<string, string> }
    body += ANNOTATION_ROW * (2 + Object.keys(annotations.args ?? {}).length)
  }
  const rows = handleRows(node, targetFields)
  return {
    width: style.width ?? 200,
    height: Math.max(rows * HANDLE_ROW, style.height ?? 0, body) + CHROME,
  }
}

/** Every node's box under the height model. */
export function nodeBoxes(nodes: Node[], edges: Edge[]): Box[] {
  const fields = new Map<string, Set<string>>()
  for (const edge of edges) {
    if (!edge.targetHandle) continue
    const set = fields.get(edge.target) ?? new Set<string>()
    set.add(handleDataField(edge.targetHandle, edge.target))
    fields.set(edge.target, set)
  }
  return nodes.map((node) => ({ id: node.id, ...node.position, ...nodeSize(node, fields.get(node.id)) }))
}

/**
 * Deterministic grid, left to right: value nodes in columns by how many value nodes feed them, IDL nodes, the
 * chain (TX BUILDER, then the instructions in order), NETWORK + TRANSACTION, and TX TRACE under everything.
 * Nodes keep their order within a column, stacked with a gap, so no two boxes overlap.
 */
export function layoutFlow(nodes: Node[], edges: Edge[]): Node[] {
  const sizes = new Map(nodeBoxes(nodes, edges).map((box) => [box.id, box]))
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const sources = (id: string) => edges.filter((e) => e.target === id).map((e) => e.source)

  const depths = new Map<string, number>()
  const valueDepth = (id: string, seen = new Set<string>()): number => {
    const known = depths.get(id)
    if (known !== undefined) return known
    seen.add(id)
    const inputs = sources(id).filter((s) => VALUE_TYPES.has(byId.get(s)?.type ?? '') && !seen.has(s))
    const depth = inputs.length === 0 ? 0 : 1 + Math.max(...inputs.map((s) => valueDepth(s, seen)))
    depths.set(id, depth)
    return depth
  }
  const values = nodes.filter((n) => VALUE_TYPES.has(n.type ?? ''))
  const deepest = Math.max(0, ...values.map((n) => valueDepth(n.id)))

  const column = (node: Node): number => {
    if (VALUE_TYPES.has(node.type ?? '')) return valueDepth(node.id)
    if (node.type === NodeTypeEnum.IDL) return deepest + 1
    if (CHAIN_TYPES.has(node.type ?? '')) return deepest + 2
    if (node.type === NodeTypeEnum.TX_TRACE) return -1
    return deepest + 3
  }
  const columns = new Map<number, Node[]>()
  for (const node of nodes) {
    const c = column(node)
    columns.set(c, [...(columns.get(c) ?? []), node])
  }

  const positions = new Map<string, { x: number; y: number }>()
  let x = 0
  let chainX = 0
  let lastChainY = 0
  for (let c = 0; c <= deepest + 3; c++) {
    const members = columns.get(c) ?? []
    if (members.length === 0) continue
    // The NETWORK + TRANSACTION column starts next to the end of the chain.
    let y = c === deepest + 3 ? Math.max(0, lastChainY - (sizes.get(members[0].id)!.height + ROW_GAP)) : 0
    for (const node of members) {
      positions.set(node.id, { x, y })
      if (c === deepest + 2) lastChainY = y
      y += sizes.get(node.id)!.height + ROW_GAP
    }
    if (c === deepest + 2) chainX = x
    x += Math.max(...members.map((n) => sizes.get(n.id)!.width)) + COLUMN_GAP
  }
  let bottom = 0
  for (const [id, position] of positions) bottom = Math.max(bottom, position.y + sizes.get(id)!.height)
  let y = bottom + ROW_GAP * 2
  for (const node of columns.get(-1) ?? []) {
    positions.set(node.id, { x: chainX, y })
    y += sizes.get(node.id)!.height + ROW_GAP
  }

  return nodes.map((node) => ({ ...node, position: positions.get(node.id)! }))
}
