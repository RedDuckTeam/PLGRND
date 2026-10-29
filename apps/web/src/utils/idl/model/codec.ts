import type { AccountNode, InstructionArgumentNode, InstructionNode, ValueNode } from '@codama/nodes'
import { getNodeCodec } from '@codama/dynamic-codecs'
import { identifyAccountData, parseInstruction } from '@codama/dynamic-parsers'
import { findInstruction, instructionNode, type IdlInstructionSummary, type ProgramIdl } from './program-idl'
import { formatValue, parseValue, toPlain, ValueError } from './values'

const ATA_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'

export interface InstructionInput {
  data: Uint8Array
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[]
}

export interface DecodedInstruction {
  /** Source-IDL instruction name. */
  name: string
  /** Source-IDL argument name → inline string (formatValue). Discriminators are not included. */
  args: Record<string, string>
  /** Accounts in instruction order. `name` is the source-IDL name, or `#i (guess)` when optional accounts were omitted. */
  accounts: { name: string; pubkey: string; isSigner: boolean; isWritable: boolean }[]
  /** `@solana/spl-token` < 0.4 style ATA `create` sent with empty data instead of discriminator 0. */
  legacyEmptyData?: boolean
  /** encodeInstructionData(name, args) reproduces the original bytes; only exact decodes may become editable. */
  exact: boolean
}

type CodecPath = Parameters<typeof getNodeCodec>[0]

const pathTo = (idl: ProgramIdl, node: InstructionNode | AccountNode) => [idl.root, idl.root.program, node] as CodecPath

const bytesEqual = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((byte, i) => byte === b[i])

const role = (a: InstructionInput['accounts'][number]) => (a.isSigner ? 2 : 0) + (a.isWritable ? 1 : 0)

/** The codec value of an argument's default (discriminators): byte strings, numbers, booleans and strings. */
const defaultValue = (arg: InstructionArgumentNode): unknown => {
  const value = arg.defaultValue as ValueNode | undefined
  switch (value?.kind) {
    case 'bytesValueNode':
      return [value.encoding, value.data]
    case 'numberValueNode':
      return value.number
    case 'booleanValueNode':
      return value.boolean
    case 'stringValueNode':
      return value.string
    default:
      throw new ValueError(`Argument ${arg.name} has no usable default value`)
  }
}

/** Encodes instruction data from source-named args (inline strings or edge values). Throws ValueError. */
export function encodeInstructionData(
  idl: ProgramIdl,
  name: string,
  args: Record<string, unknown>,
  options: { legacyEmptyData?: boolean } = {}
): Uint8Array {
  const summary = findInstruction(idl, name)
  if (!summary) throw new ValueError(`Unknown instruction ${name}`)
  if (options.legacyEmptyData && idl.programId === ATA_PROGRAM_ID && summary.codamaName === 'create') {
    return new Uint8Array()
  }
  const node = instructionNode(idl, summary)
  const sourceByCodama = new Map(summary.args.map((a) => [a.codamaName, a.name]))
  const values: Record<string, unknown> = {}
  for (const arg of node.arguments ?? []) {
    const source = sourceByCodama.get(arg.name)
    if (source === undefined || args[source] === undefined) {
      if (arg.defaultValue === undefined) throw new ValueError(`Missing argument ${source ?? arg.name}`)
      values[arg.name] = defaultValue(arg)
    } else {
      values[arg.name] = parseValue(args[source], arg.type, idl.root)
    }
  }
  return new Uint8Array(getNodeCodec(pathTo(idl, node)).encode(values))
}

const accountLabels = (summary: IdlInstructionSummary, node: InstructionNode, count: number): string[] => {
  const named = summary.accounts.map((a) => a.name)
  // With the "omitted" strategy, missing optional accounts shift every later account, so names are only a guess.
  const ambiguous = count < named.length && node.optionalAccountStrategy === 'omitted'
  return Array.from({ length: count }, (_, i) =>
    i >= named.length ? `#${i}` : ambiguous ? `#${i} (${named[i]}?)` : named[i]
  )
}

const decodeWith = (
  idl: ProgramIdl,
  summary: IdlInstructionSummary,
  data: unknown,
  ix: InstructionInput,
  original: Uint8Array,
  legacyEmptyData = false
): DecodedInstruction => {
  const node = instructionNode(idl, summary)
  const record = data as Record<string, unknown>
  const args: Record<string, string> = {}
  for (const arg of summary.args) args[arg.name] = formatValue(record[arg.codamaName], arg.type, idl.root)
  const labels = accountLabels(summary, node, ix.accounts.length)
  let exact = false
  try {
    exact = bytesEqual(encodeInstructionData(idl, summary.name, args, { legacyEmptyData }), original)
  } catch {
    // Decoded args that do not re-encode cannot reproduce the original bytes.
  }
  return {
    name: summary.name,
    args,
    accounts: ix.accounts.map((a, i) => ({ ...a, name: labels[i] })),
    ...(legacyEmptyData ? { legacyEmptyData } : {}),
    exact,
  }
}

/** Identifies and decodes an instruction of `idl`'s program; null when no instruction matches. */
export function decodeInstruction(idl: ProgramIdl, ix: InstructionInput): DecodedInstruction | null {
  const legacyEmptyData = idl.programId === ATA_PROGRAM_ID && ix.data.length === 0
  const data = legacyEmptyData ? new Uint8Array([0]) : ix.data
  const parsed = parseInstruction(idl.root, {
    programAddress: idl.programId as never,
    accounts: ix.accounts.map((a) => ({ address: a.pubkey as never, role: role(a) })),
    data,
  })
  if (parsed) {
    const codamaName = (parsed.path[parsed.path.length - 1] as InstructionNode).name
    const summary = idl.instructions.find((s) => s.codamaName === codamaName)
    if (summary) return decodeWith(idl, summary, parsed.data, ix, ix.data, legacyEmptyData)
  }
  // A program with a single instruction and no discriminator (Memo) is never "identified"; decode it directly.
  const only = idl.root.program.instructions ?? []
  if (only.length === 1 && !(only[0].discriminators ?? []).length) {
    const summary = idl.instructions[0]
    try {
      const [value, offset] = getNodeCodec(pathTo(idl, only[0])).read(ix.data, 0)
      if (offset === ix.data.length) return decodeWith(idl, summary, value, ix, ix.data)
    } catch {
      return null
    }
  }
  return null
}

/** Decodes account data into plain JSON (bigints as strings, bytes as hex), discriminator fields omitted. */
export function decodeAccountData(idl: ProgramIdl, accountName: string, data: Uint8Array): Record<string, unknown> {
  const summary = idl.accounts.find((a) => a.name === accountName)
  const node = summary && (idl.root.program.accounts ?? []).find((a) => a.name === summary.codamaName)
  if (!node) throw new ValueError(`Unknown account ${accountName}`)
  const value = getNodeCodec(pathTo(idl, node)).decode(data)
  const plain = toPlain(value, node.data, idl.root) as Record<string, unknown>
  return Object.fromEntries(summary.fields.map((f) => [f.name, plain[f.codamaName]]))
}

/**
 * decodeAccountData for a chosen account type, refusing data whose discriminator identifies another account type
 * (or, when the type has a discriminator, none at all) instead of decoding garbage.
 */
export function decodeAccountOfType(idl: ProgramIdl, accountName: string, data: Uint8Array): Record<string, unknown> {
  const summary = idl.accounts.find((a) => a.name === accountName)
  const node = summary && (idl.root.program.accounts ?? []).find((a) => a.name === summary.codamaName)
  if (!node) throw new ValueError(`Unknown account ${accountName}`)
  const path = identifyAccountData(idl.root, data, { programAddress: idl.root.program.publicKey })
  const identified = path?.[path.length - 1] as AccountNode | undefined
  if (identified && identified.name !== node.name) {
    const other = idl.accounts.find((a) => a.codamaName === identified.name)?.name ?? identified.name
    throw new ValueError(`This account holds a ${other}, not a ${accountName}`)
  }
  if (!identified && (node.discriminators ?? []).length > 0) {
    throw new ValueError(`The account data is not a ${accountName}`)
  }
  return decodeAccountData(idl, accountName, data)
}
