import { Buffer } from 'buffer'
import type { Edge, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { Keypair, SystemProgram, type Transaction } from '@solana/web3.js'
import { fixtureIdl, fixtureInstructions } from '@/__fixtures__/tx-helpers'
import { decodeInstruction } from '@/utils/idl/model/codec'
import { normalizeIdl } from '@/utils/idl/model/normalize'
import { evaluateTxChain } from './evaluate-tx-chain'

const key = (seed: number) => Keypair.fromSeed(new Uint8Array(32).fill(seed)).publicKey.toBase58()
const PROGRAM = key(9)

const node = (id: string, type: string, data: Record<string, unknown> = {}): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data,
})
const edge = (source: string, sourceField: string, target: string, targetField: string): Edge => ({
  id: `${source}.${sourceField}>${target}.${targetField}`,
  source,
  sourceHandle: `${source}-${sourceField}-right`,
  target,
  targetHandle: `${target}-${targetField}-left`,
})

type PlainInstruction = { programId: string; keys: [string, boolean, boolean][]; data: string }

const instructions = (tx: Transaction): PlainInstruction[] =>
  tx.instructions.map((ix) => ({
    programId: ix.programId.toBase58(),
    keys: ix.keys.map((k) => [k.pubkey.toBase58(), k.isSigner, k.isWritable]),
    data: Buffer.from(ix.data).toString('hex'),
  }))

const depositIdlJson = JSON.stringify({
  address: PROGRAM,
  metadata: { name: 'demo', version: '0.1.0', spec: '0.1.0' },
  instructions: [
    {
      name: 'deposit',
      discriminator: [1, 2, 3, 4, 5, 6, 7, 8],
      accounts: [
        { name: 'user', writable: true, signer: true },
        { name: 'vault', writable: true },
      ],
      args: [{ name: 'amount', type: 'u64' }],
    },
  ],
  accounts: [],
  types: [],
})

const depositFlow = (inline: Record<string, string>, extra: { nodes?: Node[]; edges?: Edge[] } = {}) => ({
  nodes: [
    node('idl', 'IDL', { idlJson: depositIdlJson }),
    node('b', 'TRANSACTION_BUILDER'),
    node('pi', 'PROGRAM_INSTRUCTIONS', { selectedInstruction: 'deposit', inline }),
    ...(extra.nodes ?? []),
  ],
  edges: [edge('idl', 'idl', 'pi', 'idl'), edge('b', 'transaction', 'pi', 'transactionIn'), ...(extra.edges ?? [])],
})

describe('evaluateTxChain with inline values', () => {
  it('fills unconnected inputs, the program id included, from data.inline', async () => {
    const [chain] = await evaluateTxChain(
      depositFlow({ programId: PROGRAM, account_user: key(1), account_vault: key(2), arg_amount: '5' })
    )
    expect(instructions(chain.transaction)).toEqual([
      {
        programId: PROGRAM,
        keys: [
          [key(1), true, true],
          [key(2), false, true],
        ],
        data: '0102030405060708' + '0500000000000000',
      },
    ])
  })

  it('lets an edge win over the inline value of the same field', async () => {
    const flow = depositFlow(
      { programId: key(8), account_user: key(1), account_vault: key(2), arg_amount: '5' },
      {
        nodes: [node('t', 'TEXT', { text: key(3) }), node('n', 'NUMBER', { number: 7 })],
        edges: [
          edge('idl', 'programId', 'pi', 'programId'),
          edge('t', 'text', 'pi', 'account_vault'),
          edge('n', 'number', 'pi', 'arg_amount'),
        ],
      }
    )
    const [ix] = instructions((await evaluateTxChain(flow))[0].transaction)
    expect(ix.programId).toBe(PROGRAM)
    expect(ix.keys[1]).toEqual([key(3), false, true])
    expect(ix.data).toBe('0102030405060708' + '0700000000000000')
  })

  it('chains RAW_INSTRUCTION like the other instruction nodes', async () => {
    const raw = node('raw', 'RAW_INSTRUCTION', {
      programId: SystemProgram.programId.toBase58(),
      accounts: [
        { pubkey: key(1), isSigner: true, isWritable: true },
        { pubkey: key(2), isSigner: false, isWritable: true },
      ],
      dataHex: '02000000e803000000000000',
    })
    const flow = depositFlow(
      { programId: PROGRAM, account_user: key(1), account_vault: key(2), arg_amount: '5' },
      { nodes: [raw], edges: [edge('pi', 'transactionOut', 'raw', 'transactionIn')] }
    )
    const chains = await evaluateTxChain(flow)
    expect(chains.map((c) => c.nodeId)).toEqual(['raw'])
    expect(instructions(chains[0].transaction).map((ix) => ix.data)).toEqual([
      '01020304050607080500000000000000',
      '02000000e803000000000000',
    ])
  })
})

describe('evaluateTxChain with a tail id', () => {
  it('evaluates only the chain ending at that node, even one feeding another instruction', async () => {
    const raw = node('raw', 'RAW_INSTRUCTION', { programId: SystemProgram.programId.toBase58(), dataHex: 'ff' })
    const flow = depositFlow(
      { programId: PROGRAM, account_user: key(1), account_vault: key(2), arg_amount: '5' },
      { nodes: [raw], edges: [edge('pi', 'transactionOut', 'raw', 'transactionIn')] }
    )
    const [chain, ...rest] = await evaluateTxChain(flow, {}, 'pi')
    expect(rest).toEqual([])
    expect(chain.nodeId).toBe('pi')
    expect(instructions(chain.transaction)).toHaveLength(1)
    expect(await evaluateTxChain(flow, {}, 'idl')).toEqual([])
  })
})

describe('imported instructions rebuild through PROGRAM_INSTRUCTIONS', () => {
  // What the importer generates per decoded instruction: inline values, the original metas and the extra accounts.
  const importedFlow = async (fixture: string) => {
    const originals = fixtureInstructions(fixture).filter((ix) => ix.where.startsWith('top#'))
    const nodes: Node[] = [node('b', 'TRANSACTION_BUILDER')]
    const edges: Edge[] = []
    let previous = 'b'
    let previousField = 'transaction'
    for (const [n, ix] of originals.entries()) {
      const raw = await fixtureIdl(ix.programId)
      const idl = normalizeIdl(raw, ix.programId)
      const decoded = decodeInstruction(idl, ix)
      expect(decoded?.exact, `${fixture} ${ix.where}`).toBe(true)
      const summary = idl.instructions.find((s) => s.name === decoded!.name)!
      const named = Math.min(ix.accounts.length, summary.accounts.length)
      const inline: Record<string, string> = {}
      ix.accounts.slice(0, named).forEach((a, i) => (inline[`account_${summary.accounts[i].name}`] = a.pubkey))
      for (const [name, value] of Object.entries(decoded!.args)) inline[`arg_${name}`] = value

      const idlId = `idl${n}`
      const piId = `pi${n}`
      nodes.push(node(idlId, 'IDL', { idlJson: JSON.stringify(raw), programId: ix.programId }))
      nodes.push(
        node(piId, 'PROGRAM_INSTRUCTIONS', {
          selectedInstruction: decoded!.name,
          inline,
          metaOverrides: ix.accounts.slice(0, named).map(({ isSigner, isWritable }) => ({ isSigner, isWritable })),
          remainingAccounts: ix.accounts.slice(named),
          ...(decoded!.legacyEmptyData ? { legacyEmptyData: true } : {}),
        })
      )
      edges.push(edge(idlId, 'idl', piId, 'idl'), edge(idlId, 'programId', piId, 'programId'))
      edges.push(edge(previous, previousField, piId, 'transactionIn'))
      previous = piId
      previousField = 'transactionOut'
    }
    const expected: PlainInstruction[] = originals.map((ix) => ({
      programId: ix.programId,
      keys: ix.accounts.map((a) => [a.pubkey, a.isSigner, a.isWritable]),
      data: Buffer.from(ix.data).toString('hex'),
    }))
    return { flow: { nodes, edges }, expected }
  }

  it.each(['jupiter-swap', 'spl-transfer-ata-create'])(
    '%s: every top-level instruction is byte-identical (program id, metas with flags, data)',
    async (fixture) => {
      const { flow, expected } = await importedFlow(fixture)
      const chains = await evaluateTxChain(JSON.parse(JSON.stringify(flow)))
      expect(chains).toHaveLength(1)
      expect(chains[0].transaction).not.toBeNull()
      expect(instructions(chains[0].transaction)).toEqual(expected)
    }
  )

  it('jupiter-swap: the route instruction relies on original flags and remaining accounts', async () => {
    const { flow } = await importedFlow('jupiter-swap')
    const route = flow.nodes.find((n) => n.data.selectedInstruction === 'route_with_token_ledger')!
    expect((route.data.remainingAccounts as unknown[]).length).toBeGreaterThan(0)
    // Without the original metas the IDL's flags differ from the transaction's.
    const withoutOverrides = {
      ...flow,
      nodes: flow.nodes.map((n) => (n === route ? { ...n, data: { ...n.data, metaOverrides: undefined } } : n)),
    }
    const { expected } = await importedFlow('jupiter-swap')
    const rebuilt = instructions((await evaluateTxChain(withoutOverrides))[0].transaction)
    expect(rebuilt).not.toEqual(expected)
  })
})
