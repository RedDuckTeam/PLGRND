import { describe, expect, it } from 'vitest'
import { Keypair, VersionedMessage, VersionedTransaction } from '@solana/web3.js'
import nacl from 'tweetnacl'
import { BASELINE_CASES, BASELINE_WALLET, loadCaseFlow } from '@/__fixtures__/flows/baseline-cases'
import { compileMessage, decompileMessage, fromTransactionInstruction } from '@/utils/solana/message-compiler'
import { evaluateTxChain } from './evaluate-tx-chain'
import { findTxChainHead, hasDraftMeta, publicKeyString, readDraftMeta, upstreamFlow } from './tx-draft'

const edge = (source: string, sourceField: string, target: string, targetField: string) => ({
  source,
  target,
  sourceHandle: `${source}-${sourceField}-right`,
  targetHandle: `${target}-${targetField}-left`,
})

const types: Record<string, string> = {
  b: 'TRANSACTION_BUILDER',
  i1: 'INSTRUCTIONS',
  i2: 'PROGRAM_INSTRUCTIONS',
  x: 'SOME_PLUGIN_NODE',
  t: 'TRANSACTION',
}
const typeOf = (id: string) => types[id]

describe('findTxChainHead', () => {
  it('walks the transaction edges back to the builder', () => {
    const edges = [
      edge('b', 'transaction', 'i1', 'transactionIn'),
      edge('i1', 'transactionOut', 'i2', 'transactionIn'),
      edge('i2', 'transactionOut', 't', 'transaction'),
      edge('x', 'value', 'i2', 'account_user'),
    ]
    expect(findTxChainHead('t', edges, typeOf)).toEqual({ tailId: 'i2', builderId: 'b', badLink: null })
  })

  it('reports a link that is not a registry instruction node', () => {
    const edges = [
      edge('b', 'transaction', 'x', 'transaction'),
      edge('x', 'transactionOut', 'i1', 'transactionIn'),
      edge('i1', 'transactionOut', 't', 'transaction'),
    ]
    expect(findTxChainHead('t', edges, typeOf)).toEqual({ tailId: 'i1', builderId: 'b', badLink: 'SOME_PLUGIN_NODE' })
  })

  it('finds no builder for an unconnected or cyclic chain', () => {
    expect(findTxChainHead('t', [], typeOf)).toEqual({ tailId: null, builderId: null, badLink: null })
    const cycle = [
      edge('i1', 'transactionOut', 'i2', 'transactionIn'),
      edge('i2', 'transactionOut', 'i1', 'transactionIn'),
      edge('i2', 'transactionOut', 't', 'transaction'),
    ]
    expect(findTxChainHead('t', cycle, typeOf).builderId).toBeNull()
  })
})

describe('upstreamFlow', () => {
  it('keeps the nodes a node depends on and the edges between them', () => {
    const nodes = ['b', 'i1', 't', 'other', 'v'].map((id) => ({ id }))
    const edges = [
      edge('v', 'text', 'i1', 'toPubkey'),
      edge('b', 'transaction', 'i1', 'transactionIn'),
      edge('i1', 'transactionOut', 't', 'transaction'),
      edge('v', 'text', 'other', 'input'),
    ]
    const flow = upstreamFlow('t', { nodes, edges })
    expect(flow.nodes.map((n) => n.id)).toEqual(['b', 'i1', 't', 'v'])
    expect(flow.edges).toEqual(edges.slice(0, 3))
  })
})

describe('draft meta', () => {
  it('is absent on a builder dropped from the menu', () => {
    expect(hasDraftMeta({})).toBe(false)
    expect(hasDraftMeta({ transaction: null })).toBe(false)
    expect(hasDraftMeta({ version: 0 })).toBe(true)
  })

  it('reads well-formed values only', () => {
    expect(readDraftMeta({ version: 0, lookupTables: ['a', 1], feePayer: '' })).toEqual({
      version: 0,
      feePayer: undefined,
      lookupTables: ['a'],
      hints: undefined,
      original: undefined,
    })
    expect(readDraftMeta({ version: 'v9' }).version).toBe('legacy')
  })

  it('accepts fee payer values that are addresses', () => {
    expect(publicKeyString('11111111111111111111111111111111')).toBe('11111111111111111111111111111111')
    expect(publicKeyString('not a key')).toBeUndefined()
    expect(publicKeyString(42)).toBeUndefined()
  })
})

describe('draft path on a hand-built flow', () => {
  it('evaluates the chain into a v0 message signed as a VersionedTransaction', async () => {
    const flow = loadCaseFlow(BASELINE_CASES.find((c) => c.file.startsWith('example-4'))!)
    const builder = flow.nodes.find((n) => n.type === 'TRANSACTION_BUILDER')!
    builder.data = { ...builder.data, version: 0 }
    const transaction = flow.nodes.find((n) => n.type === 'TRANSACTION')!
    const types = new Map(flow.nodes.map((n) => [n.id, n.type]))

    const head = findTxChainHead(transaction.id, flow.edges, (id) => types.get(id))
    expect(head).toMatchObject({ builderId: builder.id, badLink: null })
    expect(readDraftMeta(builder.data as Record<string, unknown>).version).toBe(0)

    const chains = await evaluateTxChain(upstreamFlow(transaction.id, flow), { walletPublicKey: BASELINE_WALLET })
    const instructions = chains
      .find((c) => c.nodeId === head.tailId)!
      .transaction.instructions.map(fromTransactionInstruction)
    const bytes = compileMessage(
      { version: 0, feePayer: BASELINE_WALLET, instructions },
      '11111111111111111111111111111111'
    )
    expect(decompileMessage(bytes)).toMatchObject({ version: 0, instructions })

    const tx = new VersionedTransaction(VersionedMessage.deserialize(bytes))
    const signer = Keypair.fromSeed(new Uint8Array(32).fill(7))
    tx.sign([signer])
    expect(nacl.sign.detached.verify(bytes, tx.signatures[0], signer.publicKey.toBytes())).toBe(true)
  })
})
