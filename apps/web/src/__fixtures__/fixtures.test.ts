import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { VersionedMessage } from '@solana/web3.js'
import { describe, expect, it } from 'vitest'

// Shape checks for the offline corpus written by scripts/capture-fixture.mjs (see README.md).
const DIR = path.dirname(fileURLToPath(import.meta.url))
const MAX_FIXTURE_BYTES = 300 * 1024
const MAX_ACCOUNT_FILE_BYTES = 280 * 1024
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

interface TxFixture {
  name: string
  network: 'mainnet' | 'devnet'
  input: { kind: 'signature' | 'serialized'; value: string; encoding?: 'base64' | 'base58' }
  version: 'legacy' | 0
  wire: string
  signatures: string[]
  meta?: { err: unknown; loadedAddresses?: { writable: string[]; readonly: string[] } }
  simulation?: { err?: unknown; rpcError?: unknown }
  altAccounts: Record<string, string[]>
  programs: string[]
  accounts: Record<string, string>
  accountMeta: Record<string, { program: string; kind: string; owner: string }>
}

const isBase64 = (value: unknown): value is string =>
  typeof value === 'string' && value.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value)

const txFiles = fs
  .readdirSync(path.join(DIR, 'tx'))
  .filter((file) => file.endsWith('.json'))
  .sort()

describe('tx fixtures', () => {
  it('has the full corpus', () => {
    expect(txFiles.length).toBeGreaterThanOrEqual(14)
  })

  describe.each(txFiles)('%s', (file) => {
    const raw = fs.readFileSync(path.join(DIR, 'tx', file), 'utf8')
    const fixture = JSON.parse(raw) as TxFixture

    it('fits the size budget', () => {
      expect(Buffer.byteLength(raw)).toBeLessThanOrEqual(MAX_FIXTURE_BYTES)
    })

    it('has the required fields', () => {
      expect(fixture.name).toBe(file.replace(/\.json$/, ''))
      expect(['mainnet', 'devnet']).toContain(fixture.network)
      expect(['legacy', 0]).toContain(fixture.version)
      expect(fixture.signatures.length).toBeGreaterThan(0)
      for (const signature of fixture.signatures) expect(signature).toMatch(BASE58)
      expect(Array.isArray(fixture.programs)).toBe(true)
      for (const program of fixture.programs) expect(program).toMatch(ADDRESS)
      for (const [table, addresses] of Object.entries(fixture.altAccounts)) {
        expect(table).toMatch(ADDRESS)
        for (const address of addresses) expect(address).toMatch(ADDRESS)
      }
      if (fixture.input.kind === 'signature') {
        expect(fixture.input.value).toBe(fixture.signatures[0])
        expect(fixture.meta).toBeTypeOf('object')
        expect(fixture.simulation).toBeUndefined()
      } else {
        expect(fixture.input.kind).toBe('serialized')
        expect(fixture.simulation).toBeTypeOf('object')
        expect(fixture.meta).toBeUndefined()
        if (fixture.input.encoding === 'base64') expect(isBase64(fixture.input.value)).toBe(true)
        else expect(fixture.input.value).toMatch(BASE58)
      }
    })

    it('has a decodable message whose programs are all listed', () => {
      expect(isBase64(fixture.wire)).toBe(true)
      const bytes = Buffer.from(fixture.wire, 'base64')
      expect(bytes.length).toBeGreaterThan(0)
      const message = VersionedMessage.deserialize(bytes)
      expect(message.version).toBe(fixture.version)
      expect(message.header.numRequiredSignatures).toBe(fixture.signatures.length)

      const loaded: { writable: string[]; readonly: string[] } = { writable: [], readonly: [] }
      for (const lookup of message.addressTableLookups) {
        const table = fixture.altAccounts[lookup.accountKey.toBase58()]
        expect(table).toBeDefined()
        loaded.writable.push(...lookup.writableIndexes.map((i) => table[i]))
      }
      for (const lookup of message.addressTableLookups) {
        const table = fixture.altAccounts[lookup.accountKey.toBase58()]
        loaded.readonly.push(...lookup.readonlyIndexes.map((i) => table[i]))
      }
      if (fixture.meta?.loadedAddresses) {
        expect(loaded.writable).toEqual(fixture.meta.loadedAddresses.writable)
        expect(loaded.readonly).toEqual(fixture.meta.loadedAddresses.readonly)
      }

      const keys = [...message.staticAccountKeys.map((key) => key.toBase58()), ...loaded.writable, ...loaded.readonly]
      for (const ix of message.compiledInstructions) expect(fixture.programs).toContain(keys[ix.programIdIndex])
    })

    it('references existing raw account files within the budget', () => {
      expect(Object.keys(fixture.accountMeta).sort()).toEqual(Object.keys(fixture.accounts).sort())
      for (const [address, accountFile] of Object.entries(fixture.accounts)) {
        expect(address).toMatch(ADDRESS)
        expect(accountFile.startsWith(address)).toBe(true)
        const accountPath = path.join(DIR, 'accounts', accountFile)
        expect(fs.existsSync(accountPath)).toBe(true)
        const content = fs.readFileSync(accountPath, 'utf8')
        expect(Buffer.byteLength(content)).toBeLessThanOrEqual(MAX_ACCOUNT_FILE_BYTES)
        expect(isBase64(content)).toBe(true)
        expect(fixture.programs).toContain(fixture.accountMeta[address].program)
        expect(['pmp-canonical', 'pmp-foundation', 'anchor-idl']).toContain(fixture.accountMeta[address].kind)
      }
    })
  })
})

describe('all-types IDLs', () => {
  const read = (format: string) =>
    JSON.parse(fs.readFileSync(path.join(DIR, 'idl', `all-types.${format}.json`), 'utf8'))
  const accountsOf = (ix: { accounts: object[] }): object[] =>
    ix.accounts.flatMap((account) =>
      'accounts' in account ? accountsOf(account as { accounts: object[] }) : [account]
    )

  it('codama: rootNode with a program node', () => {
    const idl = read('codama')
    expect(idl.kind).toBe('rootNode')
    expect(idl.standard).toBe('codama')
    expect(idl.program.kind).toBe('programNode')
    expect(idl.program.publicKey).toMatch(ADDRESS)
    expect(idl.program.instructions.length).toBeGreaterThan(0)
  })

  it('anchor v01: spec 0.1.0, address, explicit discriminators', () => {
    const idl = read('anchor-v01')
    expect(idl.metadata.spec).toBe('0.1.0')
    expect(idl.address).toMatch(ADDRESS)
    for (const ix of idl.instructions) expect(Array.isArray(ix.discriminator)).toBe(true)
  })

  it('anchor legacy: metadata.address, isMut/isSigner, camelCase multi-word names', () => {
    const idl = read('anchor-legacy')
    expect(idl.metadata.address).toMatch(ADDRESS)
    expect(idl.metadata.spec).toBeUndefined()
    for (const ix of idl.instructions) {
      for (const account of accountsOf(ix)) expect(account).toMatchObject({ isMut: expect.any(Boolean) })
    }
    expect(idl.instructions.some((ix: { name: string }) => /[a-z][A-Z]/.test(ix.name))).toBe(true)
  })

  it('shank: origin shank, u8 discriminants', () => {
    const idl = read('shank')
    expect(idl.metadata.origin).toBe('shank')
    expect(idl.metadata.address).toMatch(ADDRESS)
    for (const ix of idl.instructions) expect(ix.discriminant).toEqual({ type: 'u8', value: expect.any(Number) })
  })
})
