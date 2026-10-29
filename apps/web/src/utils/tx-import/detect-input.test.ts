import bs58 from 'bs58'
import { Buffer } from 'buffer'
import { describe, expect, it } from 'vitest'
import { fixtureTransaction } from '@/__fixtures__/import-helpers'
import { loadTxFixture } from '@/__fixtures__/tx-helpers'
import { UnsupportedTransactionVersionError } from '@/utils/solana/message-compiler'
import { detectInput, TxImportError, type TxImportErrorCode } from './detect-input'

const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

const failsWith = (input: string, code: TxImportErrorCode) => {
  let error: unknown
  try {
    detectInput(input)
  } catch (e) {
    error = e
  }
  expect(error).toBeInstanceOf(TxImportError)
  expect((error as TxImportError).code).toBe(code)
}

describe('detectInput', () => {
  it('recognizes a signature, ignoring surrounding and inner whitespace', () => {
    const signature = loadTxFixture('jupiter-swap').input.value
    expect(detectInput(signature)).toEqual({ kind: 'signature', signature })
    expect(detectInput(`  ${signature.slice(0, 40)}\n${signature.slice(40)}  `)).toEqual({
      kind: 'signature',
      signature,
    })
  })

  it.each([
    ['partially-signed', 'legacy'],
    ['jupiter-unsigned', 0],
  ] as const)('reads a base64 transaction (%s, version %s)', (name, version) => {
    const fx = loadTxFixture(name)
    const detected = detectInput(fx.input.value)
    expect(detected).toMatchObject({ kind: 'serialized', encoding: 'base64', version })
    if (detected.kind !== 'serialized') return
    expect(base64(detected.message)).toBe(fx.wire)
    expect(detected.signatures).toEqual(fx.signatures)
  })

  it.each([
    ['memo-v2', 'legacy'],
    ['jupiter-swap', 0],
  ] as const)('reads a base58 transaction (%s, version %s)', (name, version) => {
    const detected = detectInput(bs58.encode(fixtureTransaction(name)))
    expect(detected).toMatchObject({ kind: 'serialized', encoding: 'base58', version })
    if (detected.kind === 'serialized') expect(base64(detected.message)).toBe(loadTxFixture(name).wire)
  })

  it('rejects empty input', () => failsWith('  \n ', 'empty'))

  it('rejects garbage', () => {
    failsWith('hello world!', 'invalid')
    failsWith(base64(new TextEncoder().encode('hello world, this is not a transaction')), 'invalid')
  })

  it('rejects a 63-byte signature', () => {
    failsWith(bs58.encode(new Uint8Array(63).fill(7)), 'signature-length')
  })

  it('rejects a truncated transaction', () => {
    const bytes = fixtureTransaction('jupiter-swap')
    failsWith(base64(bytes.slice(0, -10)), 'truncated')
    failsWith(bs58.encode(bytes.slice(0, bytes.length - 40)), 'truncated')
  })

  it('rejects trailing bytes after the message', () => {
    failsWith(base64(Uint8Array.from([...fixtureTransaction('memo-v2'), 0, 0])), 'invalid')
  })

  it('rejects a version-1 transaction by name', () => {
    const bytes = fixtureTransaction('jupiter-swap')
    const messageStart = 1 + 64 * bytes[0]
    expect(bytes[messageStart]).toBe(0x80)
    bytes[messageStart] = 0x81
    expect(() => detectInput(base64(bytes))).toThrow(UnsupportedTransactionVersionError)
    expect(() => detectInput(base64(bytes))).toThrow(/version 1 is not supported/)
  })
})
