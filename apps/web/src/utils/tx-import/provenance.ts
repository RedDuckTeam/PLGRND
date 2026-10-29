import bs58 from 'bs58'
import { Buffer } from 'buffer'
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import type { ConstantPdaSeedNode, InstructionNode, PdaNode, PdaValueNode, TypeNode } from '@codama/nodes'
import type { AtaTokenProgram } from '@/types/nodes/utils/ata-node'
import { findInstruction, instructionNode, type ProgramIdl } from '@/utils/idl/model/program-idl'
import { resolveType } from '@/utils/idl/model/values'
import { computePda } from '@/utils/node/compute/pda.compute'
import type { DecompiledMessage } from '@/utils/solana/message-compiler'
import type { ImportInstruction, ProgramIdlEntry } from './decode'
import type { RpcExecution } from './trace'

// Value keys: `key:<pubkey>`, `int:<integer>`, `str:<text>`. One value node per key.

/** Where a PDA's program id comes from: the IDL node of that program, or a value node. */
export type PdaProgram = { idl: string } | { value: string }

export type ValueSpec =
  | { kind: 'text'; text: string; signer?: boolean }
  | { kind: 'number'; number: number }
  /** `owner` and `mint` are value keys. */
  | { kind: 'ata'; owner: string; mint: string; tokenProgram: AtaTokenProgram }
  /** `seeds` are value keys, in seed order. */
  | { kind: 'pda'; program: PdaProgram; seeds: string[] }

export interface Provenance {
  /** Value nodes: signers first, then by first use, every node after the nodes it reads. */
  values: Map<string, ValueSpec>
  /** Inputs fed by a value node (see accountUse/argUse) → its key. Every other value stays inline. */
  uses: Map<string, string>
  /** Key of the fee payer's node. */
  feePayer: string
}

export const accountUse = (index: number, position: number) => `${index}:account:${position}`
export const argUse = (index: number, name: string) => `${index}:arg:${name}`
const pubkeyKey = (pubkey: string) => `key:${pubkey}`
const keyValue = (key: string) => key.slice(4)

const TOKEN_PROGRAMS: [AtaTokenProgram, PublicKey][] = [
  ['token', TOKEN_PROGRAM_ID],
  ['token-2022', TOKEN_2022_PROGRAM_ID],
]
// Account names that hint at an ATA owner (`user`, `token_authority`, `wallet`…) or a mint (`mint`, `token_mint_a`…).
const OWNER_NAME = /(owner|authority|wallet|user)$/i
const MINT_NAME = /mint/i
const BIG_INTEGERS = new Set(['u64', 'i64', 'u128', 'i128'])
const FLOATS = new Set(['f32', 'f64'])

type ArgKind = { kind: 'publicKey' } | { kind: 'string' } | { kind: 'int'; big: boolean }

/** Argument types a value node can carry: public keys, strings and integers. */
const argKind = (type: TypeNode, idl: ProgramIdl): ArgKind | null => {
  let resolved: TypeNode
  try {
    resolved = resolveType(type, idl.root)
  } catch {
    return null
  }
  if (resolved.kind === 'publicKeyTypeNode') return { kind: 'publicKey' }
  if (resolved.kind === 'stringTypeNode') return { kind: 'string' }
  if (resolved.kind === 'numberTypeNode' && !FLOATS.has(resolved.format)) {
    return { kind: 'int', big: BIG_INTEGERS.has(resolved.format) }
  }
  return null
}

const isPubkey = (value: string) => {
  try {
    return new PublicKey(value).toBase58() === value
  } catch {
    return false
  }
}

const decodeBytes = (encoding: string, data: string): Uint8Array => {
  switch (encoding) {
    case 'base58':
      return bs58.decode(data)
    case 'base16':
      return new Uint8Array(Buffer.from(data, 'hex'))
    case 'base64':
      return new Uint8Array(Buffer.from(data, 'base64'))
    default:
      return new TextEncoder().encode(data)
  }
}

const NUMBER_WIDTHS: Record<string, number> = { u8: 1, i8: 1, u16: 2, i16: 2, u32: 4, i32: 4, u64: 8, i64: 8 }

const constantSeedBytes = (seed: ConstantPdaSeedNode, programId: string): Uint8Array | null => {
  const value = seed.value
  switch (value.kind) {
    case 'bytesValueNode':
      return decodeBytes(value.encoding, value.data)
    case 'stringValueNode':
      return new TextEncoder().encode(value.string)
    case 'publicKeyValueNode':
      return new PublicKey(value.publicKey).toBytes()
    case 'programIdValueNode':
      return new PublicKey(programId).toBytes()
    case 'numberValueNode': {
      const width = seed.type.kind === 'numberTypeNode' ? NUMBER_WIDTHS[seed.type.format] : undefined
      if (!width) return null
      const bytes = new Uint8Array(8)
      new DataView(bytes.buffer).setBigInt64(0, BigInt(value.number), true)
      return bytes.slice(0, width)
    }
    default:
      return null
  }
}

/** The key whose value a PDA node turns back into `bytes`: a pubkey for 32 bytes, else UTF-8 text. */
const seedKey = (bytes: Uint8Array): string | null => {
  if (bytes.length === 32) return pubkeyKey(bs58.encode(bytes))
  try {
    return `str:${new TextDecoder('utf-8', { fatal: true }).decode(bytes)}`
  } catch {
    return null
  }
}

type PdaCandidate = { program: PdaProgram; seeds: string[]; argSites: Map<string, string> }

/**
 * The PDA node an instruction account's Codama `pdaValueNode` default describes, if every seed can be fed by a
 * value node (constants, other accounts, public key or string arguments) and the derivation reproduces `address`.
 */
function pdaFromDefault(
  address: string,
  value: PdaValueNode,
  idl: ProgramIdl,
  node: InstructionNode,
  ix: ImportInstruction
): PdaCandidate | null {
  const pda: PdaNode | undefined =
    value.pda.kind === 'pdaNode'
      ? value.pda
      : (idl.root.program.pdas ?? []).find((p) => p.name === (value.pda as { name: string }).name)
  if (!pda) return null
  const summary = findInstruction(idl, ix.decoded!.name)!
  const accountAt = (name: string) => {
    const position = (node.accounts ?? []).findIndex((a) => a.name === name)
    return position >= 0 && position < ix.metas.length ? ix.metas[position].pubkey : undefined
  }
  const argSites = new Map<string, string>()
  const contextual = (v: { kind: string; name?: string; publicKey?: string }): string | null => {
    if (v.kind === 'accountValueNode') {
      const pubkey = accountAt(v.name!)
      return pubkey ? pubkeyKey(pubkey) : null
    }
    if (v.kind === 'argumentValueNode') {
      const arg = summary.args.find((a) => a.codamaName === v.name)
      const text = arg && ix.decoded!.args[arg.name]
      const kind = arg && argKind(arg.type, idl)
      if (text === undefined || !kind || kind.kind === 'int') return null
      const key = kind.kind === 'publicKey' ? pubkeyKey(text) : `str:${text}`
      argSites.set(argUse(ix.index, arg.name), key)
      return key
    }
    if (v.kind === 'publicKeyValueNode') return pubkeyKey(v.publicKey!)
    if (v.kind === 'programIdValueNode') return pubkeyKey(idl.programId)
    return null
  }

  let programId = pda.programId ?? idl.programId
  if (value.programId) {
    const key = contextual(value.programId)
    if (!key || !key.startsWith('key:')) return null
    programId = keyValue(key)
  }
  const seeds: string[] = []
  for (const seed of pda.seeds ?? []) {
    let key: string | null
    if (seed.kind === 'constantPdaSeedNode') {
      const bytes = constantSeedBytes(seed, programId)
      key = bytes && seedKey(bytes)
    } else {
      const given = (value.seeds ?? []).find((s) => s.name === seed.name)
      key = given ? contextual(given.value) : null
    }
    if (!key) return null
    seeds.push(key)
  }
  // The PDA node's own derivation (seed order and encoding) must give the same address.
  const inputs: Record<string, unknown> = { programId }
  seeds.forEach((key, i) => (inputs[`seed#${i}`] = keyValue(key)))
  if (computePda({}, inputs).pda !== address) return null
  return {
    program: programId === idl.programId ? { idl: programId } : { value: pubkeyKey(programId) },
    seeds,
    argSites,
  }
}

/**
 * Decides which values of an imported transaction become nodes: signers (fee payer included), ATAs wired from their
 * owner and mint, PDAs from IDL PDA definitions that reproduce the address, and any value used by two or more
 * instructions (integers of 64 bits or more as TEXT, never NUMBER). Everything else stays inline.
 */
export function analyzeProvenance(
  message: DecompiledMessage,
  instructions: ImportInstruction[],
  programs: ReadonlyMap<string, ProgramIdlEntry>,
  execution: RpcExecution | null
): Provenance {
  const signers = message.staticKeys.slice(0, message.header.numRequiredSignatures)
  const signerSet = new Set(signers)

  type Candidate = { instructions: Set<number>; sites: string[]; big: boolean }
  const candidates = new Map<string, Candidate>()
  const addUse = (key: string, index: number, site: string, big = false) => {
    let candidate = candidates.get(key)
    if (!candidate) candidates.set(key, (candidate = { instructions: new Set(), sites: [], big: false }))
    candidate.instructions.add(index)
    candidate.sites.push(site)
    candidate.big ||= big
  }

  const owners = new Set(signers)
  const mints = new Set<string>()
  const accounts = new Set<string>()
  const decodedOf = (ix: ImportInstruction) => {
    const idl = ix.decoded && programs.get(ix.programId)?.idl
    return idl ? { idl, summary: findInstruction(idl, ix.decoded!.name)! } : null
  }

  for (const ix of instructions) {
    const decoded = decodedOf(ix)
    const named = decoded ? decoded.summary.accounts.slice(0, ix.metas.length) : []
    ix.metas.forEach((meta, position) => {
      const account = named[position]
      // The IDL fills in fixed addresses (programs, sysvars) by itself.
      if (account?.defaultAddress === meta.pubkey) return
      if (ix.isolated && !signerSet.has(meta.pubkey)) return
      accounts.add(meta.pubkey)
      addUse(pubkeyKey(meta.pubkey), ix.index, accountUse(ix.index, position))
      if (account && OWNER_NAME.test(account.name)) owners.add(meta.pubkey)
      if (account && MINT_NAME.test(account.name)) mints.add(meta.pubkey)
    })
    if (!decoded || ix.isolated) continue
    for (const arg of decoded.summary.args) {
      const text = ix.decoded!.args[arg.name]
      const kind = argKind(arg.type, decoded.idl)
      if (text === undefined || !kind) continue
      const site = argUse(ix.index, arg.name)
      if (kind.kind === 'publicKey' && isPubkey(text)) addUse(pubkeyKey(text), ix.index, site)
      else if (kind.kind === 'string') addUse(`str:${text}`, ix.index, site)
      else if (kind.kind === 'int' && /^-?\d+$/.test(text)) addUse(`int:${text}`, ix.index, site, kind.big)
    }
  }

  // ATAs: every owner candidate × mint candidate × token program.
  for (const balance of [...(execution?.preTokenBalances ?? []), ...(execution?.postTokenBalances ?? [])]) {
    if (balance.owner) owners.add(balance.owner)
    mints.add(balance.mint)
  }
  const derived = new Map<string, Extract<ValueSpec, { kind: 'ata' }>>()
  for (const owner of owners) {
    for (const mint of mints) {
      for (const [tokenProgram, programId] of TOKEN_PROGRAMS) {
        try {
          const ata = getAssociatedTokenAddressSync(new PublicKey(mint), new PublicKey(owner), true, programId)
          const address = ata.toBase58()
          if (!derived.has(address)) {
            derived.set(address, { kind: 'ata', owner: pubkeyKey(owner), mint: pubkeyKey(mint), tokenProgram })
          }
        } catch {
          // Not a valid owner/mint pair.
        }
      }
    }
  }
  const derivedNodes = new Map<string, ValueSpec>()
  for (const address of accounts) {
    const ata = derived.get(address)
    if (ata && !signerSet.has(address)) derivedNodes.set(pubkeyKey(address), ata)
  }

  // PDAs from Codama `pdaValueNode` defaults of decoded instructions.
  const argSites = new Map<string, string>()
  for (const ix of instructions) {
    const decoded = decodedOf(ix)
    if (!decoded || ix.isolated) continue
    const node = instructionNode(decoded.idl, decoded.summary)
    ix.metas.forEach((meta, position) => {
      const key = pubkeyKey(meta.pubkey)
      const value = node.accounts?.[position]?.defaultValue
      if (value?.kind !== 'pdaValueNode' || signerSet.has(meta.pubkey) || derivedNodes.has(key)) return
      let candidate: PdaCandidate | null = null
      try {
        candidate = pdaFromDefault(meta.pubkey, value, decoded.idl, node, ix)
      } catch {
        // A malformed PDA definition: the address stays a plain value.
      }
      if (!candidate) return
      derivedNodes.set(key, { kind: 'pda', program: candidate.program, seeds: candidate.seeds })
      candidate.argSites.forEach((seedKey, site) => argSites.set(site, seedKey))
    })
  }

  const specFor = (key: string): ValueSpec => {
    if (key.startsWith('key:')) {
      const pubkey = keyValue(key)
      if (signerSet.has(pubkey)) return { kind: 'text', text: pubkey, signer: true }
      return derivedNodes.get(key) ?? { kind: 'text', text: pubkey }
    }
    if (key.startsWith('int:')) {
      const n = Number(keyValue(key))
      return candidates.get(key)?.big || !Number.isSafeInteger(n)
        ? { kind: 'text', text: keyValue(key) }
        : { kind: 'number', number: n }
    }
    return { kind: 'text', text: keyValue(key) }
  }
  const inputsOf = (spec: ValueSpec): string[] =>
    spec.kind === 'ata'
      ? [spec.owner, spec.mint]
      : spec.kind === 'pda'
        ? [...('value' in spec.program ? [spec.program.value] : []), ...spec.seeds]
        : []

  // Order: signers, then first use; a node's inputs come before it. A derived node in a cycle falls back to TEXT.
  const values = new Map<string, ValueSpec>()
  const visiting = new Set<string>()
  const visit = (key: string) => {
    if (values.has(key) || visiting.has(key)) return
    visiting.add(key)
    let spec = specFor(key)
    for (const input of inputsOf(spec)) {
      if (visiting.has(input)) {
        spec = { kind: 'text', text: keyValue(key) }
        break
      }
      visit(input)
    }
    visiting.delete(key)
    values.set(key, spec)
  }
  for (const signer of signers) visit(pubkeyKey(signer))
  for (const [key, candidate] of candidates) {
    if (candidate.instructions.size >= 2 || derivedNodes.has(key)) visit(key)
  }
  for (const key of argSites.values()) visit(key)

  const uses = new Map<string, string>()
  for (const [key, candidate] of candidates) {
    if (values.has(key)) for (const site of candidate.sites) uses.set(site, key)
  }
  for (const [site, key] of argSites) uses.set(site, key)

  return { values, uses, feePayer: pubkeyKey(message.staticKeys[0]) }
}
