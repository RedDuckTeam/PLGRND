// IDL format detection without the Codama converter, so code on the main bundle path (share links) can use it.
import type { ProgramIdl } from './model/program-idl'

export type IdlFormat = 'codama' | 'anchor' | 'anchor-legacy' | 'shank'

export class IdlUnsupportedError extends Error {
  constructor(reason: string) {
    super(`IDL unsupported: ${reason}`)
    this.name = 'IdlUnsupportedError'
  }
}

export const isProgramIdl = (value: unknown): value is ProgramIdl =>
  typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'plgrnd-idl/1'

type RawAccount = Record<string, unknown>
type RawFormatProbe = {
  kind?: unknown
  address?: unknown
  metadata?: Record<string, unknown>
  instructions?: ({ discriminator?: unknown; accounts?: RawAccount[] } & Record<string, unknown>)[]
}

export function detectIdlFormat(raw: unknown): IdlFormat {
  if (typeof raw !== 'object' || raw === null) throw new IdlUnsupportedError('not a JSON object')
  const idl = raw as RawFormatProbe
  if (idl.kind === 'rootNode') return 'codama'
  if (!Array.isArray(idl.instructions)) throw new IdlUnsupportedError('no instructions')
  const ix0 = idl.instructions[0]
  const v01 =
    Boolean(idl.metadata?.spec) ||
    typeof idl.address === 'string' ||
    Array.isArray(ix0?.discriminator) ||
    (ix0?.accounts ?? []).some((a) => 'writable' in a || 'signer' in a)
  if (v01) return 'anchor'
  if (idl.metadata?.origin === 'shank' || idl.instructions.some((ix) => 'discriminant' in ix)) return 'shank'
  return 'anchor-legacy'
}

/** The program address an IDL declares (legacy `metadata.address`, Anchor >= 0.30 `address`, Codama `publicKey`). */
export function idlAddress(raw: unknown): string {
  if (typeof raw !== 'object' || raw === null) return ''
  const idl = raw as { address?: unknown; metadata?: { address?: unknown }; program?: { publicKey?: unknown } }
  const address = idl.program?.publicKey ?? idl.address ?? idl.metadata?.address
  return typeof address === 'string' ? address : ''
}
