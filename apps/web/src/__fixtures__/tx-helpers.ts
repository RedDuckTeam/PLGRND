import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Buffer } from 'buffer'
import bs58 from 'bs58'
import { PublicKey, VersionedMessage } from '@solana/web3.js'
import {
  FOUNDATION_IDL_AUTHORITY,
  anchorIdlAddress,
  pmpAuthorityAddress,
  pmpCanonicalAddress,
} from '@/utils/idl/sources/addresses'
import { decodeAnchorIdlAccount } from '@/utils/idl/sources/anchor-account'
import { parseMetadataAccount, readMetadataContent } from '@/utils/idl/sources/program-metadata'

export const FIXTURES_DIR = path.dirname(fileURLToPath(import.meta.url))

export interface FixtureInstruction {
  /** `top#n` or `inner#<top index>.<n>`. */
  where: string
  programId: string
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[]
  data: Uint8Array
}

// Fetched transactions reference keys by index; simulations (serialized inputs) by address and may be jsonParsed.
type InnerInstruction =
  | { programIdIndex: number; accounts: number[]; data: string }
  | { programId: string; accounts?: string[]; data?: string; parsed?: unknown }

interface TxExecution {
  loadedAddresses?: { writable: string[]; readonly: string[] }
  innerInstructions?: { index: number; instructions: InnerInstruction[] }[] | null
}

interface TxFixture {
  name: string
  network: 'mainnet' | 'devnet'
  /** The exact input string: a signature or a serialized transaction. */
  input: { kind: 'signature' | 'serialized'; value: string; encoding?: 'base64' | 'base58' }
  slot?: number
  wire: string
  /** base58, all `1`s for an empty slot. */
  signatures?: string[]
  altAccounts?: Record<string, string[]>
  meta?: TxExecution | null
  simulation?: TxExecution | null
  accounts?: Record<string, string>
}

export const txFixtureNames = () =>
  fs
    .readdirSync(path.join(FIXTURES_DIR, 'tx'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))

export const loadTxFixture = (name: string): TxFixture =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'tx', `${name}.json`), 'utf8'))

/** Every top-level and inner instruction of a fixture, with resolved keys and signer/writable flags. */
export function fixtureInstructions(name: string): FixtureInstruction[] {
  const fx = loadTxFixture(name)
  const execution = fx.meta ?? fx.simulation
  const message = VersionedMessage.deserialize(Buffer.from(fx.wire, 'base64'))
  const loaded = execution?.loadedAddresses ?? { writable: [], readonly: [] }
  const statics = message.staticAccountKeys.map((k) => k.toBase58())
  const keys = [...statics, ...loaded.writable, ...loaded.readonly]
  const { numRequiredSignatures, numReadonlySignedAccounts, numReadonlyUnsignedAccounts } = message.header
  const meta = (i: number) => ({
    pubkey: keys[i],
    isSigner: i < numRequiredSignatures,
    isWritable:
      i >= statics.length
        ? i - statics.length < loaded.writable.length
        : i < numRequiredSignatures
          ? i < numRequiredSignatures - numReadonlySignedAccounts
          : i < statics.length - numReadonlyUnsignedAccounts,
  })
  const out: FixtureInstruction[] = message.compiledInstructions.map((ix, n) => ({
    where: `top#${n}`,
    programId: keys[ix.programIdIndex],
    accounts: ix.accountKeyIndexes.map(meta),
    data: new Uint8Array(ix.data),
  }))
  const indexOf = (address: string) => keys.indexOf(address)
  for (const inner of execution?.innerInstructions ?? []) {
    inner.instructions.forEach((ix, n) => {
      const where = `inner#${inner.index}.${n}`
      if ('programIdIndex' in ix) {
        out.push({
          where,
          programId: keys[ix.programIdIndex],
          accounts: ix.accounts.map(meta),
          data: bs58.decode(ix.data),
        })
      } else if (ix.data !== undefined) {
        // Inner instructions inherit the transaction's privileges for the keys they pass.
        out.push({
          where,
          programId: ix.programId,
          accounts: (ix.accounts ?? []).map((a) => meta(indexOf(a))),
          data: bs58.decode(ix.data),
        })
      }
    })
  }
  return out
}

const readAccount = (address: string): Uint8Array | null => {
  const file = path.join(FIXTURES_DIR, 'accounts', `${address}.b64`)
  return fs.existsSync(file) ? new Uint8Array(Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64')) : null
}

/** A program's raw IDL JSON from the captured accounts (PMP canonical → Foundation PMP → Anchor), or null. */
export async function fixtureIdl(programId: string): Promise<unknown | null> {
  const program = new PublicKey(programId)
  const fetchAccount = async (address: string) => readAccount(address)
  for (const address of [pmpCanonicalAddress(program), pmpAuthorityAddress(program, FOUNDATION_IDL_AUTHORITY)]) {
    const data = readAccount(address.toBase58())
    if (data) return JSON.parse(await readMetadataContent(parseMetadataAccount(data), { fetchAccount }))
  }
  const anchor = readAccount((await anchorIdlAddress(program)).toBase58())
  return anchor ? JSON.parse(await decodeAnchorIdlAccount(anchor)) : null
}

/** A third-party IDL from the gitignored cache (scripts/fetch-upstream-idls.mjs), or null when it was not fetched. */
export function upstreamIdl(name: string): unknown | null {
  const file = path.join(FIXTURES_DIR, '.cache', `${name}.json`)
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null
}
