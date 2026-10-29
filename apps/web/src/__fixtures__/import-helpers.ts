import bs58 from 'bs58'
import { Buffer } from 'buffer'
import { PublicKey } from '@solana/web3.js'
import type { FlowSnapshot } from '@/stores/flow-snapshot'
import type { Network } from '@/types/network'
import { evaluateTxChain } from '@/utils/flow/evaluate-tx-chain'
import { handleDataField } from '@/utils/flow/resolve-inputs'
import { findTxChainHead, lastEdgeInto, publicKeyString, readDraftMeta, upstreamFlow } from '@/utils/flow/tx-draft'
import { idlContentHash } from '@/utils/idl/sources/content-hash'
import type { ComputeContext, ResolveIdl } from '@/utils/node/compute/types'
import { compileMessage, fromTransactionInstruction, type AltAccounts } from '@/utils/solana/message-compiler'
import type { ImportRpc, JsonRpc } from '@/utils/tx-import/rpc'
import { fixtureIdl, loadTxFixture } from './tx-helpers'

const ALT_PROGRAM = 'AddressLookupTab1e1111111111111111111111111'
const LOOKUP_TABLE_META_SIZE = 56

const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

export const fixtureNetwork = (name: string): Network =>
  loadTxFixture(name).network === 'devnet' ? 'DEVNET' : 'MAINNET'

/** The fixture's whole transaction: signature count, signatures, message. */
export function fixtureTransaction(name: string): Uint8Array {
  const fx = loadTxFixture(name)
  const signatures = (fx.signatures ?? []).map((s) => bs58.decode(s))
  return Uint8Array.from([signatures.length, ...signatures.flatMap((s) => [...s]), ...Buffer.from(fx.wire, 'base64')])
}

/** Address lookup table account data: type 1, never deactivated, no authority, then the addresses. */
export function altAccountData(addresses: string[]): Uint8Array {
  const meta = new Uint8Array(LOOKUP_TABLE_META_SIZE)
  const view = new DataView(meta.buffer)
  view.setUint32(0, 1, true)
  view.setBigUint64(4, 0xffffffffffffffffn, true)
  return Uint8Array.from([...meta, ...addresses.flatMap((a) => [...new PublicKey(a).toBytes()])])
}

type Handler = (network: Network, method: string, params: unknown[]) => unknown

export interface FixtureRpcOptions {
  /** Networks whose getTransaction finds the fixture (default: the network it was captured on). */
  foundOn?: Network[]
  /** Answers a call first; `undefined` falls through to the fixture's data. */
  handle?: Handler
}

/** A fake JSON-RPC per network serving one fixture; `calls` records `NETWORK method` in order. */
export function fixtureRpc(name: string, options: FixtureRpcOptions = {}): { rpc: ImportRpc; calls: string[] } {
  const fx = loadTxFixture(name)
  const foundOn = options.foundOn ?? [fixtureNetwork(name)]
  const calls: string[] = []
  const transaction = base64(fixtureTransaction(name))

  const answer: Handler = (network, method, params) => {
    switch (method) {
      case 'getTransaction':
        return foundOn.includes(network)
          ? { slot: fx.slot, transaction: [transaction, 'base64'], meta: structuredClone(fx.meta) }
          : null
      case 'simulateTransaction':
        return { context: { slot: fx.slot }, value: structuredClone(fx.simulation) }
      case 'getMultipleAccounts': {
        const [addresses] = params as [string[]]
        return {
          context: { slot: fx.slot },
          value: addresses.map((address) => {
            const table = fx.altAccounts?.[address]
            return table ? { lamports: 1, owner: ALT_PROGRAM, data: [base64(altAccountData(table)), 'base64'] } : null
          }),
        }
      }
      case 'getFeeForMessage':
        return { context: { slot: fx.slot }, value: 5000 }
    }
    throw new Error(`Unexpected RPC call ${method}`)
  }
  const endpoint =
    (network: Network): JsonRpc =>
    async <T>(method: string, params: unknown[]) => {
      calls.push(`${network} ${method}`)
      const custom = options.handle?.(network, method, params)
      return (custom !== undefined ? custom : answer(network, method, params)) as T
    }
  return { rpc: { MAINNET: endpoint('MAINNET'), DEVNET: endpoint('DEVNET') }, calls }
}

const rawIdls = new Map<string, Promise<unknown | null>>()

/** IDL lookup over the fixtures' captured IDL accounts; `withhold` lists programs it pretends to know nothing about. */
export const fixtureResolveIdl =
  (withhold: string[] = []): ResolveIdl =>
  async (programId) => {
    if (withhold.includes(programId)) return { idl: null, sourceChanged: false, failures: ['withheld'] }
    let raw = rawIdls.get(programId)
    if (!raw) rawIdls.set(programId, (raw = fixtureIdl(programId)))
    const value = await raw
    return value
      ? {
          idl: { programId, source: 'program-metadata', raw: value, contentHash: idlContentHash(value) },
          sourceChanged: false,
          failures: [],
        }
      : { idl: null, sourceChanged: false, failures: ['No fixture IDL'] }
  }

/**
 * What Send compiles on the draft path: evaluateTxChain over the TRANSACTION's chain (with `ctx`), then
 * compileMessage with the builder's draft meta, its fee payer edge and the original blockhash.
 */
export async function rebuildMessage(flow: FlowSnapshot, ctx: ComputeContext, altAccounts: AltAccounts) {
  const types = new Map(flow.nodes.map((n) => [n.id, n.type]))
  const transaction = flow.nodes.find((n) => n.type === 'TRANSACTION')!
  const head = findTxChainHead(transaction.id, flow.edges, (id) => types.get(id))
  if (head.badLink || !head.builderId || !head.tailId) throw new Error('No replayable chain')
  const builder = flow.nodes.find((n) => n.id === head.builderId)!
  const meta = readDraftMeta(builder.data as Record<string, unknown>)
  const feeEdge = lastEdgeInto(flow.edges, builder.id, ['feePayer'])!
  const feeSource = flow.nodes.find((n) => n.id === feeEdge.source)!
  // A WALLET node (after "Use my wallet") outputs the connected wallet's key.
  const feePayer =
    feeSource.type === 'WALLET'
      ? ctx.walletPublicKey!
      : publicKeyString(feeSource.data[handleDataField(feeEdge.sourceHandle!, feeEdge.source)])!
  const chains = await evaluateTxChain(upstreamFlow(transaction.id, flow), ctx)
  const chain = chains.find((c) => c.nodeId === head.tailId)!
  const instructions = chain.transaction.instructions.map(fromTransactionInstruction)
  const bytes = compileMessage(
    { version: meta.version!, feePayer, instructions, lookupTables: meta.version === 0 ? meta.lookupTables : [] },
    meta.original!.blockhash,
    altAccounts,
    meta.hints
  )
  return { bytes, instructions }
}
