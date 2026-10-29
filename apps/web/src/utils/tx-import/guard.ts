import type { Node } from '@xyflow/react'
import type { FlowSnapshot } from '@/stores/flow-snapshot'
import { evaluateTxChain } from '@/utils/flow/evaluate-tx-chain'
import { handleDataField } from '@/utils/flow/resolve-inputs'
import { decodeFlowFromHash, encodeFlowToHash } from '@/utils/flow/share'
import { lastEdgeInto, publicKeyString } from '@/utils/flow/tx-draft'
import type { ComputeContext } from '@/utils/node/compute'
import { fromTransactionInstruction, type MessageInstruction } from '@/utils/solana/message-compiler'
import { IMPORT_NODE_IDS, instructionNodeId } from './generate-flow'

export interface FlowCheck {
  /** The chain rebuilds every original instruction and the fee payer. */
  ok: boolean
  /** Instructions whose node, on its own, builds something else (program id, metas with flags, or data). */
  mismatched: number[]
}

const bytesEqual = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((byte, i) => byte === b[i])

export const sameInstruction = (a: MessageInstruction, b: MessageInstruction) =>
  a.programId === b.programId &&
  a.metas.length === b.metas.length &&
  a.metas.every(
    (m, i) =>
      m.pubkey === b.metas[i].pubkey && m.isSigner === b.metas[i].isSigner && m.isWritable === b.metas[i].isWritable
  ) &&
  bytesEqual(a.data, b.data)

const feePayerOf = (flow: FlowSnapshot) => {
  const edge = lastEdgeInto(flow.edges, IMPORT_NODE_IDS.builder, ['feePayer'])
  const source: Node | undefined = edge && flow.nodes.find((n) => n.id === edge.source)
  const field = edge?.sourceHandle ? handleDataField(edge.sourceHandle, edge.source) : ''
  return publicKeyString((source?.data as Record<string, unknown> | undefined)?.[field])
}

/**
 * Rebuilds a generated flow the way Send does: after a round trip through the share-link encoding, with
 * evaluateTxChain. Compares each instruction and the fee payer with the original transaction; on a difference,
 * evaluates every instruction node on its own to tell which ones differ.
 */
export async function checkFlow(
  snapshot: FlowSnapshot,
  original: { instructions: MessageInstruction[]; feePayer: string },
  ctx: ComputeContext
): Promise<FlowCheck> {
  const all = original.instructions.map((_, i) => i)
  const flow = decodeFlowFromHash(encodeFlowToHash(snapshot))
  if (!flow) return { ok: false, mismatched: all }

  const tailId = lastEdgeInto(flow.edges, IMPORT_NODE_IDS.transaction, ['transaction'])?.source
  const [chain] = tailId ? await evaluateTxChain(flow, ctx, tailId) : []
  const built = (chain?.transaction?.instructions ?? []).map(fromTransactionInstruction)
  const matches =
    built.length === original.instructions.length &&
    built.every((ix, i) => sameInstruction(ix, original.instructions[i])) &&
    feePayerOf(flow) === original.feePayer
  if (matches) return { ok: true, mismatched: [] }

  const mismatched: number[] = []
  for (const [index, expected] of original.instructions.entries()) {
    const id = instructionNodeId(index)
    const alone = {
      nodes: flow.nodes,
      edges: flow.edges.filter(
        (e) => !(e.target === id && handleDataField(e.targetHandle ?? '', id) === 'transactionIn')
      ),
    }
    const [result] = await evaluateTxChain(alone, ctx, id)
    const instructions = result?.transaction?.instructions ?? []
    if (instructions.length !== 1 || !sameInstruction(fromTransactionInstruction(instructions[0]), expected)) {
      mismatched.push(index)
    }
  }
  return { ok: false, mismatched }
}
