import { camelCase, type InstructionAccountNode, type RootNode } from '@codama/nodes'
import { rootNodeFromAnchor } from '@codama/nodes-from-anchor'
import { detectIdlFormat, IdlUnsupportedError } from '../format'
import type { IdlAccountMetaSummary, IdlInstructionSummary, ProgramIdl } from './program-idl'

type RawIdl = Record<string, unknown> & {
  kind?: unknown
  address?: unknown
  metadata?: Record<string, unknown>
  instructions?: RawInstruction[]
  accounts?: { name: string }[]
}
type RawAccountItem = { name: string; accounts?: RawAccountItem[] } & Record<string, unknown>
type RawInstruction = { name: string; accounts?: RawAccountItem[]; args?: { name: string }[] } & Record<string, unknown>
type RawTyped = { name: string; type?: { fields?: { name: string }[] } }

/** Runs the Anchor/Shank converter, collecting its console warnings (PDA name collisions) instead of printing them. */
const convertAnchor = (idl: RawIdl, warnings: string[]): RootNode => {
  const warn = console.warn
  console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(' '))
  try {
    return rootNodeFromAnchor(idl as never)
  } finally {
    console.warn = warn
  }
}

const flattenAccounts = (items: RawAccountItem[] = []): string[] =>
  items.flatMap((item) => (Array.isArray(item.accounts) ? flattenAccounts(item.accounts) : [item.name]))

const sourceNames = (names: string[]) => new Map(names.map((name) => [camelCase(name) as string, name]))

const accountSummary = (
  node: InstructionAccountNode,
  source: Map<string, string>,
  programId: string
): IdlAccountMetaSummary => {
  const summary: IdlAccountMetaSummary = {
    name: source.get(node.name) ?? node.name,
    codamaName: node.name,
    isSigner: node.isSigner,
    isWritable: node.isWritable,
    isOptional: Boolean(node.isOptional),
  }
  const dv = node.defaultValue
  if (dv?.kind === 'publicKeyValueNode') summary.defaultAddress = dv.publicKey
  if (dv?.kind === 'programIdValueNode') summary.defaultAddress = programId
  return summary
}

/** Normalizes legacy Anchor, Anchor >= 0.30, Shank and Codama IDLs into one model. Throws IdlUnsupportedError. */
export function normalizeIdl(raw: unknown, programId: string): ProgramIdl {
  const format = detectIdlFormat(raw)
  const warnings: string[] = []
  let root: RootNode
  let rawIdl: RawIdl | null = null
  try {
    if (format === 'codama') {
      const codama = raw as RootNode
      root = { ...codama, program: { ...codama.program, publicKey: programId } } as RootNode
    } else {
      rawIdl = structuredClone(raw) as RawIdl
      if (format === 'anchor') {
        // The converter takes its V01 path only for this exact spec string.
        rawIdl.metadata = { ...rawIdl.metadata, spec: '0.1.0' }
        rawIdl.address = programId
      } else {
        // Without metadata.address the converter leaves the program address empty and nothing ever parses.
        rawIdl.metadata = { ...rawIdl.metadata, address: programId, ...(format === 'shank' ? { origin: 'shank' } : {}) }
      }
      root = convertAnchor(rawIdl, warnings)
    }
  } catch (error) {
    if (error instanceof IdlUnsupportedError) throw error
    throw new IdlUnsupportedError(error instanceof Error ? error.message : String(error))
  }

  const rawInstructions = new Map((rawIdl?.instructions ?? []).map((ix) => [camelCase(ix.name) as string, ix]))
  const instructions: IdlInstructionSummary[] = (root.program.instructions ?? []).map((node) => {
    const source = rawInstructions.get(node.name)
    const accountNames = sourceNames(flattenAccounts(source?.accounts))
    const argNames = sourceNames((source?.args ?? []).map((a) => a.name))
    return {
      name: source?.name ?? node.name,
      codamaName: node.name,
      accounts: (node.accounts ?? []).map((a) => accountSummary(a, accountNames, programId)),
      args: (node.arguments ?? [])
        .filter((arg) => arg.defaultValueStrategy !== 'omitted')
        .map((arg) => ({ name: argNames.get(arg.name) ?? arg.name, codamaName: arg.name, type: arg.type })),
    }
  })
  const accountNames = sourceNames((rawIdl?.accounts ?? []).map((a) => a.name))
  // Legacy IDLs describe an account's fields inline; v01 IDLs in a type of the same name.
  const rawFields = (name: string): string[] => {
    const inline = rawIdl?.accounts?.find((a) => a.name === name) as RawTyped | undefined
    const typed = (rawIdl?.types as RawTyped[] | undefined)?.find((t) => t.name === name)
    return (inline?.type?.fields ?? typed?.type?.fields ?? []).map((f) => f.name)
  }

  return {
    kind: 'plgrnd-idl/1',
    format,
    programId,
    name: root.program.name,
    root,
    instructions,
    accounts: (root.program.accounts ?? []).map((a) => {
      const name = accountNames.get(a.name) ?? a.name
      const fieldNames = sourceNames(rawFields(name))
      const fields = a.data?.kind === 'structTypeNode' ? (a.data.fields ?? []) : []
      return {
        name,
        codamaName: a.name,
        fields: fields
          .filter((f) => f.defaultValueStrategy !== 'omitted')
          .map((f) => ({ name: fieldNames.get(f.name) ?? f.name, codamaName: f.name })),
      }
    }),
    warnings,
  }
}
