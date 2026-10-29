// Transaction import for pages and the self-hosted widget, without React. utils/tx-import is loaded on first use
// only: nothing here imports it at runtime, so a page's initial bundle does not grow with the importer.
import type { RpcConfig } from '@/providers/rpc-urls-context'
import type { Network } from '@/types/network'
import { idlAddress } from '@/utils/idl/format'
import { createAppResolveIdl } from '@/utils/idl/sources/app-resolver'
import type { DetectedInput, ImportResult, ImportStage } from '@/utils/tx-import'

export type { DetectedInput, ImportResult, ImportStage }

export const loadTxImport = () => import('@/utils/tx-import')

export const IMPORT_STAGES: readonly { stage: ImportStage; label: string }[] = [
  { stage: 'fetch', label: 'Fetching the transaction' },
  { stage: 'decode', label: 'Loading IDLs and decoding' },
  { stage: 'generate', label: 'Building the flow' },
  { stage: 'verify', label: 'Checking that it rebuilds the original' },
]

export interface TxImportOptions {
  /** Where to look; by default a signature is searched on mainnet, then devnet. */
  network?: Network
  onStage?: (stage: ImportStage) => void
  signal?: AbortSignal
  /** Also use IDLs pasted earlier in this browser (the editor; ignored by the self-hosted widget). */
  rememberedIdls?: boolean
}

/**
 * Imports a transaction signature or a serialized transaction (base64, base64url or base58) over the page's RPC:
 * the flow snapshot to put on the canvas, a summary, and the state `pasteIdl` needs.
 */
export async function importTx(rpc: RpcConfig, input: string, options: TxImportOptions = {}): Promise<ImportResult> {
  const { importTransaction, createImportRpc } = await loadTxImport()
  return importTransaction(input, {
    rpc: createImportRpc(rpc.urls, options.signal),
    resolveIdl: createAppResolveIdl(rpc, { rememberedIdls: options.rememberedIdls ?? false }),
    network: options.network,
    onStage: options.onStage,
  })
}

/**
 * The pasted IDL, or why it is refused. An IDL that declares another program is refused: it could put wrong names
 * on instructions whose bytes still match.
 */
export function readPastedIdl(text: string, programId: string): { idl: object } | { error: string } {
  let idl: unknown
  try {
    idl = JSON.parse(text)
  } catch {
    return { error: 'Not valid JSON' }
  }
  if (typeof idl !== 'object' || idl === null || Array.isArray(idl))
    return { error: 'Not an IDL: expected a JSON object' }
  const address = idlAddress(idl)
  if (address && address !== programId) return { error: `This IDL is for program ${address}, not ${programId}` }
  return { idl }
}

export interface PastedIdl {
  result: ImportResult
  /** How many of the program's instructions the IDL turned into PROGRAM INSTRUCTIONS. */
  decoded: number
  /** Warnings the paste added, e.g. instructions that stay raw and why. */
  warnings: string[]
}

/** Imports `result`'s transaction again with an IDL pasted for one of its programs (refused as in readPastedIdl). */
export async function pasteIdl(result: ImportResult, programId: string, text: string): Promise<PastedIdl> {
  const read = readPastedIdl(text, programId)
  if ('error' in read) throw new Error(read.error)
  const { applyPastedIdl } = await loadTxImport()
  const next = await applyPastedIdl(result, programId, read.idl)
  return {
    result: next,
    decoded: next.summary.decoded - result.summary.decoded,
    warnings: next.warnings.filter((warning) => !result.warnings.includes(warning)),
  }
}

const isEmptySignature = (signature: string) => /^1+$/.test(signature)

/** What the input was read as, e.g. "Signature" or "base64 transaction · v0 · 1 of 2 signatures". */
export function describeInput(detected: DetectedInput): string {
  if (detected.kind === 'signature') return 'Signature'
  const version = detected.version === 0 ? 'v0' : 'legacy'
  const total = detected.signatures.length
  const signed = detected.signatures.filter((s) => !isEmptySignature(s)).length
  const signatures =
    signed === total ? `${total} signature${total === 1 ? '' : 's'}` : `${signed} of ${total} signatures`
  return `${detected.encoding} transaction · ${version} · ${signatures}`
}

export const importErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error))
