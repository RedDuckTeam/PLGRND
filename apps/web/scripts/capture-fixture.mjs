// Dev-only: captures a transaction (by signature or serialized) plus the raw IDL account bytes of every program it
// invokes, so importer / IDL-resolver tests run offline.
//
//   node apps/web/scripts/capture-fixture.mjs <signature|base64|base58> --cluster mainnet|devnet [--name <name>]
//
// Writes src/__fixtures__/tx/<name>.json; raw accounts go to src/__fixtures__/accounts/<address>.b64 (shared between
// fixtures). Set RPC_URL to override the public endpoint.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { AddressLookupTableAccount, PublicKey, VersionedTransaction } from '@solana/web3.js'
import bs58 from 'bs58'

export const FIXTURES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/__fixtures__')
export const RPC_URLS = {
  mainnet: 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
}
export const PMP_PROGRAM_ID = new PublicKey('ProgM6JCCvbYkfKqJYHePx4xxSUSqJp7rh8Lyv7nk7S')
export const FOUNDATION_AUTHORITY = new PublicKey('fndnu15PLXELbLsTqrfbiweBvsBj2o12RoVfkeCCbX2')
// Limits apply to the stored files: an account's .b64 file and a fixture's .json file.
export const MAX_ACCOUNT_FILE_BYTES = 280 * 1024
export const MAX_FIXTURE_FILE_BYTES = 300 * 1024

const MIN_REQUEST_GAP_MS = 300
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let lastRequestAt = 0

// Sequential, throttled JSON-RPC call with exponential backoff on 429 / 5xx / network errors.
export async function rpc(url, method, params, { retries = 6 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const wait = lastRequestAt + MIN_REQUEST_GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastRequestAt = Date.now()
    let retryable
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      })
      if (res.status === 429 || res.status >= 500) {
        retryable = new Error(`${method}: HTTP ${res.status}`)
        const retryAfter = Number(res.headers.get('retry-after'))
        if (retryAfter > 0 && attempt < retries) await sleep(retryAfter * 1000)
      } else {
        const body = await res.json()
        if (!body.error) return body.result
        if (body.error.code === 429 || /rate limit|too many requests/i.test(body.error.message)) {
          retryable = new Error(`${method}: ${body.error.message}`)
        } else {
          const error = new Error(`${method}: ${body.error.message}`)
          error.rpcError = body.error
          throw error
        }
      }
    } catch (error) {
      if (error.rpcError) throw error
      retryable = error
    }
    if (attempt >= retries) throw retryable
    await sleep(1000 * 2 ** attempt)
  }
}

// Signature = base58 of exactly 64 bytes; otherwise a serialized transaction in base64 or base58.
export function parseInput(value) {
  const trimmed = value.trim()
  try {
    if (bs58.decode(trimmed).length === 64) return { kind: 'signature', value: trimmed }
  } catch {
    // not base58
  }
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed) && trimmed.length % 4 === 0) {
    const bytes = Buffer.from(trimmed, 'base64')
    try {
      VersionedTransaction.deserialize(bytes)
      return { kind: 'serialized', encoding: 'base64', value: trimmed, bytes }
    } catch {
      // fall through to base58
    }
  }
  try {
    const bytes = Buffer.from(bs58.decode(trimmed))
    VersionedTransaction.deserialize(bytes)
    return { kind: 'serialized', encoding: 'base58', value: trimmed, bytes }
  } catch {
    throw new Error('Input is neither a transaction signature nor a serialized transaction (base64 / base58)')
  }
}

function decodeShortU16(bytes) {
  let value = 0
  for (let i = 0; i < 3; i++) {
    const byte = bytes[i]
    value |= (byte & 0x7f) << (7 * i)
    if ((byte & 0x80) === 0) return [value, i + 1]
  }
  throw new Error('Bad compact-u16')
}

// Original wire bytes split into signatures and message, so the fixture keeps the exact message bytes.
export function splitTransaction(bytes) {
  const [count, offset] = decodeShortU16(bytes)
  const signatures = []
  for (let i = 0; i < count; i++) signatures.push(bs58.encode(bytes.subarray(offset + 64 * i, offset + 64 * (i + 1))))
  return { signatures, message: bytes.subarray(offset + 64 * count) }
}

function seed16(text) {
  const seed = new Uint8Array(16)
  seed.set(new TextEncoder().encode(text))
  return seed
}

// The three places an IDL can live on chain for a program.
export async function idlAccountAddresses(programId) {
  const program = new PublicKey(programId)
  const seed = seed16('idl')
  const [pmpCanonical] = PublicKey.findProgramAddressSync([program.toBytes(), seed], PMP_PROGRAM_ID)
  const [pmpFoundation] = PublicKey.findProgramAddressSync(
    [program.toBytes(), FOUNDATION_AUTHORITY.toBytes(), seed],
    PMP_PROGRAM_ID
  )
  const [base] = PublicKey.findProgramAddressSync([], program)
  const anchorIdl = await PublicKey.createWithSeed(base, 'anchor:idl', program)
  return [
    { kind: 'pmp-canonical', address: pmpCanonical.toBase58() },
    { kind: 'pmp-foundation', address: pmpFoundation.toBase58() },
    { kind: 'anchor-idl', address: anchorIdl.toBase58() },
  ]
}

async function fetchAltAccounts(rpcUrl, message) {
  const tables = message.addressTableLookups.map((lookup) => lookup.accountKey.toBase58())
  const altAccounts = {}
  if (tables.length === 0) return altAccounts
  const result = await rpc(rpcUrl, 'getMultipleAccounts', [tables, { encoding: 'base64', commitment: 'confirmed' }])
  result.value.forEach((info, i) => {
    if (!info) return
    const state = AddressLookupTableAccount.deserialize(Buffer.from(info.data[0], 'base64'))
    altAccounts[tables[i]] = state.addresses.map((key) => key.toBase58())
  })
  return altAccounts
}

function loadedFromAlts(message, altAccounts) {
  const loaded = { writable: [], readonly: [] }
  for (const lookup of message.addressTableLookups) {
    const table = altAccounts[lookup.accountKey.toBase58()]
    if (!table) throw new Error(`Address lookup table ${lookup.accountKey.toBase58()} not found`)
    loaded.writable.push(...lookup.writableIndexes.map((i) => table[i]))
  }
  for (const lookup of message.addressTableLookups) {
    const table = altAccounts[lookup.accountKey.toBase58()]
    loaded.readonly.push(...lookup.readonlyIndexes.map((i) => table[i]))
  }
  return loaded
}

// Top-level and inner programs, plus anything the logs show as invoked (covers truncated inner lists on failure).
export function invokedPrograms(message, accountKeys, innerInstructions, logs) {
  const programs = new Set()
  for (const ix of message.compiledInstructions) programs.add(accountKeys[ix.programIdIndex])
  for (const inner of innerInstructions ?? []) {
    for (const ix of inner.instructions) programs.add(ix.programId ?? accountKeys[ix.programIdIndex])
  }
  for (const line of logs ?? []) {
    const match = /^Program (\w{32,44}) invoke \[\d+\]$/.exec(line)
    if (match) programs.add(match[1])
  }
  return [...programs].filter(Boolean)
}

async function fetchIdlAccounts(rpcUrl, programs, fixturesDir, notes) {
  const accounts = {}
  const accountMeta = {}
  const skippedAccounts = []
  fs.mkdirSync(path.join(fixturesDir, 'accounts'), { recursive: true })
  for (const program of programs) {
    const candidates = await idlAccountAddresses(program)
    const result = await rpc(rpcUrl, 'getMultipleAccounts', [
      candidates.map((c) => c.address),
      { encoding: 'base64', commitment: 'confirmed' },
    ])
    result.value.forEach((info, i) => {
      if (!info) return
      const { kind, address } = candidates[i]
      const data = info.data[0]
      const meta = {
        program,
        kind,
        owner: info.owner,
        lamports: info.lamports,
        size: Buffer.byteLength(data, 'base64'),
      }
      if (data.length > MAX_ACCOUNT_FILE_BYTES) {
        skippedAccounts.push({ address, ...meta, reason: `base64 data ${data.length} B > ${MAX_ACCOUNT_FILE_BYTES} B` })
        notes.push(`skipped ${kind} account ${address} of ${program}: too large (${meta.size} B raw)`)
        return
      }
      // Shared files are never overwritten with different bytes (other fixtures, or the other cluster, use them).
      let file = `${address}.b64`
      const existing = path.join(fixturesDir, 'accounts', file)
      if (fs.existsSync(existing) && fs.readFileSync(existing, 'utf8') !== data) {
        file = `${address}.${createHash('sha256').update(data).digest('hex').slice(0, 8)}.b64`
        notes.push(`${address} differs from the stored copy; wrote ${file}`)
      }
      fs.writeFileSync(path.join(fixturesDir, 'accounts', file), data)
      accounts[address] = file
      accountMeta[address] = meta
    })
  }
  return { accounts, accountMeta, skippedAccounts }
}

async function formatJson(json, file) {
  try {
    const prettier = await import('prettier')
    const options = (await prettier.resolveConfig(file)) ?? {}
    return await prettier.format(json, { ...options, parser: 'json' })
  } catch {
    return json
  }
}

export async function captureFixture({ input, cluster = 'mainnet', name, rpcUrl, fixturesDir = FIXTURES_DIR }) {
  const url = rpcUrl ?? RPC_URLS[cluster]
  if (!url) throw new Error(`Unknown cluster ${cluster}`)
  const parsed = parseInput(input)
  const notes = []
  let bytes
  let result = {}

  if (parsed.kind === 'signature') {
    const tx = await rpc(url, 'getTransaction', [
      parsed.value,
      { encoding: 'base64', maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
    ])
    if (!tx) throw new Error(`Transaction ${parsed.value} not found on ${cluster}`)
    bytes = Buffer.from(tx.transaction[0], 'base64')
    result = { slot: tx.slot, blockTime: tx.blockTime, meta: tx.meta }
  } else {
    bytes = parsed.bytes
  }

  const transaction = VersionedTransaction.deserialize(bytes)
  const { message } = transaction
  const { signatures, message: messageBytes } = splitTransaction(bytes)
  if (!Buffer.from(message.serialize()).equals(Buffer.from(messageBytes))) {
    notes.push('web3.js re-serialization differs from the original message bytes')
  }
  const altAccounts = await fetchAltAccounts(url, message)

  let loaded
  if (parsed.kind === 'signature') {
    loaded = result.meta.loadedAddresses ?? { writable: [], readonly: [] }
    const fromAlts = message.addressTableLookups.every((l) => altAccounts[l.accountKey.toBase58()])
      ? loadedFromAlts(message, altAccounts)
      : undefined
    if (!fromAlts && message.addressTableLookups.length > 0) notes.push('some lookup tables no longer exist')
    const same = (a, b) => a.length === b.length && a.every((key, i) => key === b[i])
    if (fromAlts && !(same(fromAlts.writable, loaded.writable) && same(fromAlts.readonly, loaded.readonly))) {
      notes.push('current lookup table contents differ from meta.loadedAddresses')
    }
  } else {
    loaded = loadedFromAlts(message, altAccounts)
    const base64Tx = Buffer.from(bytes).toString('base64')
    try {
      const sim = await rpc(url, 'simulateTransaction', [
        base64Tx,
        {
          sigVerify: false,
          replaceRecentBlockhash: true,
          innerInstructions: true,
          encoding: 'base64',
          commitment: 'confirmed',
        },
      ])
      result = { slot: sim.context.slot, simulation: sim.value }
    } catch (error) {
      if (!error.rpcError) throw error
      result = { simulation: { rpcError: error.rpcError } }
      notes.push(`simulation rejected by RPC: ${error.rpcError.message}`)
    }
  }

  const accountKeys = [
    ...message.staticAccountKeys.map((key) => key.toBase58()),
    ...loaded.writable,
    ...loaded.readonly,
  ]
  const meta = result.meta ?? result.simulation
  const programs = invokedPrograms(message, accountKeys, meta?.innerInstructions, meta?.logMessages ?? meta?.logs)
  const { accounts, accountMeta, skippedAccounts } = await fetchIdlAccounts(url, programs, fixturesDir, notes)

  const fixtureName = name ?? (parsed.kind === 'signature' ? parsed.value.slice(0, 12) : `serialized-${signatures[0]}`)
  const fixture = {
    name: fixtureName,
    network: cluster,
    input:
      parsed.kind === 'signature'
        ? { kind: 'signature', value: parsed.value }
        : { kind: 'serialized', encoding: parsed.encoding, value: parsed.value },
    version: message.version,
    capturedAt: new Date().toISOString(),
    ...(result.slot !== undefined && { slot: result.slot }),
    ...(result.blockTime !== undefined && { blockTime: result.blockTime }),
    wire: Buffer.from(messageBytes).toString('base64'),
    signatures,
    ...(result.meta ? { meta: result.meta } : { simulation: result.simulation }),
    altAccounts,
    programs,
    accounts,
    accountMeta,
    ...(skippedAccounts.length > 0 && { skippedAccounts }),
    ...(notes.length > 0 && { notes }),
  }

  const file = path.join(fixturesDir, 'tx', `${fixtureName}.json`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const json = await formatJson(JSON.stringify(fixture, null, 2) + '\n', file)
  fs.writeFileSync(file, json)
  if (Buffer.byteLength(json) > MAX_FIXTURE_FILE_BYTES) notes.push(`fixture is ${Buffer.byteLength(json)} B (> 300 kB)`)
  return { file, fixture, notes }
}

function parseArgs(argv) {
  const args = { cluster: 'mainnet' }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--cluster') args.cluster = argv[++i]
    else if (argv[i] === '--name') args.name = argv[++i]
    else if (!args.input) args.input = argv[i]
  }
  return args
}

async function main() {
  const { input, cluster, name } = parseArgs(process.argv.slice(2))
  if (!input || !['mainnet', 'devnet'].includes(cluster)) {
    console.error('Usage: capture-fixture.mjs <signature|base64|base58> --cluster mainnet|devnet [--name <name>]')
    process.exit(1)
  }
  const { file, fixture, notes } = await captureFixture({ input, cluster, name, rpcUrl: process.env.RPC_URL })
  console.log(`wrote ${path.relative(process.cwd(), file)}`)
  console.log(`programs: ${fixture.programs.length}, idl accounts: ${Object.keys(fixture.accounts).length}`)
  for (const note of notes) console.log(`note: ${note}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
