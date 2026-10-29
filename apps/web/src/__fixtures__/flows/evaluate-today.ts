// Evaluates a flow's transaction chain with the instruction builders as they were before the IDL rework
// (getInstructionById, buildProgramInstruction, getPda), mirroring each node component's effect.
// It only exists to capture and guard the frozen baseline in baseline.ts.
import { Buffer } from 'buffer'
import { Transaction } from '@solana/web3.js'
import type { Edge, Node } from '@xyflow/react'
import { getInstructionById } from '@/constants/solana/instructions-config'
import { buildProgramInstruction } from './legacy/program-instruction-builder'
import { getPda } from '@/utils/solana/pda.utils'
import type { Idl } from './legacy/idl-types'
import type { BaselineInstruction } from './baseline-types'

type Outputs = Record<string, unknown>

const handleField = (handleId: string, nodeId: string) => handleId.slice(nodeId.length + 1).split('-')[0]

export const serializeInstructions = (tx: Transaction): BaselineInstruction[] =>
  tx.instructions.map((ix) => ({
    programId: ix.programId.toBase58(),
    keys: ix.keys.map((k) => ({ pubkey: k.pubkey.toBase58(), isSigner: k.isSigner, isWritable: k.isWritable })),
    data: Buffer.from(ix.data).toString('hex'),
  }))

export async function evaluateTodayChain(
  flow: { nodes: Node[]; edges: Edge[] },
  wallet: string
): Promise<BaselineInstruction[][]> {
  const nodes = new Map(flow.nodes.map((n) => [n.id, n]))
  const cache = new Map<string, Promise<Outputs>>()

  const inputsOf = async (id: string) => {
    const inputs: Record<string, unknown> = {}
    // Like useNodeConnections: edges in order, a later edge to the same handle wins.
    for (const edge of flow.edges.filter((e) => e.target === id)) {
      const field = handleField(edge.targetHandle!, id)
      const source = await evaluate(edge.source)
      inputs[field] = source[handleField(edge.sourceHandle!, edge.source)]
    }
    return inputs
  }

  const compute = async (node: Node): Promise<Outputs> => {
    const data = node.data as Record<string, unknown>
    const inputs = await inputsOf(node.id)
    switch (node.type) {
      case 'TEXT':
        return { text: data.text }
      case 'NUMBER':
        return { number: data.number }
      case 'WALLET':
        return { publicKey: wallet, wallet: { kind: 'wallet', publicKey: wallet } }
      case 'NETWORK':
        return { network: data.network }
      case 'TRANSACTION_BUILDER':
        return { transaction: new Transaction() }
      case 'INSTRUCTIONS': {
        const base = (inputs.transactionIn as Transaction | null) ?? new Transaction()
        const def = getInstructionById((data.instruction as string) ?? 'systemTransfer')!
        const fields: Record<string, unknown> = {}
        for (const f of def.fields) fields[f.key] = inputs[f.key]
        const out = new Transaction()
        const ixs = [...base.instructions, ...(await def.build(base, fields))]
        if (ixs.length > 0) out.add(...ixs)
        return { transactionOut: out }
      }
      case 'IDL': {
        const idl = JSON.parse(data.idlJson as string) as Idl
        const programId = (data.programId as string) || idl.metadata?.address || ''
        return { idl, programId }
      }
      case 'PROGRAM_INSTRUCTIONS': {
        const idl = inputs.idl as Idl | undefined
        const programId = inputs.programId as string | undefined
        const transactionIn = (inputs.transactionIn as Transaction | null) ?? null
        const def = idl?.instructions.find((i) => i.name === data.selectedInstruction)
        if (!idl || !programId || !def) return { transactionOut: transactionIn ?? new Transaction() }
        const resolvedInputs: Record<string, { value: unknown }> = {}
        for (const [k, value] of Object.entries(inputs)) resolvedInputs[k] = { value }
        const transactionOut = await buildProgramInstruction({
          programId,
          instructionDef: def,
          resolvedInputs,
          baseTransaction: transactionIn,
        })
        return { transactionOut }
      }
      case 'PDA': {
        const seeds = Object.entries(inputs)
          .filter(([k]) => k.startsWith('seed#'))
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([, v]) => v)
        return getPda(String(inputs.programId ?? ''), seeds)
      }
      default:
        // Value nodes outside the transaction chain keep their persisted outputs.
        return data
    }
  }

  function evaluate(id: string): Promise<Outputs> {
    let result = cache.get(id)
    if (!result) {
      result = compute(nodes.get(id)!)
      cache.set(id, result)
    }
    return result
  }

  // Chain tails: instruction nodes whose transactionOut feeds no other instruction node.
  const instructionTypes = new Set(['INSTRUCTIONS', 'PROGRAM_INSTRUCTIONS'])
  const feedsInstruction = (id: string) =>
    flow.edges.some((e) => e.source === id && instructionTypes.has(nodes.get(e.target)?.type ?? ''))
  const tails = flow.nodes.filter((n) => instructionTypes.has(n.type ?? '') && !feedsInstruction(n.id))

  const result: BaselineInstruction[][] = []
  for (const tail of tails) {
    const { transactionOut } = await evaluate(tail.id)
    result.push(serializeInstructions(transactionOut as Transaction))
  }
  return result
}
