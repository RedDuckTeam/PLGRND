import bs58 from 'bs58'
import { Buffer } from 'buffer'
import { AddressLookupTableAccount, VersionedMessage, type MessageAddressTableLookup } from '@solana/web3.js'
import type { Network } from '@/types/network'
import { UnsupportedTransactionVersionError, type AltAccounts } from '@/utils/solana/message-compiler'
import { splitTransaction, TxImportError, type DetectedInput } from './detect-input'
import { RpcError, type ImportRpc, type JsonRpc } from './rpc'
import type { LoadedAddresses, RpcExecution } from './trace'

/** A transaction with what it did: fetched by signature, or simulated from serialized bytes. */
export interface FetchedTransaction {
  network: Network
  /** How TX_TRACE loads it again: by signature, or by simulating the serialized transaction (base64). */
  source: { signature: string } | { serialized: string }
  message: Uint8Array
  /** base58; all `1`s for an empty slot. */
  signatures: string[]
  /** A serialized input, not a landed transaction: its signatures may be reused while the message is unchanged. */
  serialized: boolean
  /** The lookup tables the message loads from; for fetched transactions only the indexes it uses are filled. */
  altAccounts: AltAccounts
  /** The transaction's meta or the simulation result; null when the simulation could not run. */
  execution: RpcExecution | null
  slot?: number
  /** Why the simulation could not run (the import still completes). */
  simulationError?: string
}

type RpcAccount = { lamports: number; owner: string; data: [string, string] }
type TokenBalance = NonNullable<RpcExecution['preTokenBalances']>[number]
type Simulation = { context?: { slot?: number }; value: RpcExecution & { accounts?: (RpcAccount | null)[] | null } }
type FetchedResult = { slot: number; transaction: [string, string]; meta: RpcExecution | null } | null

// getTransaction for a message version the request did not allow (version 1 transactions on mainnet).
const UNSUPPORTED_VERSION_CODE = -32015
const SEARCH_ORDER: Network[] = ['MAINNET', 'DEVNET']
const MAX_ACCOUNTS_PER_CALL = 100
const TOKEN_PROGRAMS = ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']
const TOKEN_ACCOUNT_SIZE = 165
const TOKEN_2022_ACCOUNT_TYPE = 2
const MINT_DECIMALS_OFFSET = 44

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

const unsupportedVersion = (error: unknown) => {
  if (!(error instanceof RpcError) || error.code !== UNSUPPORTED_VERSION_CODE) return null
  const version = /version \((\d+)\)/i.exec(error.message)
  return new UnsupportedTransactionVersionError(version ? Number(version[1]) : 1)
}

const getAccounts = async (call: JsonRpc, addresses: string[], config: Record<string, unknown> = {}) => {
  const accounts: (RpcAccount | null)[] = []
  for (let i = 0; i < addresses.length; i += MAX_ACCOUNTS_PER_CALL) {
    const { value } = await call<{ value: (RpcAccount | null)[] }>('getMultipleAccounts', [
      addresses.slice(i, i + MAX_ACCOUNTS_PER_CALL),
      { encoding: 'base64', commitment: 'confirmed', ...config },
    ])
    accounts.push(...value)
  }
  return accounts
}

const fetchLookupTables = async (
  call: JsonRpc,
  lookups: MessageAddressTableLookup[],
  network: Network
): Promise<AltAccounts> => {
  const tables = [...new Set(lookups.map((l) => l.accountKey.toBase58()))]
  if (tables.length === 0) return {}
  const accounts = await getAccounts(call, tables)
  return Object.fromEntries(
    tables.map((table, i) => {
      const account = accounts[i]
      if (!account) throw new TxImportError('not-found', `Address lookup table ${table} was not found on ${network}`)
      const state = AddressLookupTableAccount.deserialize(Buffer.from(account.data[0], 'base64'))
      return [table, state.addresses.map((a) => a.toBase58())]
    })
  )
}

/** The tables of a landed transaction, filled from its loaded addresses at the indexes it used; null if they disagree. */
const tablesFromLoaded = (lookups: MessageAddressTableLookup[], loaded: LoadedAddresses): AltAccounts | null => {
  const tables: AltAccounts = {}
  const fill = (key: 'writableIndexes' | 'readonlyIndexes', addresses: string[]) => {
    let next = 0
    for (const lookup of lookups) {
      const table = (tables[lookup.accountKey.toBase58()] ??= [])
      for (const index of lookup[key]) table[index] = addresses[next++]
    }
    return next === addresses.length && addresses.every(Boolean)
  }
  return fill('writableIndexes', loaded.writable) && fill('readonlyIndexes', loaded.readonly) ? tables : null
}

async function fetchBySignature(signature: string, rpc: ImportRpc, network?: Network): Promise<FetchedTransaction> {
  const networks = network ? [network] : SEARCH_ORDER
  const failures: string[] = []
  for (const candidate of networks) {
    let result: FetchedResult
    try {
      result = await rpc[candidate]<FetchedResult>('getTransaction', [
        signature,
        { encoding: 'base64', maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
      ])
    } catch (error) {
      const unsupported = unsupportedVersion(error)
      if (unsupported) throw unsupported
      failures.push(`${candidate}: ${errorMessage(error)}`)
      continue
    }
    if (!result) continue

    const { signatures, message } = splitTransaction(new Uint8Array(Buffer.from(result.transaction[0], 'base64')))
    const lookups = VersionedMessage.deserialize(message).addressTableLookups
    const loaded = result.meta?.loadedAddresses
    const altAccounts =
      (loaded && tablesFromLoaded(lookups, loaded)) || (await fetchLookupTables(rpc[candidate], lookups, candidate))
    return {
      network: candidate,
      source: { signature },
      message,
      signatures,
      serialized: false,
      altAccounts,
      execution: result.meta,
      slot: result.slot,
    }
  }
  const tried = networks.join(' or ')
  throw new TxImportError(
    'not-found',
    `Transaction not found on ${tried}${failures.length ? ` (${failures.join('; ')})` : ''}`
  )
}

const tokenAccount = (account: RpcAccount | null) => {
  if (!account || !TOKEN_PROGRAMS.includes(account.owner)) return null
  const data = Buffer.from(account.data[0], 'base64')
  // Token-2022 mints with extensions are longer than an account too; byte 165 tells them apart.
  if (data.length < TOKEN_ACCOUNT_SIZE || (data.length > TOKEN_ACCOUNT_SIZE && data[165] !== TOKEN_2022_ACCOUNT_TYPE)) {
    return null
  }
  if (data[108] === 0) return null // uninitialized
  const amount = new DataView(data.buffer, data.byteOffset + 64, 8).getBigUint64(0, true)
  return {
    mint: bs58.encode(data.subarray(0, 32)),
    owner: bs58.encode(data.subarray(32, 64)),
    amount: amount.toString(),
    programId: account.owner,
  }
}

/**
 * Fills what a simulation may lack (older RPCs): the fee from getFeeForMessage, SOL and token balances from the
 * writable accounts before (getMultipleAccounts) and after (the simulation's `accounts`) the transaction.
 */
async function completeSimulation(
  value: Simulation['value'],
  call: JsonRpc,
  message: Uint8Array,
  keys: string[],
  writable: string[]
): Promise<RpcExecution> {
  const execution: Simulation['value'] = { ...value }
  delete execution.accounts
  if (execution.fee == null) {
    try {
      const fee = await call<{ value: number | null }>('getFeeForMessage', [
        base64(message),
        { commitment: 'confirmed' },
      ])
      execution.fee = fee.value
    } catch {
      // The fee stays unknown.
    }
  }
  const needSol = !execution.preBalances || !execution.postBalances
  const needTokens = !execution.preTokenBalances || !execution.postTokenBalances
  if (!needSol && !needTokens) return execution

  let before: (RpcAccount | null)[]
  try {
    before = await getAccounts(call, writable)
  } catch {
    return execution
  }
  const after = value.accounts?.length === writable.length ? value.accounts : before

  if (needSol) {
    // Read-only accounts cannot change: they count as 0 before and after.
    const lamports = (accounts: (RpcAccount | null)[]) => {
      const byKey = new Map(writable.map((key, i) => [key, accounts[i]?.lamports ?? 0]))
      return keys.map((key) => byKey.get(key) ?? 0)
    }
    execution.preBalances = lamports(before)
    execution.postBalances = lamports(after)
  }
  if (needTokens) {
    const preTokens = before.map(tokenAccount)
    const postTokens = after.map(tokenAccount)
    const mints = [...new Set([...preTokens, ...postTokens].flatMap((t) => (t ? [t.mint] : [])))]
    const decimals = new Map<string, number>()
    try {
      const accounts = await getAccounts(call, mints, { dataSlice: { offset: MINT_DECIMALS_OFFSET, length: 1 } })
      accounts.forEach((account, i) => account && decimals.set(mints[i], Buffer.from(account.data[0], 'base64')[0]))
    } catch {
      // Unknown decimals read as 0.
    }
    const balances = (tokens: ReturnType<typeof tokenAccount>[]): TokenBalance[] =>
      tokens.flatMap((token, i) =>
        token
          ? [
              {
                accountIndex: keys.indexOf(writable[i]),
                mint: token.mint,
                owner: token.owner,
                uiTokenAmount: { amount: token.amount, decimals: decimals.get(token.mint) ?? 0 },
              },
            ]
          : []
      )
    execution.preTokenBalances = balances(preTokens)
    execution.postTokenBalances = balances(postTokens)
  }
  return execution
}

async function simulateSerialized(
  input: Extract<DetectedInput, { kind: 'serialized' }>,
  rpc: ImportRpc,
  network: Network
): Promise<FetchedTransaction> {
  const call = rpc[network]
  const message = VersionedMessage.deserialize(input.message)
  const altAccounts = await fetchLookupTables(call, message.addressTableLookups, network)
  const loaded = (indexes: 'writableIndexes' | 'readonlyIndexes') =>
    message.addressTableLookups.flatMap((l) => l[indexes].map((i) => altAccounts[l.accountKey.toBase58()][i]))
  const statics = message.staticAccountKeys.map((k) => k.toBase58())
  const keys = [...statics, ...loaded('writableIndexes'), ...loaded('readonlyIndexes')]
  const writable = keys.filter((_, i) => message.isAccountWritable(i))

  const fetched: FetchedTransaction = {
    network,
    source: { serialized: base64(input.bytes) },
    message: input.message,
    signatures: input.signatures,
    serialized: true,
    altAccounts,
    execution: null,
  }
  let simulation: Simulation
  try {
    simulation = await call<Simulation>('simulateTransaction', [
      base64(input.bytes),
      {
        encoding: 'base64',
        sigVerify: false,
        replaceRecentBlockhash: true,
        innerInstructions: true,
        commitment: 'confirmed',
        accounts: { encoding: 'base64', addresses: writable },
      },
    ])
  } catch (error) {
    return { ...fetched, simulationError: errorMessage(error) }
  }
  const execution = await completeSimulation(simulation.value, call, input.message, keys, writable)
  return { ...fetched, execution, slot: simulation.context?.slot }
}

/**
 * Fetches a transaction by signature (on `network`, else mainnet then devnet) or simulates a serialized one (on
 * `network`, else mainnet). Throws TxImportError (not found) or UnsupportedTransactionVersionError.
 */
export async function fetchTransaction(
  input: DetectedInput,
  options: { rpc: ImportRpc; network?: Network }
): Promise<FetchedTransaction> {
  if (input.kind === 'signature') return fetchBySignature(input.signature, options.rpc, options.network)
  return simulateSerialized(input, options.rpc, options.network ?? 'MAINNET')
}
