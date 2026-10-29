import { sha256 } from 'js-sha256'

/** Removes every `docs` field: documentation is not part of an IDL's identity (and is stripped from vendored copies). */
export function stripDocs(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripDocs)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'docs')
      .map(([key, v]) => [key, stripDocs(v)])
  )
}

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (typeof value !== 'object' || value === null) return JSON.stringify(value)
  const entries = Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
}

/** Identity of an IDL regardless of where it was read: key order, whitespace, compression and docs do not count. */
export const idlContentHash = (idl: unknown): string => sha256(stableStringify(stripDocs(idl)))
