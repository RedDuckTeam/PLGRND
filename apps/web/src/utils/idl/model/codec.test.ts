import { Buffer } from 'buffer'
import { describe, expect, it } from 'vitest'
import counterIdl from '@/constants/programs/counter/counter.json'
import { fixtureIdl, fixtureInstructions, txFixtureNames, upstreamIdl } from '@/__fixtures__/tx-helpers'
import { loadCaseFlow, BASELINE_CASES } from '@/__fixtures__/flows/baseline-cases'
import { decodeInstruction, encodeInstructionData } from './codec'
import { normalizeIdl } from './normalize'
import { findInstruction, type ProgramIdl } from './program-idl'

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex')
// Anchor's emit_cpi! self-invocation carries an event, not an instruction (sha256("anchor:event")[0..8]).
const EVENT_CPI_TAG = 'e445a52e51cb9a1d'
// Inner instructions whose bytes carry more than their IDL models; the guard must flag them, never claim exact.
// The ATA program passes Token-2022's extension list (here ImmutableOwner, 0700) to GetAccountDataSize, which the
// Token and Token-2022 Codama IDLs describe without arguments.
const KNOWN_INEXACT = new Set(['getAccountDataSize'])

const idls = new Map<string, ProgramIdl | null>()
const idlFor = async (programId: string) => {
  if (!idls.has(programId)) {
    const raw = await fixtureIdl(programId)
    idls.set(programId, raw ? normalizeIdl(raw, programId) : null)
  }
  return idls.get(programId)!
}

describe('decodeInstruction on captured transactions', () => {
  it.each(txFixtureNames())(
    '%s: top-level instructions decode exactly; inner ones never claim false exactness',
    async (name) => {
      for (const ix of fixtureInstructions(name)) {
        const idl = await idlFor(ix.programId)
        if (!idl || hex(ix.data).startsWith(EVENT_CPI_TAG)) continue
        const result = decodeInstruction(idl, ix)
        const label = `${name} ${ix.where} ${ix.programId}`
        if (ix.where.startsWith('top#')) {
          expect(result, label).not.toBeNull()
          expect(result!.exact, `${label} ${result!.name}`).toBe(true)
        }
        if (!result) continue
        if (!result.exact) expect(KNOWN_INEXACT.has(result.name), `${label} ${result.name}`).toBe(true)
        expect(result.accounts.map((a) => a.pubkey)).toEqual(ix.accounts.map((a) => a.pubkey))
        expect(JSON.stringify(result.args)).not.toMatch(/\d+n\b/)
      }
    }
  )

  it('decodes the empty-data ATA create and re-encodes it to empty data', async () => {
    const ix = fixtureInstructions('spl-transfer-ata-create').find((i) => i.where === 'top#0')!
    const result = decodeInstruction((await idlFor(ix.programId))!, ix)
    expect(ix.data.length).toBe(0)
    expect(result).toMatchObject({ name: 'create', legacyEmptyData: true, exact: true })
  })

  it('flags a trailing byte as inexact', async () => {
    const ix = fixtureInstructions('spl-transfer-ata-create').find((i) => i.where === 'top#1')!
    const result = decodeInstruction((await idlFor(ix.programId))!, { ...ix, data: new Uint8Array([...ix.data, 0]) })
    expect(result === null || !result.exact).toBe(true)
  })
})

const TOKEN_METADATA = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
const tokenMetadataIdl = upstreamIdl('token-metadata')

// Needs scripts/fetch-upstream-idls.mjs (the IDL is not redistributable); skipped, and counted as such, otherwise.
describe.skipIf(!tokenMetadataIdl)('Token Metadata (Shank) from its upstream IDL', () => {
  it('decodes an instruction sent without its optional accounts exactly, with guessed labels', () => {
    const idl = normalizeIdl(tokenMetadataIdl, TOKEN_METADATA)
    expect(idl.format).toBe('shank')
    const ix = fixtureInstructions('token-metadata').find((i) => i.programId === TOKEN_METADATA)!
    const result = decodeInstruction(idl, ix)!
    expect(result.name).toBe('CreateMetadataAccountV3')
    expect(result.exact).toBe(true)
    expect(result.accounts.length).toBeLessThan(findInstruction(idl, result.name)!.accounts.length)
  })
})

describe('encodeInstructionData on legacy IDLs', () => {
  it('builds the counter discriminators exactly as the frozen baseline', () => {
    const idl = normalizeIdl(counterIdl, 'FCRU9Fnd1XCPeYhtSnBamgGph41Eu5TKu8woYYQE5JUB')
    expect(idl.format).toBe('anchor-legacy')
    expect(hex(encodeInstructionData(idl, 'increment', {}))).toBe('0b12680968ae3b21')
    expect(hex(encodeInstructionData(idl, 'initialize', {}))).toBe('afaf6d1f0d989bed')
  })

  it('accepts a NUMBER-node value for a u64 argument (solanamobile counter)', () => {
    const flow = loadCaseFlow(BASELINE_CASES.find((c) => c.name === 'solanamobile-counter')!)
    const raw = JSON.parse(flow.nodes.find((n) => n.type === 'IDL')!.data.idlJson as string)
    const idl = normalizeIdl(raw, raw.metadata.address)
    expect(hex(encodeInstructionData(idl, 'increment', { amount: 1 }))).toBe('0b12680968ae3b210100000000000000')
    expect(hex(encodeInstructionData(idl, 'increment', { amount: '1' }))).toBe('0b12680968ae3b210100000000000000')
  })

  it('uses the snake_case discriminator for camelCase legacy names', () => {
    const idl = normalizeIdl(
      {
        version: '0.1.0',
        name: 'legacy',
        instructions: [{ name: 'setAuthority', accounts: [], args: [] }],
      },
      'FCRU9Fnd1XCPeYhtSnBamgGph41Eu5TKu8woYYQE5JUB'
    )
    // sha256("global:set_authority")[0..8]
    expect(hex(encodeInstructionData(idl, 'setAuthority', {}))).toBe('85fa25156ea31a79')
  })

  it('rejects a missing argument', () => {
    const flow = loadCaseFlow(BASELINE_CASES.find((c) => c.name === 'solanamobile-counter')!)
    const raw = JSON.parse(flow.nodes.find((n) => n.type === 'IDL')!.data.idlJson as string)
    expect(() => encodeInstructionData(normalizeIdl(raw, raw.metadata.address), 'increment', {})).toThrow(/Missing/)
  })
})

describe('special cases', () => {
  it('decodes Memo v1 with the Memo IDL as UTF-8 (alias)', async () => {
    const ix = fixtureInstructions('memo-v1').find((i) => i.programId.startsWith('Memo1'))!
    const memoIdl = await fixtureIdl('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
    const result = decodeInstruction(normalizeIdl(memoIdl, ix.programId), ix)!
    expect(result.exact).toBe(true)
    expect(Object.values(result.args)[0]).toBe(new TextDecoder().decode(ix.data))
  })

  it.skipIf(!tokenMetadataIdl)('labels accounts by guess when optional accounts were omitted', () => {
    const idl = normalizeIdl(tokenMetadataIdl, TOKEN_METADATA)
    const ix = fixtureInstructions('token-metadata').find((i) => i.programId === TOKEN_METADATA)!
    const labels = decodeInstruction(idl, ix)!.accounts.map((a) => a.name)
    expect(labels.every((label) => /^#\d+ \(.+\?\)$/.test(label))).toBe(true)
  })
})
