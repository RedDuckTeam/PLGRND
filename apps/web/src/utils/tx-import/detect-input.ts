import bs58 from 'bs58'
import { Buffer } from 'buffer'
import { VersionedMessage } from '@solana/web3.js'
import { messageVersion, type MessageVersion } from '@/utils/solana/message-compiler'

export type TxImportErrorCode = 'empty' | 'invalid' | 'signature-length' | 'truncated' | 'not-found' | 'guard'

/** Why an input could not be imported (unsupported message versions throw UnsupportedTransactionVersionError). */
export class TxImportError extends Error {
  readonly code: TxImportErrorCode

  constructor(code: TxImportErrorCode, message: string) {
    super(message)
    this.name = 'TxImportError'
    this.code = code
  }
}

export type DetectedInput =
  | { kind: 'signature'; signature: string }
  | {
      kind: 'serialized'
      encoding: 'base64' | 'base58'
      /** The whole transaction: signatures, then the message. */
      bytes: Uint8Array
      message: Uint8Array
      /** base58; all `1`s for an empty slot. */
      signatures: string[]
      version: MessageVersion
    }

const SIGNATURE_LENGTH = 64
// A transaction fits in a 1232-byte packet, so it never has more signatures than this.
const MAX_SIGNATURES = 19
// Shorter than any transaction: a base58 string of this size was meant as a signature.
const MAX_SIGNATURE_LIKE = 100
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/
const BASE64 = /^[A-Za-z0-9+/_-]+={0,2}$/

class Truncated extends Error {}

const reader = (bytes: Uint8Array) => {
  let offset = 0
  const need = (n: number) => {
    if (offset + n > bytes.length) throw new Truncated()
  }
  const u8 = () => {
    need(1)
    return bytes[offset++]
  }
  return {
    get offset() {
      return offset
    },
    u8,
    skip(n: number) {
      need(n)
      offset += n
    },
    // compact-u16 ("shortvec") length prefix
    length() {
      let value = 0
      for (let i = 0; i < 3; i++) {
        const byte = u8()
        value |= (byte & 0x7f) << (7 * i)
        if ((byte & 0x80) === 0) return value
      }
      throw new TxImportError('invalid', 'Not a transaction: malformed length prefix')
    },
  }
}

const notATransaction = (why: string) => new TxImportError('invalid', `Not a transaction: ${why}`)

/**
 * Splits serialized transaction bytes into signatures and message, checking the message layout: version (other
 * than legacy and 0 → UnsupportedTransactionVersionError), signature count, and no missing or extra bytes.
 */
export function splitTransaction(bytes: Uint8Array): {
  signatures: string[]
  message: Uint8Array
  version: MessageVersion
} {
  const tx = reader(bytes)
  let count: number
  try {
    count = tx.length()
    if (count === 0 || count > MAX_SIGNATURES) throw notATransaction('no plausible signature count')
    tx.skip(count * SIGNATURE_LENGTH)
  } catch (error) {
    if (error instanceof Truncated) throw notATransaction('too short')
    throw error
  }
  const signatures = Array.from({ length: count }, (_, i) =>
    bs58.encode(bytes.subarray(1 + i * SIGNATURE_LENGTH, 1 + (i + 1) * SIGNATURE_LENGTH))
  )
  const message = bytes.slice(tx.offset)
  if (message.length === 0) throw new TxImportError('truncated', 'The transaction is truncated: it has no message')
  const version = messageVersion(message)

  const m = reader(message)
  try {
    if (version === 0) m.u8()
    const required = m.u8()
    if (required !== count) throw notATransaction(`${count} signatures for ${required} signers`)
    m.skip(2)
    m.skip(m.length() * 32)
    m.skip(32)
    for (let n = m.length(); n > 0; n--) {
      m.u8()
      m.skip(m.length())
      m.skip(m.length())
    }
    if (version === 0) {
      for (let n = m.length(); n > 0; n--) {
        m.skip(32)
        m.skip(m.length())
        m.skip(m.length())
      }
    }
  } catch (error) {
    if (error instanceof Truncated) {
      throw new TxImportError('truncated', 'The transaction is truncated: its message ends early')
    }
    throw error
  }
  if (m.offset !== message.length) throw notATransaction('unexpected bytes after the message')
  try {
    VersionedMessage.deserialize(message)
  } catch (error) {
    throw notATransaction(error instanceof Error ? error.message : String(error))
  }
  return { signatures, message, version }
}

const serialized = (bytes: Uint8Array, encoding: 'base64' | 'base58'): DetectedInput => ({
  kind: 'serialized',
  encoding,
  bytes,
  ...splitTransaction(bytes),
})

/** A transaction signature, or a serialized transaction in base64 or base58 (legacy or version 0). */
export function detectInput(input: string): DetectedInput {
  const text = input.replace(/\s+/g, '')
  if (!text) throw new TxImportError('empty', 'Paste a transaction signature or a serialized transaction')

  if (BASE58.test(text)) {
    const bytes = bs58.decode(text)
    if (bytes.length === SIGNATURE_LENGTH) return { kind: 'signature', signature: text }
    let base58Error: unknown
    try {
      return serialized(bytes, 'base58')
    } catch (error) {
      base58Error = error
    }
    // Base58 characters are base64 characters too.
    try {
      return serialized(new Uint8Array(Buffer.from(text, 'base64')), 'base64')
    } catch {
      // Report the base58 reading below.
    }
    if (bytes.length < MAX_SIGNATURE_LIKE) {
      throw new TxImportError(
        'signature-length',
        `A transaction signature is ${SIGNATURE_LENGTH} bytes, this one decodes to ${bytes.length}`
      )
    }
    throw base58Error
  }

  if (BASE64.test(text)) {
    const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
    return serialized(new Uint8Array(Buffer.from(base64, 'base64')), 'base64')
  }

  throw new TxImportError('invalid', 'Not a transaction signature or a serialized transaction (base64 or base58)')
}
