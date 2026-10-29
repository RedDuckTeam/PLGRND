import type { Transaction } from '@solana/web3.js'
import type { Edge, Node } from '@xyflow/react'
import { NodeTypeEnum } from '@/types/node'
import { getNodeCompute, type ComputeContext, type NodeData } from '@/utils/node/compute'
import { inputValues, resolveInputs } from './resolve-inputs'

export type TxChainFlow = { nodes: Node[]; edges: Edge[] }

export type TxChainResult = { nodeId: string; transaction: Transaction }

const INSTRUCTION_TYPES = new Set<string>([
  NodeTypeEnum.INSTRUCTIONS,
  NodeTypeEnum.PROGRAM_INSTRUCTIONS,
  NodeTypeEnum.RAW_INSTRUCTION,
])

const inlineValues = (data: NodeData) =>
  typeof data.inline === 'object' && data.inline !== null ? (data.inline as Record<string, unknown>) : undefined

/**
 * Evaluates a flow snapshot through the compute registry and returns the transaction built by each chain tail
 * (an instruction node whose transactionOut feeds no other instruction node), in node order.
 * Nodes outside the registry contribute their persisted data; a node's `data.inline` fills its unconnected inputs.
 * With `tailId`, only the chain ending at that instruction node is evaluated (an empty result if it is not one).
 */
export async function evaluateTxChain(
  flow: TxChainFlow,
  ctx: ComputeContext = {},
  tailId?: string
): Promise<TxChainResult[]> {
  const nodes = new Map(flow.nodes.map((n) => [n.id, n]))
  const cache = new Map<string, Promise<NodeData>>()

  // `path` holds the nodes being evaluated above this one; an edge back into it reads persisted data (cycles).
  const evaluate = (id: string, path: ReadonlySet<string>): Promise<NodeData> => {
    let result = cache.get(id)
    if (!result) {
      result = compute(nodes.get(id)!, new Set(path).add(id))
      cache.set(id, result)
    }
    return result
  }

  const compute = async (node: Node, path: ReadonlySet<string>): Promise<NodeData> => {
    const data = (node.data ?? {}) as NodeData
    const nodeCompute = getNodeCompute(node.type)
    if (!nodeCompute) return data

    const connections = flow.edges.filter((e) => e.target === node.id)
    const sourceDataById = new Map<string, NodeData>()
    for (const { source } of connections) {
      const sourceNode = nodes.get(source)
      if (!sourceNode || sourceDataById.has(source)) continue
      sourceDataById.set(source, path.has(source) ? (sourceNode.data as NodeData) : await evaluate(source, path))
    }

    const inputs = inputValues(resolveInputs(connections, sourceDataById, inlineValues(data)))
    const outputs = await nodeCompute(data, inputs, ctx)
    return { ...data, ...outputs }
  }

  const feedsInstruction = (id: string) =>
    flow.edges.some((e) => e.source === id && INSTRUCTION_TYPES.has(nodes.get(e.target)?.type ?? ''))
  const tails = flow.nodes.filter(
    (n) => INSTRUCTION_TYPES.has(n.type ?? '') && (tailId === undefined ? !feedsInstruction(n.id) : n.id === tailId)
  )

  const results: TxChainResult[] = []
  for (const tail of tails) {
    const { transactionOut } = await evaluate(tail.id, new Set())
    results.push({ nodeId: tail.id, transaction: transactionOut as Transaction })
  }
  return results
}
