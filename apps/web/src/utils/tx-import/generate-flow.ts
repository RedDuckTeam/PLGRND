import { Buffer } from 'buffer'
import { Position, type Edge, type Node } from '@xyflow/react'
import type { FlowSnapshot } from '@/stores/flow-snapshot'
import { NodeTypeEnum } from '@/types/node'
import type { ProgramInstructionsNodeData } from '@/types/nodes/programs/program-instructions-node'
import type { RawInstructionNodeData } from '@/types/nodes/programs/raw-instruction-node'
import type { TxDraftMeta, TxDraftOriginal } from '@/types/nodes/transactions/transaction-builder-node'
import type { TxTraceNodeData } from '@/types/nodes/transactions/tx-trace-node'
import { findInstruction } from '@/utils/idl/model/program-idl'
import { detectDurableNonce, messageHash } from '@/utils/solana/send-plan'
import type { DecodedTransaction, ImportInstruction } from './decode'
import type { FetchedTransaction } from './fetch'
import { layoutFlow } from './layout'
import { accountUse, argUse, type Provenance } from './provenance'

export interface GenerateInput {
  decoded: DecodedTransaction
  instructions: ImportInstruction[]
  provenance: Provenance
  fetched: Pick<FetchedTransaction, 'network' | 'source' | 'signatures' | 'serialized' | 'message'>
}

export const IMPORT_NODE_IDS = { network: 'network', builder: 'builder', transaction: 'tx', trace: 'trace' } as const

export const instructionNodeId = (index: number) => `ix${index}`

const OUTPUT_FIELD = { text: 'text', number: 'number', ata: 'ata', pda: 'pda' } as const

const isEmptySignature = (signature: string) => /^1+$/.test(signature)

/**
 * The flow of an imported transaction: NETWORK, value nodes, one IDL node per decoded program, TX BUILDER (draft
 * meta: version, lookup tables, original key order, original message) → one node per top-level instruction in order
 * (PROGRAM INSTRUCTIONS when decoded, else RAW INSTRUCTION) → TRANSACTION, and TX TRACE. No viewport: the canvas
 * fits the view to the flow.
 */
export function generateFlow({ decoded, instructions, provenance, fetched }: GenerateInput): FlowSnapshot {
  const { message, programs } = decoded
  const nodes: Node[] = []
  const edges: Edge[] = []
  const add = (id: string, type: NodeTypeEnum, data: Record<string, unknown>) =>
    nodes.push({ id, type, position: { x: 0, y: 0 }, data })
  const connect = (source: string, sourceField: string, target: string, targetField: string) => {
    const sourceHandle = `${source}-${sourceField}-${Position.Right}`
    const targetHandle = `${target}-${targetField}-${Position.Left}`
    edges.push({ id: `xy-edge__${sourceHandle}-${targetHandle}`, source, sourceHandle, target, targetHandle })
  }
  const { network, builder, transaction, trace } = IMPORT_NODE_IDS

  add(network, NodeTypeEnum.NETWORK, { network: fetched.network })

  // IDL nodes first, by id, so value nodes can read a program id from them.
  const idlIds = new Map<string, string>()
  for (const ix of instructions) {
    if (ix.decoded && !idlIds.has(ix.programId)) idlIds.set(ix.programId, `idl${idlIds.size}`)
  }

  const valueNodes = new Map<string, { id: string; field: string }>()
  for (const [key, spec] of provenance.values) {
    const id = `v${valueNodes.size}`
    valueNodes.set(key, { id, field: OUTPUT_FIELD[spec.kind] })
    switch (spec.kind) {
      case 'text':
        add(id, NodeTypeEnum.TEXT, { text: spec.text, ...(spec.signer ? { signer: true } : {}) })
        break
      case 'number':
        add(id, NodeTypeEnum.NUMBER, { number: spec.number })
        break
      case 'ata':
        add(id, NodeTypeEnum.ATA, { tokenProgram: spec.tokenProgram })
        break
      case 'pda':
        add(id, NodeTypeEnum.PDA, {})
        break
    }
  }
  const from = (key: string, target: string, targetField: string) => {
    const source = valueNodes.get(key)!
    connect(source.id, source.field, target, targetField)
  }
  for (const [key, spec] of provenance.values) {
    const { id } = valueNodes.get(key)!
    if (spec.kind === 'ata') {
      from(spec.owner, id, 'owner')
      from(spec.mint, id, 'mint')
    } else if (spec.kind === 'pda') {
      if ('idl' in spec.program) connect(idlIds.get(spec.program.idl)!, 'programId', id, 'programId')
      else from(spec.program.value, id, 'programId')
      spec.seeds.forEach((seed, i) => from(seed, id, `seed#${i}`))
    }
  }

  for (const [programId, id] of idlIds) add(id, NodeTypeEnum.IDL, structuredClone(programs.get(programId)!.node))

  const original: TxDraftOriginal = { messageHash: messageHash(fetched.message), blockhash: message.recentBlockhash }
  const nonce = detectDurableNonce(message.instructions)
  if (nonce) original.nonce = nonce
  if (fetched.serialized) {
    const signers = message.staticKeys.slice(0, message.header.numRequiredSignatures)
    const signed = signers.flatMap((signer, i) => {
      const signature = fetched.signatures[i]
      return signature && !isEmptySignature(signature) ? [[signer, signature] as const] : []
    })
    if (signed.length > 0) original.signatures = Object.fromEntries(signed)
  }
  const draft: TxDraftMeta = {
    version: message.version,
    lookupTables: message.lookups.map((l) => l.table),
    hints: structuredClone(message.hints),
    original,
  }
  add(builder, NodeTypeEnum.TRANSACTION_BUILDER, draft)
  from(provenance.feePayer, builder, 'feePayer')

  let previous: { id: string; field: string } = { id: builder, field: 'transaction' }
  for (const ix of instructions) {
    const id = instructionNodeId(ix.index)
    const wired = (site: string, targetField: string) => {
      const key = provenance.uses.get(site)
      if (key) from(key, id, targetField)
      return key !== undefined
    }
    const entry = programs.get(ix.programId)
    const idlId = idlIds.get(ix.programId)

    if (ix.decoded && entry && idlId) {
      const summary = findInstruction(entry.idl, ix.decoded.name)!
      const named = summary.accounts.slice(0, ix.metas.length)
      const remaining = ix.metas.slice(named.length)
      const inline: Record<string, string> = {}
      named.forEach((account, position) => {
        const field = `account_${account.name}`
        const pubkey = ix.metas[position].pubkey
        if (!wired(accountUse(ix.index, position), field) && account.defaultAddress !== pubkey) inline[field] = pubkey
      })
      remaining.forEach((_, i) => wired(accountUse(ix.index, named.length + i), `remaining_${i}`))
      for (const arg of summary.args) {
        const field = `arg_${arg.name}`
        const value = ix.decoded.args[arg.name]
        if (!wired(argUse(ix.index, arg.name), field) && value !== undefined) inline[field] = value
      }
      const data: ProgramInstructionsNodeData = {
        selectedInstruction: ix.decoded.name,
        inline,
        metaOverrides: ix.metas.slice(0, named.length).map(({ isSigner, isWritable }) => ({ isSigner, isWritable })),
        ...(remaining.length > 0 ? { remainingAccounts: remaining.map((meta) => ({ ...meta })) } : {}),
        ...(ix.decoded.legacyEmptyData ? { legacyEmptyData: true } : {}),
      }
      add(id, NodeTypeEnum.PROGRAM_INSTRUCTIONS, data)
      connect(idlId, 'idl', id, 'idl')
      connect(idlId, 'programId', id, 'programId')
    } else {
      const data: RawInstructionNodeData = {
        programId: ix.programId,
        accounts: ix.metas.map((meta) => ({ ...meta })),
        dataHex: Buffer.from(ix.data).toString('hex'),
        ...(ix.raw ? { annotations: ix.raw } : {}),
      }
      add(id, NodeTypeEnum.RAW_INSTRUCTION, data)
      ix.metas.forEach((_, position) => wired(accountUse(ix.index, position), `account_${position}`))
      if (idlId) connect(idlId, 'idl', id, 'idl')
    }
    connect(previous.id, previous.field, id, 'transactionIn')
    previous = { id, field: 'transactionOut' }
  }

  add(transaction, NodeTypeEnum.TRANSACTION, {})
  connect(previous.id, previous.field, transaction, 'transaction')
  connect(network, 'network', transaction, 'network')

  const traceData: TxTraceNodeData =
    'signature' in fetched.source
      ? { signature: fetched.source.signature, network: fetched.network }
      : { serialized: fetched.source.serialized, network: fetched.network }
  add(trace, NodeTypeEnum.TX_TRACE, traceData)

  return { nodes: layoutFlow(nodes, edges), edges }
}
