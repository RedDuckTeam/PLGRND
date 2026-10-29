import { Buffer } from 'buffer'
import { decompress } from './decompress'

// Anchor IDL account: 8-byte discriminator | authority (32) | u32 LE length | zlib-compressed JSON. The account is
// often larger than the data it holds, so only `length` bytes are read.
const HEADER = 8 + 32 + 4

export async function decodeAnchorIdlAccount(account: Uint8Array): Promise<string> {
  if (account.length < HEADER) throw new Error('Anchor IDL account is too short')
  const length = Buffer.from(account).readUInt32LE(40)
  if (HEADER + length > account.length) throw new Error('Anchor IDL account length exceeds its data')
  const json = await decompress(account.subarray(HEADER, HEADER + length), 'zlib')
  return new TextDecoder().decode(json)
}
