import { Buffer } from 'buffer'
import type { Edge, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { Keypair, type Transaction } from '@solana/web3.js'
import { fixtureIdl, fixtureInstructions } from '@/__fixtures__/tx-helpers'
import { decodeInstruction } from '@/utils/idl/model/codec'
import { normalizeIdl } from '@/utils/idl/model/normalize'
import type { ProgramIdl } from '@/utils/idl/model/program-idl'
import { convertRawToProgramInstructions } from './convert-raw-instruction'
import { evaluateTxChain } from './evaluate-tx-chain'

const key = (seed: number) => Keypair.fromSeed(new Uint8Array(32).fill(seed)).publicKey.toBase58()
const PROGRAM = key(9)

const node = (id: string, type: string, data: Record<string, unknown> = {}): Node => ({
  id,
  type,
  position: { x: 10, y: 20 },
  data,
})
const edge = (source: string, sourceField: string, target: string, targetField: string): Edge => ({
  id: `${source}.${sourceField}>${target}.${targetField}`,
  source,
  sourceHandle: `${source}-${sourceField}-right`,
  target,
  targetHandle: `${target}-${targetField}-left`,
})

const instructions = (tx: Transaction) =>
  tx.instructions.map((ix) => ({
    programId: ix.programId.toBase58(),
    keys: ix.keys.map((k) => [k.pubkey.toBase58(), k.isSigner, k.isWritable]),
    data: Buffer.from(ix.data).toString('hex'),
  }))

const built = async (flow: { nodes: Node[]; edges: Edge[] }) =>
  (await evaluateTxChain(JSON.parse(JSON.stringify(flow)))).map((chain) => instructions(chain.transaction))

const depositIdlJson = {
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
}

const decodeRaw = (idl: ProgramIdl, data: Record<string, unknown>) =>
  decodeInstruction(idl, {
    data: Buffer.from(data.dataHex as string, 'hex'),
    accounts: data.accounts as { pubkey: string; isSigner: boolean; isWritable: boolean }[],
  })!

describe('convertRawToProgramInstructions', () => {
  // TEXT feeds account 0; account 1 is typed; account 2 is beyond the IDL's accounts. The flags differ from the IDL.
  const rawData = {
    programId: PROGRAM,
    accounts: [
      { pubkey: '', isSigner: true, isWritable: true },
      { pubkey: key(2), isSigner: false, isWritable: false },
      { pubkey: key(3), isSigner: false, isWritable: true },
    ],
    dataHex: '0102030405060708' + '2a00000000000000',
  }
  const flow = () => ({
    nodes: [
      node('idl', 'IDL', { idlJson: JSON.stringify(depositIdlJson) }),
      node('b', 'TRANSACTION_BUILDER'),
      node('t', 'TEXT', { text: key(1) }),
      node('raw', 'RAW_INSTRUCTION', rawData),
      node('next', 'RAW_INSTRUCTION', { programId: PROGRAM, accounts: [], dataHex: 'ff' }),
    ],
    edges: [
      edge('idl', 'idl', 'raw', 'idl'),
      edge('b', 'transaction', 'raw', 'transactionIn'),
      edge('t', 'text', 'raw', 'account_0'),
      edge('raw', 'transactionOut', 'next', 'transactionIn'),
    ],
  })
  const idl = normalizeIdl(depositIdlJson, PROGRAM)
  const decoded = decodeRaw(idl, {
    ...rawData,
    accounts: [{ ...rawData.accounts[0], pubkey: key(1) }, ...rawData.accounts.slice(1)],
  })

  it('decodes exactly, so the conversion is offered', () => {
    expect(decoded).toMatchObject({ name: 'deposit', args: { amount: '42' }, exact: true })
  })

  it('keeps position, edges and values, and builds the same bytes', async () => {
    const before = flow()
    const after = convertRawToProgramInstructions(before, 'raw', 'pi', idl, decoded)!

    const converted = after.nodes.find((n) => n.id === 'pi')!
    expect(after.nodes.map((n) => n.id)).toEqual(['idl', 'b', 't', 'pi', 'next'])
    expect(converted).toEqual({
      id: 'pi',
      type: 'PROGRAM_INSTRUCTIONS',
      position: { x: 10, y: 20 },
      data: {
        selectedInstruction: 'deposit',
        inline: { programId: PROGRAM, account_vault: key(2), arg_amount: '42' },
        metaOverrides: [
          { isSigner: true, isWritable: true },
          { isSigner: false, isWritable: false },
        ],
        remainingAccounts: [{ pubkey: key(3), isSigner: false, isWritable: true }],
      },
    })
    expect(after.edges.map((e) => [e.source, e.sourceHandle, e.target, e.targetHandle])).toEqual([
      ['idl', 'idl-idl-right', 'pi', 'pi-idl-left'],
      ['b', 'b-transaction-right', 'pi', 'pi-transactionIn-left'],
      ['t', 't-text-right', 'pi', 'pi-account_user-left'],
      ['pi', 'pi-transactionOut-right', 'next', 'next-transactionIn-left'],
    ])
    expect(new Set(after.edges.map((e) => e.id)).size).toBe(after.edges.length)

    const bytes = await built(before)
    expect(bytes[0]).toHaveLength(2)
    expect(await built(after)).toEqual(bytes)
  })

  it('maps an edge into a remaining account position to its remaining handle', async () => {
    const before = flow()
    before.edges.push(edge('t', 'text', 'raw', 'account_2'))
    const after = convertRawToProgramInstructions(before, 'raw', 'pi', idl, decoded)!
    expect(after.edges.some((e) => e.targetHandle === 'pi-remaining_0-left')).toBe(true)
    expect(await built(after)).toEqual(await built(before))
  })

  it('returns null for an unknown node or instruction, or account names used twice', () => {
    expect(convertRawToProgramInstructions(flow(), 'missing', 'pi', idl, decoded)).toBeNull()
    expect(convertRawToProgramInstructions(flow(), 'raw', 'pi', idl, { ...decoded, name: 'withdraw' })).toBeNull()
    const [summary] = idl.instructions
    const twice = { ...idl, instructions: [{ ...summary, accounts: [summary.accounts[0], summary.accounts[0]] }] }
    expect(convertRawToProgramInstructions(flow(), 'raw', 'pi', twice, decoded)).toBeNull()
  })

  it.each(['jupiter-swap', 'spl-transfer-ata-create'])(
    '%s: raw top-level instructions convert one by one without changing a byte',
    async (fixture) => {
      let current: { nodes: Node[]; edges: Edge[] } = { nodes: [node('b', 'TRANSACTION_BUILDER')], edges: [] }
      const idls: ProgramIdl[] = []
      let previous = ['b', 'transaction']
      for (const [n, ix] of fixtureInstructions(fixture)
        .filter((i) => i.where.startsWith('top#'))
        .entries()) {
        const raw = await fixtureIdl(ix.programId)
        idls.push(normalizeIdl(raw, ix.programId))
        current.nodes.push(
          node(`idl${n}`, 'IDL', { idlJson: JSON.stringify(raw), programId: ix.programId }),
          node(`raw${n}`, 'RAW_INSTRUCTION', {
            programId: ix.programId,
            accounts: ix.accounts,
            dataHex: Buffer.from(ix.data).toString('hex'),
          })
        )
        current.edges.push(
          edge(`idl${n}`, 'idl', `raw${n}`, 'idl'),
          edge(previous[0], previous[1], `raw${n}`, 'transactionIn')
        )
        previous = [`raw${n}`, 'transactionOut']
      }
      const expected = await built(current)
      expect(expected[0].length).toBe(idls.length)

      for (const [n, idl] of idls.entries()) {
        const data = current.nodes.find((x) => x.id === `raw${n}`)!.data
        const result = decodeRaw(idl, data)
        expect(result.exact).toBe(true)
        current = convertRawToProgramInstructions(current, `raw${n}`, `pi${n}`, idl, result)!
      }
      expect(current.nodes.some((x) => x.type === 'RAW_INSTRUCTION')).toBe(false)
      expect(await built(current)).toEqual(expected)
    }
  )
})
