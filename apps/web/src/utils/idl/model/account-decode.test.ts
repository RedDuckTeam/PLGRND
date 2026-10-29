import { createHash } from 'node:crypto'
import { Buffer } from 'buffer'
import { describe, expect, it } from 'vitest'
import counterIdl from '@/constants/programs/counter/counter.json'
import { decodeAccountOfType } from './codec'
import { normalizeIdl } from './normalize'

const PROGRAM = 'FCRU9Fnd1XCPeYhtSnBamgGph41Eu5TKu8woYYQE5JUB'
const discriminator = (name: string) => createHash('sha256').update(`account:${name}`).digest().subarray(0, 8)
const u64 = (n: bigint) => {
  const bytes = Buffer.alloc(8)
  bytes.writeBigUInt64LE(n)
  return bytes
}

// PROGRAM_ACCOUNT decoding, as example flow 5 does with its counter account.
describe('decodeAccountOfType', () => {
  const idl = normalizeIdl(
    {
      ...counterIdl,
      accounts: [
        ...counterIdl.accounts,
        { name: 'Config', type: { kind: 'struct', fields: [{ name: 'admin', type: 'publicKey' }] } },
      ],
    },
    PROGRAM
  )

  it('decodes a Counter account, u64 as a string', () => {
    const data = new Uint8Array(Buffer.concat([discriminator('Counter'), u64(5n)]))
    expect(decodeAccountOfType(idl, 'Counter', data)).toEqual({ count: '5' })
  })

  it('refuses data whose discriminator names another account type', () => {
    const data = new Uint8Array(Buffer.concat([discriminator('Config'), Buffer.alloc(32, 1)]))
    expect(() => decodeAccountOfType(idl, 'Counter', data)).toThrow('This account holds a Config, not a Counter')
  })

  it('refuses data of no known account type', () => {
    const data = new Uint8Array(Buffer.concat([Buffer.alloc(8), u64(5n)]))
    expect(() => decodeAccountOfType(idl, 'Counter', data)).toThrow('The account data is not a Counter')
  })
})
