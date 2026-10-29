import { PublicKey } from '@solana/web3.js'
import { FOUNDATION_IDL_AUTHORITY, anchorIdlAddress, pmpAuthorityAddress, pmpCanonicalAddress } from './addresses'
import { decodeAnchorIdlAccount } from './anchor-account'
import { idlContentHash } from './content-hash'
import { loadCuratedIdl } from './curated'
import { loadNativeIdl } from './native'
import { parseMetadataAccount, readMetadataContent } from './program-metadata'
import { loadUserIdl } from './user'

/**
 * Where an IDL came from. `native` covers both the vendored copy and the Solana Foundation's Program Metadata copy
 * (the same IDL); `program-metadata` is the program's canonical Program Metadata account.
 */
export type IdlSource = 'native' | 'program-metadata' | 'anchor-idl' | 'curated' | 'user'

export interface ResolvedIdl {
  programId: string
  source: IdlSource
  /** The IDL JSON as published, in any format; normalize it before use. */
  raw: unknown
  contentHash: string
}

export interface ResolveResult {
  idl: ResolvedIdl | null
  /** A preferred source (a saved reference) was given but the IDL came from another one. */
  sourceChanged: boolean
  /** Why each source that was tried failed, for the node's tooltip. */
  failures: string[]
}

export interface IdlResolverDeps {
  /** Raw data of several accounts in one request, null for missing ones (the flow's network). */
  getAccounts: (addresses: string[]) => Promise<(Uint8Array | null)[]>
  /** Third-party HTTPS fetches (curated sources, Program Metadata URLs). Absent in the self-hosted widget. */
  fetchText?: (url: string) => Promise<string>
  /** Use the vendored native IDLs (default true); without them native programs resolve from Program Metadata. */
  vendored?: boolean
  /** Use IDLs the user pasted before (app only). */
  rememberedIdls?: boolean
  timeoutMs?: number
  /** Survives reloads within the tab (app only: the widget must not write to the host page's storage). */
  sessionCache?: Pick<Storage, 'getItem' | 'setItem'>
}

const SESSION_PREFIX = 'plgrnd:idl-cache:'
const MAX_SESSION_ENTRY = 1024 * 1024

const withTimeout = <T>(promise: Promise<T>, ms: number, what: string): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} timed out`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })

export function createIdlResolver(deps: IdlResolverDeps) {
  const timeoutMs = deps.timeoutMs ?? 5000
  const cache = new Map<string, Promise<ResolveResult>>()

  const readSession = (programId: string): { source: IdlSource; raw: unknown } | null => {
    try {
      const text = deps.sessionCache?.getItem(SESSION_PREFIX + programId)
      return text ? (JSON.parse(text) as { source: IdlSource; raw: unknown }) : null
    } catch {
      return null
    }
  }
  const writeSession = (programId: string, source: IdlSource, raw: unknown) => {
    try {
      const text = JSON.stringify({ source, raw })
      if (text.length <= MAX_SESSION_ENTRY) deps.sessionCache?.setItem(SESSION_PREFIX + programId, text)
    } catch {
      // Quota or blocked storage: the in-memory cache still applies.
    }
  }

  const resolveUncached = async (programId: string, prefer?: IdlSource): Promise<ResolveResult> => {
    const failures: string[] = []
    const program = new PublicKey(programId)
    const fetchText = deps.fetchText && ((url: string) => withTimeout(deps.fetchText!(url), timeoutMs, url))

    // The three derived accounts are read together, once, and only if an on-chain step runs.
    let onChain: Promise<(Uint8Array | null)[]> | undefined
    const accounts = async () => {
      onChain ??= anchorIdlAddress(program).then((anchor) =>
        withTimeout(
          deps.getAccounts([
            pmpCanonicalAddress(program).toBase58(),
            pmpAuthorityAddress(program, FOUNDATION_IDL_AUTHORITY).toBase58(),
            anchor.toBase58(),
          ]),
          timeoutMs,
          'IDL account lookup'
        )
      )
      return onChain
    }
    const metadata = async (index: 0 | 1) => {
      const data = (await accounts())[index]
      if (!data) return null
      const fetchAccount = async (address: string) =>
        (await withTimeout(deps.getAccounts([address]), timeoutMs, address))[0]
      return JSON.parse(await readMetadataContent(parseMetadataAccount(data), { fetchAccount, fetchUrl: fetchText }))
    }

    const steps: [IdlSource, () => Promise<unknown | null>][] = [
      ['native', async () => (deps.vendored === false ? null : loadNativeIdl(programId))],
      ['program-metadata', () => metadata(0)],
      ['native', () => metadata(1)],
      [
        'anchor-idl',
        async () => {
          const data = (await accounts())[2]
          return data ? JSON.parse(await decodeAnchorIdlAccount(data)) : null
        },
      ],
      ['curated', async () => (fetchText ? loadCuratedIdl(programId, fetchText) : null)],
      ['user', async () => (deps.rememberedIdls ? loadUserIdl(programId) : null)],
    ]
    const ordered = prefer ? [...steps.filter(([s]) => s === prefer), ...steps.filter(([s]) => s !== prefer)] : steps

    const cached = readSession(programId)
    if (cached && (!prefer || cached.source === prefer)) {
      return { idl: { programId, ...cached, contentHash: idlContentHash(cached.raw) }, sourceChanged: false, failures }
    }

    for (const [source, load] of ordered) {
      try {
        const raw = await load()
        if (raw !== null && raw !== undefined) {
          writeSession(programId, source, raw)
          return {
            idl: { programId, source, raw, contentHash: idlContentHash(raw) },
            sourceChanged: Boolean(prefer) && source !== prefer,
            failures,
          }
        }
      } catch (error) {
        failures.push(`${source}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    return { idl: null, sourceChanged: Boolean(prefer), failures }
  }

  return async (programId: string, options: { prefer?: IdlSource } = {}): Promise<ResolveResult> => {
    // A node that just loaded an IDL saves its source and asks again with `prefer`; reuse that result.
    const loaded = options.prefer ? cache.get(`${programId}:`) : undefined
    if (loaded) {
      const result = await loaded
      if (result.idl?.source === options.prefer) return { ...result, sourceChanged: false }
    }
    const key = `${programId}:${options.prefer ?? ''}`
    let result = cache.get(key)
    if (!result) {
      result = resolveUncached(programId, options.prefer)
      cache.set(key, result)
      // Failures are not cached: the next node or reload tries again.
      result.then((r) => (r.idl ? undefined : cache.delete(key))).catch(() => cache.delete(key))
    }
    return result
  }
}

export type IdlResolver = ReturnType<typeof createIdlResolver>
