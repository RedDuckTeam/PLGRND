import { PublicKey } from '@solana/web3.js'
import type { Network } from '@/types/network'
import type { IdlNodeData, IdlNodeStatus, IdlRef } from '@/types/nodes/programs/idl-node'
import { idlAddress } from '@/utils/idl/format'
import type { ComputeContext, NodeData, NodeInputs } from './types'

/**
 * How an IDL node gets its IDL: `paste` parses `idlJson`; `load` resolves the program id (new nodes, or nodes with
 * a saved `ref`); `manual` waits for "Load from chain", so nodes from older flows never fetch by themselves;
 * `idle` has no program id to go on.
 */
export type IdlLoadMode = 'paste' | 'load' | 'manual' | 'idle'

// Only a complete address: a half-typed one is a valid (short) PublicKey too.
const isProgramAddress = (value: string) => {
  try {
    return new PublicKey(value).toBase58() === value
  } catch {
    return false
  }
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** A node dropped from the menu starts with empty data; it is the only kind that turns autoLoad on by itself. */
export const isNewIdlNode = (data: NodeData | undefined) => !data || Object.keys(data).length === 0

export function idlLoadMode(data: NodeData): IdlLoadMode {
  if (text(data.idlJson)) return 'paste'
  if (!isProgramAddress(text(data.programId))) return 'idle'
  return data.autoLoad === true || data.ref ? 'load' : 'manual'
}

/** The Network edge, else the inline choice, else mainnet. */
export const idlNetwork = (data: NodeData, inputs: NodeInputs): Network =>
  (inputs.network as Network | undefined) || (data.network as Network | undefined) || 'MAINNET'

export const idlLoadKey = (network: Network, programId: string) => `load:${network}:${programId}`

const pasteIdl = async (idlJson: string, typedId: string, ctx: ComputeContext): Promise<IdlNodeData> => {
  const status = (s: Omit<IdlNodeStatus, 'key'>): IdlNodeStatus => ({ key: 'paste', ...s })
  let raw: unknown
  try {
    raw = JSON.parse(idlJson)
  } catch {
    return { idl: null, programId: typedId, ref: undefined, status: status({ error: 'Invalid IDL JSON' }) }
  }
  const programId = typedId || idlAddress(raw)
  try {
    const { normalizeIdl } = await import('@/utils/idl/model/normalize')
    const idl = normalizeIdl(raw, programId)
    if (programId) ctx.rememberIdl?.(programId, idlJson)
    return { idl, programId, ref: undefined, status: status({ badge: `pasted · unverified · ${idl.format}` }) }
  } catch (error) {
    return { idl: null, programId, ref: undefined, status: status({ error: message(error) }) }
  }
}

const loadIdl = async (
  programId: string,
  network: Network,
  ref: IdlRef | undefined,
  ctx: ComputeContext
): Promise<IdlNodeData> => {
  const status = (s: Omit<IdlNodeStatus, 'key'>): IdlNodeStatus => ({ key: idlLoadKey(network, programId), ...s })
  if (!ctx.resolveIdl) return { idl: null, programId, status: status({ error: 'Loading IDLs is not available here' }) }

  // A saved reference for this program and network: reload from the same source and compare.
  const saved = ref?.programId === programId && ref.network === network ? ref : undefined
  let result
  try {
    result = await ctx.resolveIdl(programId, { network, prefer: saved?.source })
  } catch (error) {
    return { idl: null, programId, status: status({ error: message(error) }) }
  }
  if (!result.idl) {
    return {
      idl: null,
      programId,
      status: status({ error: 'No IDL found for this program', failures: result.failures }),
    }
  }

  const { source, raw, contentHash } = result.idl
  let idl
  try {
    const { normalizeIdl } = await import('@/utils/idl/model/normalize')
    idl = normalizeIdl(raw, programId)
  } catch (error) {
    return { idl: null, programId, status: status({ badge: source, error: message(error) }) }
  }

  const loaded: IdlRef = { programId, network, source, format: idl.format, contentHash }
  const warnings: string[] = []
  if (saved && (result.sourceChanged || saved.source !== source)) {
    warnings.push(`IDL source changed: saved from ${saved.source}, loaded from ${source}`)
  }
  if (saved && saved.contentHash !== contentHash) warnings.push('The IDL changed since this flow was saved')
  // A remembered IDL was pasted by the user: nothing vouches for it.
  const badge = source === 'user' ? `pasted · unverified · ${idl.format}` : `${source} · ${idl.format}`
  // The saved reference stays until the user accepts the new IDL, so the warning survives reloads.
  if (saved) return { idl, programId, status: status(warnings.length ? { badge, warnings, loaded } : { badge }) }
  return { idl, programId, ref: loaded, status: status({ badge }) }
}

export const computeIdl = async (
  data: NodeData,
  inputs: NodeInputs = {},
  ctx: ComputeContext = {}
): Promise<IdlNodeData> => {
  const programId = text(data.programId)
  switch (idlLoadMode(data)) {
    case 'paste':
      return pasteIdl(data.idlJson as string, programId, ctx)
    case 'load':
      return loadIdl(programId, idlNetwork(data, inputs), data.ref as IdlRef | undefined, ctx)
    default:
      return { idl: null, programId, status: undefined }
  }
}
