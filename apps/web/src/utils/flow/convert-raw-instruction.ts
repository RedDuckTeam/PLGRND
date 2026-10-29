import { Position, type Edge, type Node } from '@xyflow/react'
import { NodeTypeEnum } from '@/types/node'
import type { ProgramInstructionsNodeData } from '@/types/nodes/programs/program-instructions-node'
import type { RawInstructionNodeData } from '@/types/nodes/programs/raw-instruction-node'
import type { DecodedInstruction } from '@/utils/idl/model/codec'
import type { ProgramIdl } from '@/utils/idl/model/program-idl'
import { handleDataField } from './resolve-inputs'

type Flow = { nodes: Node[]; edges: Edge[] }

/**
 * Replaces a RAW_INSTRUCTION node with a PROGRAM_INSTRUCTIONS node for the instruction an exact decode identified:
 * same position and edges, account edges moved to the IDL's account at the same position (extra accounts become
 * remaining accounts), typed values kept inline and the original flags kept as `metaOverrides`, so the bytes do not
 * change. null when the node or instruction is unknown, or two positions share an account name.
 */
export function convertRawToProgramInstructions(
  flow: Flow,
  rawId: string,
  newId: string,
  idl: ProgramIdl,
  decoded: Pick<DecodedInstruction, 'name' | 'args' | 'legacyEmptyData'>
): Flow | null {
  const raw = flow.nodes.find((n) => n.id === rawId)
  const summary = idl.instructions.find((ix) => ix.name === decoded.name)
  if (!raw || raw.type !== NodeTypeEnum.RAW_INSTRUCTION || !summary) return null

  const data = raw.data as RawInstructionNodeData
  const accounts = data.accounts ?? []
  const named = Math.min(accounts.length, summary.accounts.length)
  const names = summary.accounts.slice(0, named).map((a) => a.name)
  if (new Set(names).size !== names.length) return null
  const fieldFor = (i: number) => (i < named ? `account_${names[i]}` : `remaining_${i - named}`)

  const incoming = flow.edges.filter((e) => e.target === rawId)
  const connected = new Set(incoming.map((e) => handleDataField(e.targetHandle ?? '', rawId)))

  const inline: Record<string, string> = {}
  if (data.programId?.trim()) inline.programId = data.programId.trim()
  names.forEach((_, i) => {
    const pubkey = accounts[i].pubkey?.trim()
    if (pubkey && !connected.has(`account_${i}`)) inline[fieldFor(i)] = pubkey
  })
  for (const arg of summary.args) {
    if (decoded.args[arg.name] !== undefined) inline[`arg_${arg.name}`] = decoded.args[arg.name]
  }

  const remainingAccounts = accounts.slice(named).map(({ pubkey, isSigner, isWritable }) => ({
    pubkey,
    isSigner,
    isWritable,
  }))
  const converted: Node = {
    id: newId,
    type: NodeTypeEnum.PROGRAM_INSTRUCTIONS,
    position: raw.position,
    data: {
      selectedInstruction: summary.name,
      inline,
      metaOverrides: accounts.slice(0, named).map(({ isSigner, isWritable }) => ({ isSigner, isWritable })),
      ...(remainingAccounts.length > 0 ? { remainingAccounts } : {}),
      ...(decoded.legacyEmptyData ? { legacyEmptyData: true } : {}),
    } satisfies ProgramInstructionsNodeData,
  }

  const edges: Edge[] = []
  for (const edge of flow.edges) {
    if (edge.target === rawId) {
      const field = handleDataField(edge.targetHandle ?? '', rawId)
      const account = /^account_(\d+)$/.exec(field)
      if (account && Number(account[1]) >= accounts.length) continue
      const targetHandle = `${newId}-${account ? fieldFor(Number(account[1])) : field}-${Position.Left}`
      edges.push({ ...edge, id: `xy-edge__${edge.sourceHandle}-${targetHandle}`, target: newId, targetHandle })
    } else if (edge.source === rawId) {
      const sourceHandle = `${newId}-${handleDataField(edge.sourceHandle ?? '', rawId)}-${Position.Right}`
      edges.push({ ...edge, id: `xy-edge__${sourceHandle}-${edge.targetHandle}`, source: newId, sourceHandle })
    } else {
      edges.push(edge)
    }
  }

  return { nodes: flow.nodes.map((n) => (n.id === rawId ? converted : n)), edges }
}
