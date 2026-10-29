import fs from 'node:fs'
import path from 'node:path'
import { Buffer } from 'buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FIXTURES_DIR, upstreamIdl } from '@/__fixtures__/tx-helpers'
import { idlContentHash } from './content-hash'
import { createIdlResolver, type IdlResolverDeps } from './resolve'
import { loadUserIdl, rememberUserIdl } from './user'

const JUPITER = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'
const WHIRLPOOL = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc'
const RAYDIUM_CLMM = 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK'
const SYSTEM = '11111111111111111111111111111111'
const TOKEN_METADATA = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
const UNKNOWN = 'BPFLoaderUpgradeab1e11111111111111111111111'

// RPC backed by the captured accounts: anything not captured does not exist.
const fixtureRpc = () => {
  const calls: string[][] = []
  const getAccounts = async (addresses: string[]) => {
    calls.push(addresses)
    return addresses.map((address) => {
      const file = path.join(FIXTURES_DIR, 'accounts', `${address}.b64`)
      return fs.existsSync(file) ? new Uint8Array(Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64')) : null
    })
  }
  return { getAccounts, calls }
}

const resolver = (deps: Partial<IdlResolverDeps> = {}) => createIdlResolver({ ...fixtureRpc(), ...deps })

describe('createIdlResolver', () => {
  it('prefers the canonical Program Metadata IDL over the Anchor IDL account', async () => {
    const { idl } = await resolver()(WHIRLPOOL)
    expect(idl?.source).toBe('program-metadata')
  })

  it('reads a canonical Program Metadata account whose format byte says nothing', async () => {
    const { idl } = await resolver()(RAYDIUM_CLMM)
    expect(idl?.source).toBe('program-metadata')
    expect((idl?.raw as { instructions: unknown[] }).instructions.length).toBeGreaterThan(0)
  })

  it('falls back to the Anchor IDL account', async () => {
    const { idl } = await resolver()(JUPITER)
    expect(idl?.source).toBe('anchor-idl')
  })

  it('serves native programs from the vendored copy, or from the Foundation copy with the same hash', async () => {
    const vendored = (await resolver()(SYSTEM)).idl!
    const onChain = (await resolver({ vendored: false })(SYSTEM)).idl!
    expect(vendored.source).toBe('native')
    expect(onChain.source).toBe('native')
    expect(onChain.contentHash).toBe(vendored.contentHash)
  })

  it('reads the three IDL accounts of a program in one request, once', async () => {
    const rpc = fixtureRpc()
    const resolve = createIdlResolver(rpc)
    await resolve(JUPITER)
    await resolve(JUPITER)
    expect(rpc.calls).toHaveLength(1)
    expect(rpc.calls[0]).toHaveLength(3)
  })

  it('answers a follow-up request that prefers the source it just used without a second lookup', async () => {
    const rpc = fixtureRpc()
    const resolve = createIdlResolver(rpc)
    const first = await resolve(JUPITER)
    const again = await resolve(JUPITER, { prefer: first.idl!.source })
    expect(again.idl?.contentHash).toBe(first.idl?.contentHash)
    expect(again.sourceChanged).toBe(false)
    expect(rpc.calls).toHaveLength(1)
  })

  it('reports why nothing was found', async () => {
    const result = await resolver()(UNKNOWN)
    expect(result.idl).toBeNull()
  })

  it('times out a hanging RPC and records the failure', async () => {
    const result = await resolver({ getAccounts: () => new Promise(() => undefined), timeoutMs: 30 })(JUPITER)
    expect(result.idl).toBeNull()
    expect(result.failures.join(' ')).toMatch(/timed out/)
  })

  it('loads a saved reference from its own source first, and flags a change of source', async () => {
    const kept = await resolver()(WHIRLPOOL, { prefer: 'anchor-idl' })
    expect(kept.idl?.source).toBe('anchor-idl')
    expect(kept.sourceChanged).toBe(false)
    const moved = await resolver()(WHIRLPOOL, { prefer: 'curated' })
    expect(moved.idl?.source).toBe('program-metadata')
    expect(moved.sourceChanged).toBe(true)
  })

  it('uses a curated upstream IDL only when its sha256 matches, and only where fetching is allowed', async () => {
    const body = JSON.stringify({ tampered: true })
    const tampered = await resolver({ fetchText: async () => body })(TOKEN_METADATA)
    expect(tampered.idl).toBeNull()
    expect(tampered.failures.join(' ')).toMatch(/changed upstream/)
    expect((await resolver()(TOKEN_METADATA)).idl).toBeNull()
  })

  it.skipIf(!upstreamIdl('token-metadata'))('loads the curated Token Metadata IDL', async () => {
    const text = fs.readFileSync(path.join(FIXTURES_DIR, '.cache', 'token-metadata.json'), 'utf8')
    const { idl } = await resolver({ fetchText: async () => text })(TOKEN_METADATA)
    expect(idl?.source).toBe('curated')
  })

  it('keeps results in the session cache', async () => {
    const store = new Map<string, string>()
    const sessionCache = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    }
    await resolver({ sessionCache })(JUPITER)
    const rpc = fixtureRpc()
    const { idl } = await createIdlResolver({ ...rpc, sessionCache })(JUPITER)
    expect(idl?.source).toBe('anchor-idl')
    expect(rpc.calls).toHaveLength(0)
  })
})

describe('remembered user IDLs', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size
      },
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('is the last resort and is only used when allowed', async () => {
    rememberUserIdl(UNKNOWN, JSON.stringify({ instructions: [] }))
    expect(loadUserIdl(UNKNOWN)).toEqual({ instructions: [] })
    expect((await resolver()(UNKNOWN)).idl).toBeNull()
    const { idl } = await resolver({ rememberedIdls: true })(UNKNOWN)
    expect(idl?.source).toBe('user')
    expect(idl?.contentHash).toBe(idlContentHash({ instructions: [] }))
  })

  it('keeps at most 20 programs, dropping the oldest', () => {
    for (let i = 0; i < 25; i++) rememberUserIdl(`program-${i}`, '{}', i)
    expect(loadUserIdl('program-0')).toBeNull()
    expect(loadUserIdl('program-24')).toEqual({})
  })
})
