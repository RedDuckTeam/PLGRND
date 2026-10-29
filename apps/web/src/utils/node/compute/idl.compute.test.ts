import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { Keypair } from '@solana/web3.js'
import counterIdl from '@/constants/programs/counter/counter.json'
import { FIXTURES_DIR } from '@/__fixtures__/tx-helpers'
import type { IdlRef } from '@/types/nodes/programs/idl-node'
import { idlContentHash } from '@/utils/idl/sources/content-hash'
import type { ResolveResult } from '@/utils/idl/sources/resolve'
import { computeIdl, idlLoadMode, isNewIdlNode } from './idl.compute'
import type { ResolveIdl } from './types'

const key = (seed: number) => Keypair.fromSeed(new Uint8Array(32).fill(seed)).publicKey.toBase58()
const PROGRAM = key(9)
const HASH = idlContentHash(counterIdl)

const found = (patch: Partial<ResolveResult> = {}, source: 'anchor-idl' | 'program-metadata' = 'anchor-idl') =>
  ({
    idl: { programId: PROGRAM, source, raw: counterIdl, contentHash: HASH },
    sourceChanged: false,
    failures: [],
    ...patch,
  }) satisfies ResolveResult

const fakeResolver = (result: ResolveResult = found()) => vi.fn<ResolveIdl>(async () => result)

const savedRef = (patch: Partial<IdlRef> = {}): IdlRef => ({
  programId: PROGRAM,
  network: 'MAINNET',
  source: 'anchor-idl',
  format: 'anchor-legacy',
  contentHash: HASH,
  ...patch,
})

const fixtureIdl = (name: string) => fs.readFileSync(path.join(FIXTURES_DIR, 'idl', `all-types.${name}.json`), 'utf8')

describe('IDL auto-load trigger rules', () => {
  it('only a node dropped from the menu (empty data) is new', () => {
    expect(isNewIdlNode({})).toBe(true)
    expect(isNewIdlNode(undefined)).toBe(true)
    // Every IDL node saved by older versions has at least idlJson.
    expect(isNewIdlNode({ idlJson: '' })).toBe(false)
  })

  it.each([
    ['nothing to go on', {}, 'idle'],
    ['a pasted IDL wins over loading', { idlJson: '{"a":1}', programId: PROGRAM, autoLoad: true }, 'paste'],
    ['a new node with a program id', { idlJson: '', programId: PROGRAM, autoLoad: true }, 'load'],
    ['whitespace is no IDL', { idlJson: '  \n', programId: PROGRAM, autoLoad: true }, 'load'],
    ['a node from an older flow waits for "Load from chain"', { idlJson: '', programId: PROGRAM }, 'manual'],
    ['autoLoad must be exactly true', { programId: PROGRAM, autoLoad: 'yes' }, 'manual'],
    ['a saved reference reloads', { programId: PROGRAM, ref: savedRef() }, 'load'],
    ['a half-typed program id', { programId: PROGRAM.slice(0, 20), autoLoad: true }, 'idle'],
    ['an invalid program id', { programId: 'not a key', autoLoad: true }, 'idle'],
  ])('%s', (_, data, mode) => {
    expect(idlLoadMode(data)).toBe(mode)
  })
})

describe('computeIdl', () => {
  it('loads a new node by program id and persists a reference instead of the IDL', async () => {
    const resolveIdl = fakeResolver()
    const out = await computeIdl({ idlJson: '', programId: PROGRAM, autoLoad: true }, {}, { resolveIdl })

    expect(resolveIdl).toHaveBeenCalledWith(PROGRAM, { network: 'MAINNET', prefer: undefined })
    expect(out.idl).toMatchObject({ kind: 'plgrnd-idl/1', format: 'anchor-legacy', programId: PROGRAM })
    expect(out.ref).toEqual(savedRef())
    expect(out).not.toHaveProperty('idlJson')
    expect(out.status).toEqual({ key: `load:MAINNET:${PROGRAM}`, badge: 'anchor-idl · anchor-legacy' })
  })

  it('loads from the connected network, else the inline one', async () => {
    const resolveIdl = fakeResolver()
    const data = { programId: PROGRAM, autoLoad: true, network: 'DEVNET' }
    expect((await computeIdl(data, {}, { resolveIdl })).ref?.network).toBe('DEVNET')
    expect((await computeIdl(data, { network: 'MAINNET' }, { resolveIdl })).ref?.network).toBe('MAINNET')
    expect(resolveIdl.mock.calls.map(([, options]) => options.network)).toEqual(['DEVNET', 'MAINNET'])
  })

  it('never fetches for a node from an older flow', async () => {
    const resolveIdl = fakeResolver()
    const out = await computeIdl({ idlJson: '', programId: PROGRAM }, {}, { resolveIdl })
    expect(resolveIdl).not.toHaveBeenCalled()
    expect(out).toEqual({ idl: null, programId: PROGRAM, status: undefined })
  })

  it('reloads a saved reference from its source and keeps it', async () => {
    const resolveIdl = fakeResolver()
    const out = await computeIdl({ programId: PROGRAM, ref: savedRef() }, {}, { resolveIdl })
    expect(resolveIdl).toHaveBeenCalledWith(PROGRAM, { network: 'MAINNET', prefer: 'anchor-idl' })
    expect(out.idl).not.toBeNull()
    expect(out).not.toHaveProperty('ref')
    expect(out.status?.warnings).toBeUndefined()
  })

  it('warns when the IDL changed since the flow was saved and offers the new reference', async () => {
    const out = await computeIdl(
      { programId: PROGRAM, autoLoad: true, ref: savedRef({ contentHash: 'old' }) },
      {},
      { resolveIdl: fakeResolver() }
    )
    expect(out.idl).not.toBeNull()
    expect(out.status?.warnings).toEqual(['The IDL changed since this flow was saved'])
    expect(out.status?.loaded).toEqual(savedRef())
    // The saved reference stays until the user keeps the new IDL.
    expect(out).not.toHaveProperty('ref')
  })

  it('warns when the saved source no longer has the IDL', async () => {
    const resolveIdl = fakeResolver(found({ sourceChanged: true }, 'program-metadata'))
    const out = await computeIdl({ programId: PROGRAM, ref: savedRef() }, {}, { resolveIdl })
    expect(out.status?.warnings).toEqual(['IDL source changed: saved from anchor-idl, loaded from program-metadata'])
    expect(out.status?.loaded).toEqual(savedRef({ source: 'program-metadata' }))
  })

  it('replaces a reference saved for another program or network', async () => {
    const resolveIdl = fakeResolver()
    const out = await computeIdl(
      { programId: PROGRAM, ref: savedRef({ network: 'DEVNET', contentHash: 'old' }) },
      {},
      { resolveIdl }
    )
    expect(resolveIdl).toHaveBeenCalledWith(PROGRAM, { network: 'MAINNET', prefer: undefined })
    expect(out.ref).toEqual(savedRef())
    expect(out.status?.warnings).toBeUndefined()
  })

  it("reports the resolver's failures when no source has the IDL", async () => {
    const resolveIdl = fakeResolver({ idl: null, sourceChanged: false, failures: ['anchor-idl: timed out'] })
    const out = await computeIdl({ programId: PROGRAM, autoLoad: true }, {}, { resolveIdl })
    expect(out).toMatchObject({
      idl: null,
      status: { error: 'No IDL found for this program', failures: ['anchor-idl: timed out'] },
    })
    expect(out).not.toHaveProperty('ref')
  })

  it('reports an IDL the model cannot convert', async () => {
    const idl = { programId: PROGRAM, source: 'anchor-idl' as const, raw: { name: 'x' }, contentHash: HASH }
    const resolveIdl = fakeResolver(found({ idl }))
    const out = await computeIdl({ programId: PROGRAM, autoLoad: true }, {}, { resolveIdl })
    expect(out.idl).toBeNull()
    expect(out.status?.error).toBe('IDL unsupported: no instructions')
  })

  it('cannot load without a resolver (headless evaluation)', async () => {
    const out = await computeIdl({ programId: PROGRAM, autoLoad: true })
    expect(out).toMatchObject({ idl: null, status: { error: 'Loading IDLs is not available here' } })
  })

  it.each([
    ['codama', 'codama', '72rskj7regeaUYpx6bm9qZAktTLjPVMDdvPWdzuiwEgE'],
    ['anchor-v01', 'anchor', 'HsRnuVDtp1mgUH1HPvgUch7wTSFez8xjus9y5sETQX4F'],
    ['anchor-legacy', 'anchor-legacy', '79jDEA2BdHou4dcWuXAVEbnw9eSU7S1Li3PcuzU547Va'],
    ['shank', 'shank', 'HmUS9QssqLrBF3uyZY76Dzx2EeC5ZRXTFmjN2YM8tFRV'],
  ])('parses a pasted %s IDL and takes the program id from it', async (file, format, address) => {
    const resolveIdl = fakeResolver()
    const out = await computeIdl({ idlJson: fixtureIdl(file), autoLoad: true }, {}, { resolveIdl })
    expect(out.idl).toMatchObject({ kind: 'plgrnd-idl/1', format, programId: address })
    expect(out.programId).toBe(address)
    expect(out.status).toEqual({ key: 'paste', badge: `pasted · unverified · ${format}` })
    expect(out).toHaveProperty('ref', undefined)
    expect(resolveIdl).not.toHaveBeenCalled()
  })

  it('remembers a successfully pasted IDL for its program only', async () => {
    const rememberIdl = vi.fn()
    const idlJson = JSON.stringify(counterIdl)
    await computeIdl({ idlJson }, {}, { rememberIdl })
    expect(rememberIdl).not.toHaveBeenCalled()
    await computeIdl({ idlJson, programId: PROGRAM }, {}, { rememberIdl })
    expect(rememberIdl).toHaveBeenCalledWith(PROGRAM, idlJson)
    await computeIdl({ idlJson: '{"name":"x"}', programId: PROGRAM }, {}, { rememberIdl })
    expect(rememberIdl).toHaveBeenCalledTimes(1)
  })

  it('reports a pasted IDL it cannot use', async () => {
    expect((await computeIdl({ idlJson: '{', programId: PROGRAM })).status).toEqual({
      key: 'paste',
      error: 'Invalid IDL JSON',
    })
    expect((await computeIdl({ idlJson: '[1]', programId: PROGRAM })).status?.error).toMatch(/^IDL unsupported: /)
  })
})

describe('evaluateTxChain with an IDL loaded by program id', () => {
  it('passes its resolver to IDL nodes', async () => {
    const { evaluateTxChain } = await import('@/utils/flow/evaluate-tx-chain')
    const resolveIdl = fakeResolver()
    const node = (id: string, type: string, data: Record<string, unknown>) => ({
      id,
      type,
      data,
      position: { x: 0, y: 0 },
    })
    const edge = (source: string, field: string, target: string, targetField: string) => ({
      id: `${source}-${target}-${targetField}`,
      source,
      sourceHandle: `${source}-${field}-right`,
      target,
      targetHandle: `${target}-${targetField}-left`,
    })
    const [chain] = await evaluateTxChain(
      {
        nodes: [
          node('idl', 'IDL', { idlJson: '', programId: PROGRAM, autoLoad: true }),
          node('t1', 'TEXT', { text: key(1) }),
          node('t2', 'TEXT', { text: key(2) }),
          node('pi', 'PROGRAM_INSTRUCTIONS', { selectedInstruction: 'increment' }),
        ],
        edges: [
          edge('idl', 'idl', 'pi', 'idl'),
          edge('idl', 'programId', 'pi', 'programId'),
          edge('t1', 'text', 'pi', 'account_counter'),
          edge('t2', 'text', 'pi', 'account_user'),
        ],
      },
      { resolveIdl }
    )
    expect(resolveIdl).toHaveBeenCalledOnce()
    expect(chain.transaction.instructions[0].programId.toBase58()).toBe(PROGRAM)
  })
})
