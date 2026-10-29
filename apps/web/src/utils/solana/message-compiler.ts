import { Buffer } from 'buffer'
import bs58 from 'bs58'
import {
  AddressLookupTableAccount,
  Message,
  MessageV0,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  type MessageHeader,
} from '@solana/web3.js'

export type MessageVersion = 'legacy' | 0

export type MessageAccountMeta = { pubkey: string; isSigner: boolean; isWritable: boolean }

export type MessageInstruction = { programId: string; metas: MessageAccountMeta[]; data: Uint8Array }

/** One address lookup table of a v0 message: indexes into the table, writable ones first. */
export type MessageLookup = { table: string; writable: number[]; readonly: number[] }

/** Lookup table address → its addresses in table order. */
export type AltAccounts = Record<string, string[]>

/** Plain JSON that lets compileMessage rebuild an unedited message byte for byte (key order, lookup indexes). */
export type MessageHints = {
  version: MessageVersion
  header: MessageHeader
  staticKeys: string[]
  lookups: MessageLookup[]
  /** Indexes into `staticKeys` of the invoked programs. */
  programs: number[]
}

export type DecompiledMessage = {
  version: MessageVersion
  header: MessageHeader
  staticKeys: string[]
  lookups: MessageLookup[]
  recentBlockhash: string
  instructions: MessageInstruction[]
  hints: MessageHints
}

export type MessageDraft = {
  version: MessageVersion
  feePayer: string
  instructions: MessageInstruction[]
  /** v0 only: the lookup tables the compiler may load keys from. */
  lookupTables?: string[]
}

export class UnsupportedTransactionVersionError extends Error {
  readonly version: number

  constructor(version: number) {
    super(`Transaction version ${version} is not supported: only legacy and version 0 messages are`)
    this.name = 'UnsupportedTransactionVersionError'
    this.version = version
  }
}

const VERSION_PREFIX_MASK = 0x7f
const MAX_SLOT = 0xffffffffffffffffn

/** The version of serialized message bytes, read from the prefix byte; versions other than 0 are rejected. */
export function messageVersion(bytes: Uint8Array): MessageVersion {
  if (bytes.length === 0) throw new Error('The message is empty')
  const prefix = bytes[0]
  if ((prefix & VERSION_PREFIX_MASK) === prefix) return 'legacy'
  const version = prefix & VERSION_PREFIX_MASK
  if (version !== 0) throw new UnsupportedTransactionVersionError(version)
  return 0
}

const tableAddresses = (table: string, altAccounts: AltAccounts): string[] => {
  const addresses = altAccounts[table]
  if (!addresses) throw new Error(`Address lookup table ${table} is not loaded`)
  return addresses
}

// Loaded keys follow the static keys: every table's writable indexes, then every table's readonly indexes.
const loadedAddresses = (lookups: MessageLookup[], altAccounts: AltAccounts) => {
  const resolve = (table: string, indexes: number[]) => {
    const addresses = tableAddresses(table, altAccounts)
    return indexes.map((index) => {
      if (index >= addresses.length) {
        throw new Error(`Index ${index} is out of range of address lookup table ${table} (${addresses.length} keys)`)
      }
      return addresses[index]
    })
  }
  return {
    writable: lookups.flatMap((l) => resolve(l.table, l.writable)),
    readonly: lookups.flatMap((l) => resolve(l.table, l.readonly)),
  }
}

const isWritableIndex = (header: MessageHeader, staticCount: number, writableLoaded: number, index: number) => {
  if (index >= staticCount) return index - staticCount < writableLoaded
  if (index < header.numRequiredSignatures)
    return index < header.numRequiredSignatures - header.numReadonlySignedAccounts
  return index < staticCount - header.numReadonlyUnsignedAccounts
}

/**
 * Splits serialized message bytes into instructions with resolved keys and the signer/writable flags the message
 * gives them (header for static keys, lookup section for loaded ones). `altAccounts` must hold every lookup table.
 */
export function decompileMessage(bytes: Uint8Array, altAccounts: AltAccounts = {}): DecompiledMessage {
  const version = messageVersion(bytes)
  const message = version === 'legacy' ? Message.from(Buffer.from(bytes)) : MessageV0.deserialize(bytes)
  if (message.serialize().length !== bytes.length) throw new Error('Unexpected bytes after the end of the message')

  const header = { ...message.header }
  const staticKeys = message.staticAccountKeys.map((k) => k.toBase58())
  const lookups = message.addressTableLookups.map((l) => ({
    table: l.accountKey.toBase58(),
    writable: [...l.writableIndexes],
    readonly: [...l.readonlyIndexes],
  }))
  const loaded = loadedAddresses(lookups, altAccounts)
  const keys = [...staticKeys, ...loaded.writable, ...loaded.readonly]
  const key = (index: number) => {
    if (index >= keys.length) throw new Error(`Account index ${index} is out of range (${keys.length} keys)`)
    return keys[index]
  }
  const meta = (index: number): MessageAccountMeta => ({
    pubkey: key(index),
    isSigner: index < header.numRequiredSignatures,
    isWritable: isWritableIndex(header, staticKeys.length, loaded.writable.length, index),
  })

  const instructions = message.compiledInstructions.map((ix) => ({
    programId: key(ix.programIdIndex),
    metas: ix.accountKeyIndexes.map(meta),
    data: new Uint8Array(ix.data),
  }))
  const programs = [...new Set(message.compiledInstructions.map((ix) => ix.programIdIndex))].sort((a, b) => a - b)

  return {
    version,
    header,
    staticKeys,
    lookups,
    recentBlockhash: message.recentBlockhash,
    instructions,
    hints: {
      version,
      header: { ...header },
      staticKeys: [...staticKeys],
      lookups: lookups.map((l) => ({ ...l, writable: [...l.writable], readonly: [...l.readonly] })),
      programs,
    },
  }
}

const sameSet = (a: Iterable<string>, b: Iterable<string>) => {
  const left = new Set(a)
  const right = new Set(b)
  return left.size === right.size && [...left].every((x) => right.has(x))
}

// Message-level flags: the fee payer signs and is writable; a key's flags are the union over its metas.
const draftKeyFlags = (draft: MessageDraft) => {
  const flags = new Map<string, { isSigner: boolean; isWritable: boolean }>()
  const add = (pubkey: string, isSigner: boolean, isWritable: boolean) => {
    const current = flags.get(pubkey)
    flags.set(pubkey, {
      isSigner: (current?.isSigner ?? false) || isSigner,
      isWritable: (current?.isWritable ?? false) || isWritable,
    })
  }
  add(draft.feePayer, true, true)
  for (const ix of draft.instructions) {
    add(ix.programId, false, false)
    for (const m of ix.metas) add(m.pubkey, m.isSigner, m.isWritable)
  }
  return flags
}

/**
 * The hinted layout, if it encodes the draft exactly: same version, lookup tables, invoked programs, and the
 * same keys with the same flags, where every hinted lookup index still resolves to a key the draft needs.
 */
const replayHints = (
  draft: MessageDraft,
  blockhash: string,
  altAccounts: AltAccounts,
  hints: MessageHints
): Uint8Array | null => {
  if (draft.version !== hints.version || hints.staticKeys[0] !== draft.feePayer) return null
  const tables = draft.version === 0 ? (draft.lookupTables ?? []) : []
  const hintedTables = hints.lookups.map((l) => l.table)
  if (!sameSet(tables, hintedTables)) return null
  // Programs are always static keys.
  const hintedPrograms = hints.programs.map((i) => hints.staticKeys[i] ?? '')
  const programs = draft.instructions.map((ix) => ix.programId)
  if (!sameSet(hintedPrograms, programs)) return null

  let loaded: { writable: string[]; readonly: string[] }
  try {
    loaded = loadedAddresses(hints.lookups, altAccounts)
  } catch {
    return null
  }
  const keys = [...hints.staticKeys, ...loaded.writable, ...loaded.readonly]
  const wanted = draftKeyFlags(draft)
  if (new Set(keys).size !== keys.length || wanted.size !== keys.length) return null
  for (const [index, key] of keys.entries()) {
    const flags = wanted.get(key)
    if (
      !flags ||
      flags.isSigner !== index < hints.header.numRequiredSignatures ||
      flags.isWritable !== isWritableIndex(hints.header, hints.staticKeys.length, loaded.writable.length, index)
    ) {
      return null
    }
  }

  const position = new Map(keys.map((key, index) => [key, index]))
  const compiled = draft.instructions.map((ix) => ({
    programIdIndex: position.get(ix.programId)!,
    accountKeyIndexes: ix.metas.map((m) => position.get(m.pubkey)!),
    data: ix.data,
  }))
  const header = { ...hints.header }
  if (draft.version === 'legacy') {
    const message = new Message({
      header,
      accountKeys: hints.staticKeys,
      recentBlockhash: blockhash,
      instructions: compiled.map((ix) => ({
        programIdIndex: ix.programIdIndex,
        accounts: ix.accountKeyIndexes,
        data: bs58.encode(ix.data),
      })),
    })
    return Uint8Array.from(message.serialize())
  }
  return new MessageV0({
    header,
    staticAccountKeys: hints.staticKeys.map((k) => new PublicKey(k)),
    recentBlockhash: blockhash,
    compiledInstructions: compiled,
    addressTableLookups: hints.lookups.map((l) => ({
      accountKey: new PublicKey(l.table),
      writableIndexes: [...l.writable],
      readonlyIndexes: [...l.readonly],
    })),
  }).serialize()
}

export const fromTransactionInstruction = (ix: TransactionInstruction): MessageInstruction => ({
  programId: ix.programId.toBase58(),
  metas: ix.keys.map((k) => ({ pubkey: k.pubkey.toBase58(), isSigner: k.isSigner, isWritable: k.isWritable })),
  data: new Uint8Array(ix.data),
})

const toTransactionInstruction = (ix: MessageInstruction) =>
  new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.metas.map((m) => ({ pubkey: new PublicKey(m.pubkey), isSigner: m.isSigner, isWritable: m.isWritable })),
    data: Buffer.from(ix.data),
  })

const compileWithWeb3 = (draft: MessageDraft, blockhash: string, altAccounts: AltAccounts): Uint8Array => {
  const instructions = draft.instructions.map(toTransactionInstruction)
  const payerKey = new PublicKey(draft.feePayer)
  if (draft.version === 'legacy') {
    const tx = new Transaction()
    tx.feePayer = payerKey
    tx.recentBlockhash = blockhash
    if (instructions.length > 0) tx.add(...instructions)
    return Uint8Array.from(tx.compileMessage().serialize())
  }
  const tables = (draft.lookupTables ?? []).map(
    (table) =>
      new AddressLookupTableAccount({
        key: new PublicKey(table),
        state: {
          deactivationSlot: MAX_SLOT,
          lastExtendedSlot: 0,
          lastExtendedSlotStartIndex: 0,
          addresses: tableAddresses(table, altAccounts).map((a) => new PublicKey(a)),
        },
      })
  )
  return new TransactionMessage({ payerKey, recentBlockhash: blockhash, instructions })
    .compileToV0Message(tables)
    .serialize()
}

/**
 * Serializes a draft into message bytes. With `hints` from decompileMessage and an unedited draft, the original key
 * order and lookup indexes are replayed (byte-identical message); anything else compiles with web3.js.
 */
export function compileMessage(
  draft: MessageDraft,
  blockhash: string,
  altAccounts: AltAccounts = {},
  hints?: MessageHints
): Uint8Array {
  return (hints && replayHints(draft, blockhash, altAccounts, hints)) || compileWithWeb3(draft, blockhash, altAccounts)
}
