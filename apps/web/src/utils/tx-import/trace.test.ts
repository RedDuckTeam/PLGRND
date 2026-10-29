import { Buffer } from 'buffer'
import { describe, expect, it } from 'vitest'
import { VersionedMessage } from '@solana/web3.js'
import { fixtureIdl, loadTxFixture, txFixtureNames } from '@/__fixtures__/tx-helpers'
import { normalizeIdl } from '@/utils/idl/model/normalize'
import type { ProgramIdl } from '@/utils/idl/model/program-idl'
import { buildTrace, messageForTrace, traceProgramIds, type CpiEntry, type RpcExecution } from './trace'

const JUPITER = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

const idlCache = new Map<string, ProgramIdl | null>()
const idlFor = async (programId: string) => {
  if (!idlCache.has(programId)) {
    const raw = await fixtureIdl(programId)
    idlCache.set(programId, raw ? normalizeIdl(raw, programId) : null)
  }
  return idlCache.get(programId)
}

const traceFixture = async (name: string) => {
  const fx = loadTxFixture(name) as ReturnType<typeof loadTxFixture> & { slot?: number }
  const execution = (fx.meta ?? fx.simulation) as RpcExecution
  const message = messageForTrace(
    VersionedMessage.deserialize(Buffer.from(fx.wire, 'base64')),
    execution.loadedAddresses
  )
  const idls = new Map<string, ProgramIdl>()
  for (const programId of traceProgramIds({ message, execution })) {
    const idl = await idlFor(programId)
    if (idl) idls.set(programId, idl)
  }
  return buildTrace({ message, execution, simulated: !fx.meta, slot: fx.slot }, idls)
}

const flatten = (entries: CpiEntry[]): CpiEntry[] => entries.flatMap((e) => [e, ...flatten(e.children)])

describe('buildTrace', () => {
  it.each(txFixtureNames())('%s: plain JSON (no bigint)', async (name) => {
    const trace = await traceFixture(name)
    expect(JSON.parse(JSON.stringify(trace))).toEqual(trace)
  })

  it('names a failed Jupiter swap error from the IDL', async () => {
    const trace = await traceFixture('failed-tx')
    expect(trace.status).toBe('failed')
    expect(trace.error).toMatchObject({
      instructionIndex: 4,
      programId: JUPITER,
      code: 6001,
      name: 'SlippageToleranceExceeded',
      message: 'Slippage tolerance exceeded',
    })
    expect(trace.fee).toBe('20098')
    expect(trace.computeUnits).toBe(96061)
    // Only the fee payer's balance changed: the fee.
    expect(trace.solDeltas).toEqual([
      {
        account: 'CZS7B5Y5MJvFiuQnVJyJuDkDokYpf6c3qhcDPQu8asV',
        before: '0.768856673',
        after: '0.768836575',
        delta: '-0.000020098',
      },
    ])
    expect(trace.tokenDeltas).toEqual([])
  })

  it('builds the Jupiter CPI tree by stack height, with IDL names and event labels', async () => {
    const trace = await traceFixture('jupiter-swap')
    expect(trace.status).toBe('success')
    expect(trace.cpiTree).toHaveLength(6)
    const all = flatten(trace.cpiTree)
    expect(all).toHaveLength(14)
    expect(Math.max(...all.map((e) => e.depth))).toBe(3)
    const route = trace.cpiTree[4]
    expect(route).toMatchObject({ programId: JUPITER, name: 'route_with_token_ledger', depth: 1 })
    expect(route.children.map((c) => c.depth)).toEqual([2, 2])
    expect(route.children[0].children.map((c) => c.name)).toEqual(['transferChecked', 'transferChecked'])
    expect(route.children[1]).toMatchObject({ programId: JUPITER, name: 'event SwapEvent', children: [] })
    expect(all.filter((e) => e.name?.startsWith('event '))).toHaveLength(2)
    expect(trace.logs).toHaveLength(47)
    expect(trace.simulated).toBeUndefined()
  })

  it('reports SPL token deltas per owner and mint in UI amounts', async () => {
    const trace = await traceFixture('spl-transfer-ata-create')
    expect(trace.tokenDeltas).toEqual([
      {
        owner: '3YiSkWUwpqSyRhhA8mHw82TghiYLJUPKT7bTsASxWaMq',
        mint: USDC,
        decimals: 6,
        before: '1961.71146',
        after: '1961.71156',
        delta: '+0.0001',
      },
      {
        owner: 'HQGURgzEpdDKjCysCAfCCJoKgjwHp9szXdRiyP9vPaaR',
        mint: USDC,
        decimals: 6,
        before: '113.338483',
        after: '113.338383',
        delta: '-0.0001',
      },
    ])
    expect(trace.solDeltas).toHaveLength(1)
    expect(trace.cpiTree[0]).toMatchObject({ name: 'create', children: [{ name: 'getAccountDataSize' }, {}, {}, {}] })
  })

  it('marks a simulated unsigned transaction with its slot', async () => {
    const trace = await traceFixture('jupiter-unsigned')
    expect(trace.simulated).toEqual({ slot: 462504027 })
    expect(trace.status).toBe('success')
    expect(trace.fee).toBe('49868')
    expect(trace.computeUnits).toBe(60999)
    // jsonParsed inner instructions keep the RPC's name.
    expect(flatten(trace.cpiTree).filter((e) => e.name === 'transfer')).toHaveLength(2)
  })

  it('leaves fee and balances undefined when a simulation lacks them', async () => {
    const fx = loadTxFixture('jupiter-unsigned')
    const execution: RpcExecution = {
      ...(fx.simulation as RpcExecution),
      fee: undefined,
      preBalances: undefined,
      postTokenBalances: undefined,
    }
    const message = messageForTrace(
      VersionedMessage.deserialize(Buffer.from(fx.wire, 'base64')),
      execution.loadedAddresses
    )
    const trace = buildTrace({ message, execution, simulated: true }, new Map())
    expect(trace).toMatchObject({ status: 'success', simulated: {}, computeUnits: 60999 })
    expect(trace.fee).toBeUndefined()
    expect(trace.solDeltas).toBeUndefined()
    expect(trace.tokenDeltas).toBeUndefined()
    expect(trace.cpiTree[4].name).toBeUndefined()
  })
})
