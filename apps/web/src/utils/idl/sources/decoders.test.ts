import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { Buffer } from 'buffer'
import { PublicKey } from '@solana/web3.js'
import { describe, expect, it } from 'vitest'
import { FOUNDATION_IDL_AUTHORITY, anchorIdlAddress, pmpAuthorityAddress, pmpCanonicalAddress } from './addresses'
import { decodeAnchorIdlAccount } from './anchor-account'
import { MAX_IDL_BYTES, decompress } from './decompress'
import { parseMetadataAccount, readMetadataContent } from './program-metadata'

const ACCOUNTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../__fixtures__/accounts')
const account = (address: string) =>
  new Uint8Array(Buffer.from(fs.readFileSync(path.join(ACCOUNTS, `${address}.b64`), 'utf8').trim(), 'base64'))

const JUPITER = new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4')
const RAYDIUM_CLMM = new PublicKey('CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK')
const SYSTEM = new PublicKey('11111111111111111111111111111111')

const noFetch = { fetchAccount: async () => null }

describe('IDL account addresses', () => {
  it('derives the canonical and authority Program Metadata accounts', () => {
    expect(pmpCanonicalAddress(RAYDIUM_CLMM).toBase58()).toBe('4wQuz7ZDMMxihw8qwm6zt7fNzRNdEvHMAT1eyPHNhWri')
    expect(pmpAuthorityAddress(SYSTEM, FOUNDATION_IDL_AUTHORITY).toBase58()).toBe(
      '2ypWVnvjZsraGzL18SHoqnZ637uEHC73KhqiE6nfyaCV'
    )
  })

  it('derives the Anchor IDL account', async () => {
    const address = (await anchorIdlAddress(JUPITER)).toBase58()
    expect(fs.existsSync(path.join(ACCOUNTS, `${address}.b64`))).toBe(true)
  })
})

describe('decodeAnchorIdlAccount', () => {
  it('inflates the IDL and ignores the unused tail of the account', async () => {
    const idl = JSON.parse(await decodeAnchorIdlAccount(account((await anchorIdlAddress(JUPITER)).toBase58())))
    expect(idl.address).toBe(JUPITER.toBase58())
    expect(idl.instructions.length).toBeGreaterThan(0)
  })

  it('rejects truncated accounts', async () => {
    await expect(decodeAnchorIdlAccount(new Uint8Array(20))).rejects.toThrow(/too short/)
  })
})

describe('Program Metadata accounts', () => {
  it('reads a canonical account whose format byte is 0 although it holds JSON', async () => {
    const parsed = parseMetadataAccount(account('4wQuz7ZDMMxihw8qwm6zt7fNzRNdEvHMAT1eyPHNhWri'))
    expect(parsed).toMatchObject({ program: RAYDIUM_CLMM.toBase58(), canonical: true, format: 0, seed: 'idl' })
    expect(parsed).toMatchObject({ encoding: 'utf8', compression: 'zlib', dataSource: 'direct' })
    const idl = JSON.parse(await readMetadataContent(parsed, noFetch))
    expect(idl.instructions.length).toBeGreaterThan(0)
  })

  it('reads a Foundation-authority copy of a native Codama IDL', async () => {
    const parsed = parseMetadataAccount(account('2ypWVnvjZsraGzL18SHoqnZ637uEHC73KhqiE6nfyaCV'))
    expect(parsed).toMatchObject({ authority: FOUNDATION_IDL_AUTHORITY.toBase58(), canonical: false })
    const root = JSON.parse(await readMetadataContent(parsed, noFetch))
    expect(root.kind).toBe('rootNode')
    expect(root.program.publicKey).toBe(SYSTEM.toBase58())
  })

  const synthetic = (dataSource: number, data: Uint8Array, compression = 0) => {
    const header = Buffer.alloc(96)
    header[0] = 2
    SYSTEM.toBuffer().copy(header, 1)
    header.write('idl', 67)
    header[83] = 1 // utf8
    header[84] = compression
    header[86] = dataSource
    header.writeUInt32LE(data.length, 87)
    return parseMetadataAccount(new Uint8Array(Buffer.concat([header, Buffer.from(data)])))
  }

  it('follows an external-account reference with offset and length', async () => {
    const ref = Buffer.alloc(40)
    JUPITER.toBuffer().copy(ref, 0)
    ref.writeUInt32LE(3, 32)
    ref.writeUInt32LE(4, 36)
    const fetchAccount = async (address: string) =>
      address === JUPITER.toBase58() ? new Uint8Array(Buffer.from('xxx{"a"}yyy')) : null
    expect(await readMetadataContent(synthetic(2, ref), { fetchAccount })).toBe('{"a"')
  })

  it('fetches https URL sources only when URL fetching is allowed', async () => {
    const url = synthetic(1, new Uint8Array(Buffer.from('https://example.com/idl.json')))
    await expect(readMetadataContent(url, noFetch)).rejects.toThrow(/disabled/)
    const fetchUrl = async (u: string) => `fetched ${u}`
    expect(await readMetadataContent(url, { ...noFetch, fetchUrl })).toBe('fetched https://example.com/idl.json')
    const http = synthetic(1, new Uint8Array(Buffer.from('http://example.com/idl.json')))
    await expect(readMetadataContent(http, { ...noFetch, fetchUrl })).rejects.toThrow(/https/)
  })

  it('rejects other accounts', () => {
    expect(() => parseMetadataAccount(new Uint8Array(120))).toThrow(/Not a Program Metadata account/)
  })
})

describe('decompress', () => {
  it('caps the decompressed size', async () => {
    const bomb = new Uint8Array(zlib.deflateSync(Buffer.alloc(MAX_IDL_BYTES + 1)))
    await expect(decompress(bomb, 'zlib')).rejects.toThrow(/larger than/)
  })
})
