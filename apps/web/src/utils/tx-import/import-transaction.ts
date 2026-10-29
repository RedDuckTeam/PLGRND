import type { FlowSnapshot } from '@/stores/flow-snapshot'
import type { Network } from '@/types/network'
import { normalizeIdl } from '@/utils/idl/model/normalize'
import type { ComputeContext, ResolveIdl } from '@/utils/node/compute/types'
import { decodeInstructions, decodeTransaction, type DecodedTransaction, type ImportInstruction } from './decode'
import { detectInput, TxImportError } from './detect-input'
import { fetchTransaction, type FetchedTransaction } from './fetch'
import { generateFlow } from './generate-flow'
import { checkFlow } from './guard'
import { analyzeProvenance } from './provenance'
import type { ImportRpc } from './rpc'

export type ImportStage = 'fetch' | 'decode' | 'generate' | 'verify'

export interface ImportOptions {
  rpc: ImportRpc
  /** IDL lookup on the transaction's network. */
  resolveIdl: ResolveIdl
  /** Where to look. By default a signature is searched on mainnet, then devnet; a serialized one runs on mainnet. */
  network?: Network
  onStage?: (stage: ImportStage) => void
}

export interface ImportSummary {
  /** Instructions that became PROGRAM INSTRUCTIONS, of all top-level instructions. */
  decoded: number
  total: number
  /** Programs without an IDL; their instructions are RAW INSTRUCTION nodes. */
  missingIdls: { programId: string; instructionCount: number }[]
}

/** Everything applyPastedIdl needs to redo the import with another IDL. */
export interface ImportState {
  fetched: FetchedTransaction
  decoded: DecodedTransaction
}

export interface ImportResult {
  snapshot: FlowSnapshot
  network: Network
  summary: ImportSummary
  warnings: string[]
  state: ImportState
}

const GUARD_REASON = 'Rebuilding the decoded instruction gave different bytes, so it stays raw'

// The guard reloads every IDL node; it gets the IDLs this import already loaded, without another lookup.
const loadedIdls =
  (decoded: DecodedTransaction): ResolveIdl =>
  async (programId) => {
    const resolved = decoded.programs.get(programId)?.resolved
    return resolved
      ? { idl: resolved, sourceChanged: false, failures: [] }
      : { idl: null, sourceChanged: false, failures: ['Not loaded by the import'] }
  }

const warningsFor = ({ fetched, decoded }: ImportState, instructions: ImportInstruction[]): string[] => {
  const warnings: string[] = []
  if (fetched.simulationError) warnings.push(`The transaction could not be simulated: ${fetched.simulationError}`)
  else if (fetched.serialized && fetched.execution?.err) {
    warnings.push(`The simulation failed (${JSON.stringify(fetched.execution.err)}); TX TRACE shows the details`)
  }
  for (const [programId, reason] of decoded.missing) {
    if (!reason.startsWith('No IDL found')) warnings.push(`${programId}: ${reason}`)
  }
  for (const ix of instructions) {
    if (ix.raw && !decoded.missing.has(ix.programId))
      warnings.push(`Instruction ${ix.index + 1} stays raw: ${ix.raw.reason}`)
  }
  return warnings
}

/**
 * Generates the flow and checks that it rebuilds the original instructions. Instructions that do not are
 * generated again as RAW INSTRUCTION nodes and the check runs once more; a second failure aborts the import.
 */
async function build(state: ImportState, onStage?: (stage: ImportStage) => void): Promise<ImportResult> {
  const { fetched, decoded } = state
  const { message, programs, missing } = decoded
  const ctx: ComputeContext = { resolveIdl: loadedIdls(decoded) }
  const original = { instructions: message.instructions, feePayer: message.staticKeys[0] }
  const forced = new Map<number, string>()
  for (let attempt = 0; ; attempt++) {
    const instructions = decodeInstructions(message, programs, missing, forced)
    const provenance = analyzeProvenance(message, instructions, programs, fetched.execution)
    onStage?.('generate')
    const snapshot = generateFlow({ decoded, instructions, provenance, fetched })
    onStage?.('verify')
    const check = await checkFlow(snapshot, original, ctx)
    if (check.ok) {
      const summary: ImportSummary = {
        decoded: instructions.filter((ix) => ix.decoded).length,
        total: instructions.length,
        missingIdls: [...missing.keys()].map((programId) => ({
          programId,
          instructionCount: instructions.filter((ix) => ix.programId === programId).length,
        })),
      }
      return { snapshot, network: fetched.network, summary, warnings: warningsFor(state, instructions), state }
    }
    if (attempt > 0 || check.mismatched.length === 0) {
      const which = check.mismatched.map((i) => i + 1).join(', ')
      throw new TxImportError(
        'guard',
        `The generated flow does not rebuild the original transaction${which ? ` (instruction ${which})` : ''}`
      )
    }
    for (const index of check.mismatched) forced.set(index, GUARD_REASON)
  }
}

/**
 * Turns a transaction signature or a serialized transaction into a flow that rebuilds the same message: fetch (or
 * simulate), decode with the programs' IDLs, wire signers/ATAs/PDAs/shared values, lay out, and verify.
 */
export async function importTransaction(input: string, options: ImportOptions): Promise<ImportResult> {
  const detected = detectInput(input)
  options.onStage?.('fetch')
  const fetched = await fetchTransaction(detected, options)
  options.onStage?.('decode')
  const decoded = await decodeTransaction(fetched, options.resolveIdl)
  return build({ fetched, decoded }, options.onStage)
}

/**
 * Re-imports with an IDL the user pasted for one program (any supported format, JSON text or parsed): its RAW
 * instructions that now decode and pass the check become PROGRAM INSTRUCTIONS with an IDL node holding the JSON.
 * Throws IdlUnsupportedError (or a JSON SyntaxError) for an IDL that cannot be read.
 */
export async function applyPastedIdl(result: ImportResult, programId: string, rawIdl: unknown): Promise<ImportResult> {
  const raw: unknown = typeof rawIdl === 'string' ? JSON.parse(rawIdl) : rawIdl
  const idl = normalizeIdl(raw, programId)
  const { decoded } = result.state
  const programs = new Map(decoded.programs).set(programId, { idl, node: { idlJson: JSON.stringify(raw), programId } })
  const missing = new Map(decoded.missing)
  missing.delete(programId)
  return build({ ...result.state, decoded: { ...decoded, programs, missing } })
}
