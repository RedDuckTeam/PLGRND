import type { Network } from '@/types/network'
import type { IdlNodeData } from '@/types/nodes/programs/idl-node'
import type { RawInstructionAnnotations } from '@/types/nodes/programs/raw-instruction-node'
import { decodeInstruction, type DecodedInstruction } from '@/utils/idl/model/codec'
import { normalizeIdl } from '@/utils/idl/model/normalize'
import { findInstruction, type ProgramIdl } from '@/utils/idl/model/program-idl'
import type { ResolvedIdl } from '@/utils/idl/sources/resolve'
import type { ResolveIdl } from '@/utils/node/compute/types'
import { decompileMessage, type DecompiledMessage, type MessageAccountMeta } from '@/utils/solana/message-compiler'
import type { FetchedTransaction } from './fetch'

/** A program's IDL and the IDL node that loads it again (a reference, or the pasted JSON). */
export interface ProgramIdlEntry {
  idl: ProgramIdl
  node: IdlNodeData
  /** Served to IDL nodes while the generated flow is checked (loaded IDLs only). */
  resolved?: ResolvedIdl
}

export interface ImportInstruction {
  index: number
  programId: string
  metas: MessageAccountMeta[]
  data: Uint8Array
  /** An exact decode: the instruction becomes PROGRAM INSTRUCTIONS. */
  decoded?: DecodedInstruction
  /** Otherwise it stays RAW: why, and what a decode recognized. */
  raw?: RawInstructionAnnotations
  /** Failed the post-generation check: only its signers stay wired, every other value is inline. */
  isolated?: boolean
}

const IDL_CONCURRENCY = 4

/** Resolves and normalizes the IDL of every program (deduplicated, at most 4 lookups at a time). */
export async function loadProgramIdls(
  programIds: string[],
  options: { resolveIdl: ResolveIdl; network: Network }
): Promise<{ programs: Map<string, ProgramIdlEntry>; missing: Map<string, string> }> {
  const found = new Map<string, ProgramIdlEntry>()
  const failed = new Map<string, string>()
  const unique = [...new Set(programIds)]
  const queue = [...unique]
  const worker = async () => {
    for (let programId = queue.shift(); programId; programId = queue.shift()) {
      try {
        const { idl: resolved } = await options.resolveIdl(programId, { network: options.network })
        if (!resolved) {
          failed.set(programId, 'No IDL found for this program')
          continue
        }
        const idl = normalizeIdl(resolved.raw, programId)
        const ref = {
          programId,
          network: options.network,
          source: resolved.source,
          format: idl.format,
          contentHash: resolved.contentHash,
        }
        found.set(programId, {
          idl,
          node: { programId, network: options.network, autoLoad: true, ref },
          resolved,
        })
      } catch (error) {
        failed.set(programId, `The IDL could not be read: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }
  await Promise.all(Array.from({ length: IDL_CONCURRENCY }, worker))
  // Deterministic order whatever finished first.
  const programs = new Map(unique.filter((id) => found.has(id)).map((id) => [id, found.get(id)!]))
  const missing = new Map(unique.filter((id) => failed.has(id)).map((id) => [id, failed.get(id)!]))
  return { programs, missing }
}

export interface DecodedTransaction {
  message: DecompiledMessage
  programs: Map<string, ProgramIdlEntry>
  /** Programs without a usable IDL, and why. */
  missing: Map<string, string>
}

/** Decompiles the message and loads the IDL of every program it invokes at the top level. */
export async function decodeTransaction(
  fetched: Pick<FetchedTransaction, 'message' | 'altAccounts' | 'network'>,
  resolveIdl: ResolveIdl
): Promise<DecodedTransaction> {
  const message = decompileMessage(fetched.message, fetched.altAccounts)
  const programIds = message.instructions.map((ix) => ix.programId)
  return { message, ...(await loadProgramIdls(programIds, { resolveIdl, network: fetched.network })) }
}

/**
 * Decodes each top-level instruction with its program's IDL. Only exact decodes (the arguments re-encode to the
 * original data) whose named accounts are distinct are kept; `forceRaw` keeps instructions raw with a reason.
 */
export function decodeInstructions(
  message: DecompiledMessage,
  programs: ReadonlyMap<string, ProgramIdlEntry>,
  missing: ReadonlyMap<string, string>,
  forceRaw: ReadonlyMap<number, string> = new Map()
): ImportInstruction[] {
  return message.instructions.map((ix, index): ImportInstruction => {
    const base = { index, programId: ix.programId, metas: ix.metas, data: ix.data }
    const forced = forceRaw.get(index)
    const raw = (reason: string, recognized: RawInstructionAnnotations = {}): ImportInstruction =>
      forced
        ? { ...base, raw: { ...recognized, reason: forced }, isolated: true }
        : { ...base, raw: { ...recognized, reason } }

    const entry = programs.get(ix.programId)
    if (!entry) return raw(missing.get(ix.programId) ?? 'No IDL found for this program')

    let decoded: DecodedInstruction | null = null
    try {
      decoded = decodeInstruction(entry.idl, { data: ix.data, accounts: ix.metas })
    } catch {
      // Treated as unrecognized.
    }
    if (!decoded) return raw('The IDL does not recognize this instruction')

    const annotations = {
      instruction: decoded.name,
      accounts: decoded.accounts.map((a) => a.name),
      args: decoded.args,
    }
    if (!decoded.exact) return raw('The decoded values do not re-encode to the original data', annotations)
    const names = findInstruction(entry.idl, decoded.name)!
      .accounts.slice(0, ix.metas.length)
      .map((a) => a.name)
    if (new Set(names).size !== names.length) {
      return raw('Two accounts of this instruction share a name in the IDL', annotations)
    }
    return forced ? raw(forced, annotations) : { ...base, decoded }
  })
}
