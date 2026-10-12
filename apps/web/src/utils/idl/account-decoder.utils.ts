import { Buffer } from 'buffer'
import { PublicKey } from '@solana/web3.js'
import { sha256 } from 'js-sha256'
import bs58 from 'bs58'
import type { IdlAccount, IdlField, IdlType } from '@/types/nodes/programs/idl-node'

export const getAccountDiscriminator = (accountName: string): Buffer => {
  const hash = sha256(`account:${accountName}`)
  return Buffer.from(hash, 'hex').slice(0, 8)
}

interface Reader {
  buf: Buffer
  offset: number
}

const readPrimitive = (r: Reader, type: string): unknown => {
  switch (type) {
    case 'bool': {
      const v = r.buf.readUInt8(r.offset) !== 0
      r.offset += 1
      return v
    }
    case 'u8': {
      const v = r.buf.readUInt8(r.offset)
      r.offset += 1
      return v
    }
    case 'i8': {
      const v = r.buf.readInt8(r.offset)
      r.offset += 1
      return v
    }
    case 'u16': {
      const v = r.buf.readUInt16LE(r.offset)
      r.offset += 2
      return v
    }
    case 'i16': {
      const v = r.buf.readInt16LE(r.offset)
      r.offset += 2
      return v
    }
    case 'u32': {
      const v = r.buf.readUInt32LE(r.offset)
      r.offset += 4
      return v
    }
    case 'i32': {
      const v = r.buf.readInt32LE(r.offset)
      r.offset += 4
      return v
    }
    case 'u64': {
      const v = r.buf.readBigUInt64LE(r.offset)
      r.offset += 8
      return v.toString()
    }
    case 'i64': {
      const v = r.buf.readBigInt64LE(r.offset)
      r.offset += 8
      return v.toString()
    }
    case 'u128':
    case 'i128': {
      const lo = r.buf.readBigUInt64LE(r.offset)
      const hi = r.buf.readBigUInt64LE(r.offset + 8)
      r.offset += 16
      const value = (hi << 64n) | lo
      return value.toString()
    }
    case 'string': {
      const len = r.buf.readUInt32LE(r.offset)
      r.offset += 4
      const str = r.buf.slice(r.offset, r.offset + len).toString('utf-8')
      r.offset += len
      return str
    }
    case 'bytes': {
      const len = r.buf.readUInt32LE(r.offset)
      r.offset += 4
      const bytes = r.buf.slice(r.offset, r.offset + len)
      r.offset += len
      return bs58.encode(bytes)
    }
    case 'publicKey': {
      const bytes = r.buf.slice(r.offset, r.offset + 32)
      r.offset += 32
      return new PublicKey(bytes).toBase58()
    }
    default:
      throw new Error(`Unsupported primitive type: ${type}`)
  }
}

const readField = (r: Reader, type: IdlType): unknown => {
  if (typeof type === 'string') return readPrimitive(r, type)

  if ('option' in type) {
    const present = r.buf.readUInt8(r.offset) !== 0
    r.offset += 1
    return present ? readField(r, type.option) : null
  }

  if ('vec' in type) {
    const len = r.buf.readUInt32LE(r.offset)
    r.offset += 4
    const items: unknown[] = []
    for (let i = 0; i < len; i++) items.push(readField(r, type.vec))
    return items
  }

  if ('array' in type) {
    const [inner, len] = type.array
    const items: unknown[] = []
    for (let i = 0; i < len; i++) items.push(readField(r, inner))
    return items
  }

  if ('defined' in type) {
    throw new Error(`Defined types are not supported in account decoder: ${type.defined}`)
  }

  throw new Error(`Unknown IDL type: ${JSON.stringify(type)}`)
}

export const idlTypeToHandleDataType = (type: IdlType): string => {
  if (typeof type === 'string') {
    switch (type) {
      case 'bool':
        return 'any'
      case 'string':
      case 'bytes':
        return 'text'
      case 'publicKey':
        return 'publicKey'
      case 'u8':
      case 'i8':
      case 'u16':
      case 'i16':
      case 'u32':
      case 'i32':
      case 'u64':
      case 'i64':
      case 'u128':
      case 'i128':
      case 'f32':
      case 'f64':
        return 'number'
      default:
        return 'any'
    }
  }
  return 'any'
}

export interface DecodedAccount {
  fields: Record<string, unknown>
}

export const decodeAccount = (
  accountDef: IdlAccount,
  data: Buffer,
  options: { skipDiscriminator?: boolean } = {}
): DecodedAccount => {
  let body = data
  if (!options.skipDiscriminator) {
    if (data.length < 8) throw new Error('Account data too short for discriminator')
    const expected = getAccountDiscriminator(accountDef.name)
    const actual = data.slice(0, 8)
    if (!expected.equals(actual)) {
      throw new Error(`Discriminator mismatch for "${accountDef.name}"`)
    }
    body = data.slice(8)
  }

  const reader: Reader = { buf: body, offset: 0 }
  const fields: Record<string, unknown> = {}
  for (const field of accountDef.type.fields as IdlField[]) {
    fields[field.name] = readField(reader, field.type)
  }
  return { fields }
}
