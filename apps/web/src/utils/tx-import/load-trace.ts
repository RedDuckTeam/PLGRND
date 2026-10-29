import bs58 from 'bs58'
import { Buffer } from 'buffer'
import { AddressLookupTableAccount, VersionedTransaction, type VersionedMessage } from '@solana/web3.js'
import type { Network } from '@/types/network'
import type { ResolveIdl } from '@/utils/node/compute/types'
import { loadProgramIdls } from './decode'
import { rpcCall } from './rpc'
import { buildTrace, messageForTrace, traceProgramIds, type RpcExecution, type TxTrace } from './trace'

/** An executed transaction by signature, or a serialized one (base64 or base58) to simulate. */
export type TraceSource = { signature: string } | { serialized: string }

export interface LoadTraceDeps {
  network: Network
  rpcUrl: string
  resolveIdl: ResolveIdl
  signal?: AbortSignal
}

const NOT_FOUND_RETRIES = 3
const RETRY_DELAY_MS = 1500

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true }
    )
  })

const decodeSerialized = (text: string): Uint8Array => {
  const value = text.trim()
  const attempts = [() => Buffer.from(value, 'base64'), () => bs58.decode(value)]
  for (const decode of attempts) {
    try {
      const bytes = new Uint8Array(decode())
      VersionedTransaction.deserialize(bytes)
      return bytes
    } catch {
      // Try the next encoding.
    }
  }
  throw new Error('Not a serialized transaction (base64 or base58)')
}

// Simulations of older RPCs do not return the addresses v0 messages load from lookup tables.
const lookupAddresses = async (message: VersionedMessage, url: string, signal?: AbortSignal) => {
  const lookups = message.addressTableLookups
  if (!lookups.length) return { writable: [], readonly: [] }
  const result = await rpcCall<{ value: ({ data: [string, string] } | null)[] }>(
    url,
    'getMultipleAccounts',
    [lookups.map((l) => l.accountKey.toBase58()), { encoding: 'base64' }],
    signal
  )
  const tables = result.value.map((account, i) => {
    if (!account) throw new Error(`Address lookup table ${lookups[i].accountKey.toBase58()} not found`)
    return AddressLookupTableAccount.deserialize(Buffer.from(account.data[0], 'base64')).addresses
  })
  return {
    writable: lookups.flatMap((l, i) => l.writableIndexes.map((index) => tables[i][index].toBase58())),
    readonly: lookups.flatMap((l, i) => l.readonlyIndexes.map((index) => tables[i][index].toBase58())),
  }
}

const fetchExecuted = async (signature: string, deps: LoadTraceDeps) => {
  type Result = { slot: number; transaction: [string, string]; meta: RpcExecution | null } | null
  const params = [signature, { encoding: 'base64', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]
  // A transaction sent a moment ago may not have reached this RPC node yet.
  for (let attempt = 1; ; attempt++) {
    const result = await rpcCall<Result>(deps.rpcUrl, 'getTransaction', params, deps.signal)
    if (result) {
      if (!result.meta) throw new Error('The RPC returned the transaction without its execution result')
      const tx = VersionedTransaction.deserialize(Buffer.from(result.transaction[0], 'base64'))
      const message = messageForTrace(tx.message, result.meta.loadedAddresses)
      return { message, execution: result.meta, simulated: false, slot: result.slot }
    }
    if (attempt >= NOT_FOUND_RETRIES) throw new Error(`Transaction not found on ${deps.network}`)
    await sleep(RETRY_DELAY_MS, deps.signal)
  }
}

const simulate = async (serialized: string, deps: LoadTraceDeps) => {
  const bytes = decodeSerialized(serialized)
  const tx = VersionedTransaction.deserialize(bytes)
  const result = await rpcCall<{ context: { slot: number }; value: RpcExecution }>(
    deps.rpcUrl,
    'simulateTransaction',
    [
      Buffer.from(bytes).toString('base64'),
      {
        encoding: 'base64',
        sigVerify: false,
        replaceRecentBlockhash: true,
        innerInstructions: true,
        commitment: 'confirmed',
      },
    ],
    deps.signal
  )
  const loaded = result.value.loadedAddresses ?? (await lookupAddresses(tx.message, deps.rpcUrl, deps.signal))
  const message = messageForTrace(tx.message, loaded)
  return { message, execution: result.value, simulated: true, slot: result.context.slot }
}

/** Fetches (or simulates) a transaction over JSON-RPC, resolves the IDLs of the programs it ran, and traces it. */
export async function loadTrace(source: TraceSource, deps: LoadTraceDeps): Promise<TxTrace> {
  const input =
    'signature' in source ? await fetchExecuted(source.signature, deps) : await simulate(source.serialized, deps)
  // Programs without a usable IDL show their program id.
  const { programs } = await loadProgramIdls(traceProgramIds(input), deps)
  return buildTrace(input, new Map([...programs].map(([programId, { idl }]) => [programId, idl])))
}
