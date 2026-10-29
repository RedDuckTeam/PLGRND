import { describe, expect, it } from 'vitest'
import { Buffer } from 'buffer'
import { PublicKey } from '@solana/web3.js'
import { fixtureInstructions, loadTxFixture, txFixtureNames } from '@/__fixtures__/tx-helpers'
import {
  compileMessage,
  decompileMessage,
  UnsupportedTransactionVersionError,
  type AltAccounts,
  type DecompiledMessage,
  type MessageDraft,
  type MessageInstruction,
} from './message-compiler'

const load = (name: string) => {
  const fx = loadTxFixture(name)
  return { wire: new Uint8Array(Buffer.from(fx.wire, 'base64')), alts: (fx.altAccounts ?? {}) as AltAccounts }
}

const draftOf = (m: DecompiledMessage, instructions: MessageInstruction[] = m.instructions): MessageDraft => ({
  version: m.version,
  feePayer: m.staticKeys[0],
  instructions,
  lookupTables: m.lookups.map((l) => l.table),
})

const NEW_KEY = new PublicKey(new Uint8Array(32).fill(9)).toBase58()

// A writable non-signer that no instruction invokes, so its flag can be flipped on every meta that uses it.
const flippableKey = (m: DecompiledMessage) => {
  const programs = new Set(m.instructions.map((ix) => ix.programId))
  return m.instructions.flatMap((ix) => ix.metas).find((a) => a.isWritable && !a.isSigner && !programs.has(a.pubkey))!
    .pubkey
}

describe('decompileMessage / compileMessage', () => {
  it.each(txFixtureNames())('%s: compiles back to the wire message with its original blockhash', (name) => {
    const { wire, alts } = load(name)
    const m = decompileMessage(wire, alts)
    expect(compileMessage(draftOf(m), m.recentBlockhash, alts, m.hints)).toEqual(wire)
  })

  it.each(txFixtureNames())('%s: resolves the same top-level instructions as the fixture helper', (name) => {
    const { wire, alts } = load(name)
    const expected = fixtureInstructions(name)
      .filter((ix) => ix.where.startsWith('top#'))
      .map(({ programId, accounts, data }) => ({ programId, metas: accounts, data }))
    expect(decompileMessage(wire, alts).instructions).toEqual(expected)
  })

  describe.each(['memo-v2', 'spl-transfer-ata-create', 'jupiter-swap', 'raydium-clmm-swap'])('%s edited', (name) => {
    const { wire, alts } = load(name)
    const original = decompileMessage(wire, alts)

    const roundTrip = (instructions: MessageInstruction[]) => {
      const bytes = compileMessage(draftOf(original, instructions), original.recentBlockhash, alts, original.hints)
      expect(bytes).not.toEqual(wire)
      return decompileMessage(bytes, alts).instructions
    }

    it('flipping a writable flag compiles to the edited instructions', () => {
      const key = flippableKey(original)
      const edited = original.instructions.map((ix) => ({
        ...ix,
        metas: ix.metas.map((a) => (a.pubkey === key ? { ...a, isWritable: false } : a)),
      }))
      expect(roundTrip(edited)).toEqual(edited)
    })

    it('adding a key compiles to the edited instructions', () => {
      const edited = original.instructions.map((ix, i) =>
        i === original.instructions.length - 1
          ? { ...ix, metas: [...ix.metas, { pubkey: NEW_KEY, isSigner: false, isWritable: false }] }
          : ix
      )
      expect(roundTrip(edited)).toEqual(edited)
    })

    it('removing an instruction compiles to the edited instructions', () => {
      const edited = original.instructions.slice(0, -1)
      expect(roundTrip(edited)).toEqual(edited)
    })
  })

  it('does not replay a lookup index that now maps to another key', () => {
    const { wire, alts } = load('jupiter-swap')
    const m = decompileMessage(wire, alts)
    const { table, writable } = m.lookups.find((l) => l.writable.length > 0)!
    const changed = { ...alts, [table]: alts[table].map((a, i) => (i === writable[0] ? NEW_KEY : a)) }
    const bytes = compileMessage(draftOf(m), m.recentBlockhash, changed, m.hints)
    expect(bytes).not.toEqual(wire)
    expect(decompileMessage(bytes, changed).instructions).toEqual(m.instructions)
  })

  it('does not replay hints of another version', () => {
    const { wire } = load('memo-v2')
    const m = decompileMessage(wire)
    const bytes = compileMessage({ ...draftOf(m), version: 0 }, m.recentBlockhash, {}, m.hints)
    expect(bytes[0]).toBe(0x80)
    expect(decompileMessage(bytes).instructions).toEqual(m.instructions)
  })

  it('rejects messages of other versions, naming the version', () => {
    const { wire, alts } = load('jupiter-swap')
    const v1 = Uint8Array.from(wire)
    v1[0] = 0x81
    expect(() => decompileMessage(v1, alts)).toThrow(UnsupportedTransactionVersionError)
    expect(() => decompileMessage(v1, alts)).toThrow(/version 1\b/)
  })

  it('rejects a lookup table it was not given and trailing bytes', () => {
    const { wire } = load('jupiter-swap')
    expect(() => decompileMessage(wire, {})).toThrow(/is not loaded/)
    const { wire: legacy } = load('memo-v2')
    expect(() => decompileMessage(Uint8Array.from([...legacy, 0]))).toThrow(/after the end/)
  })
})
