import { Buffer } from 'buffer'
import bs58 from 'bs58'
import { PublicKey } from '@solana/web3.js'
import { decompress, type Compression } from './decompress'

// Program Metadata account (program ProgM6JCC…): a 96-byte header followed by the data.
//   0 discriminator u8 (2) | 1 program (32) | 33 authority (32, zeroes = none) | 65 mutable | 66 canonical
//   67 seed (16) | 83 encoding | 84 compression | 85 format | 86 data source | 87 data length u32 | 91 padding (5) | 96 data
// Content = decode(decompress(data)) — the same order as @solana-program/program-metadata's unpackDirectData.
const ACCOUNT_DISCRIMINATOR = 2
const DATA_OFFSET = 96

const ENCODINGS = ['none', 'utf8', 'base58', 'base64'] as const
const COMPRESSIONS: Compression[] = ['none', 'gzip', 'zlib']
const DATA_SOURCES = ['direct', 'url', 'external'] as const

export interface MetadataAccount {
  program: string
  authority: string | null
  canonical: boolean
  seed: string
  encoding: (typeof ENCODINGS)[number]
  compression: Compression
  /** Declared format byte. Real accounts set 0 ("none") for JSON, so callers sniff the content instead. */
  format: number
  dataSource: (typeof DATA_SOURCES)[number]
  data: Uint8Array
}

export interface MetadataFetchers {
  /** Raw account data, or null when the account does not exist. */
  fetchAccount: (address: string) => Promise<Uint8Array | null>
  /** Absent when URL data sources are not allowed (the self-hosted widget makes no third-party requests). */
  fetchUrl?: (url: string) => Promise<string>
}

export function parseMetadataAccount(account: Uint8Array): MetadataAccount {
  if (account.length < DATA_OFFSET || account[0] !== ACCOUNT_DISCRIMINATOR) {
    throw new Error('Not a Program Metadata account')
  }
  const buf = Buffer.from(account)
  const enumAt = <T>(values: readonly T[], offset: number, what: string): T => {
    const value = values[buf[offset]]
    if (value === undefined) throw new Error(`Unknown Program Metadata ${what} ${buf[offset]}`)
    return value
  }
  const authority = account.subarray(33, 65)
  const length = buf.readUInt32LE(87)
  if (DATA_OFFSET + length > account.length) throw new Error('Program Metadata length exceeds its data')
  return {
    program: new PublicKey(account.subarray(1, 33)).toBase58(),
    authority: authority.every((b) => b === 0) ? null : new PublicKey(authority).toBase58(),
    canonical: buf[66] === 1,
    seed: buf.subarray(67, 83).toString('utf8').replace(/\0+$/, ''),
    encoding: enumAt(ENCODINGS, 83, 'encoding'),
    compression: enumAt(COMPRESSIONS, 84, 'compression'),
    format: buf[85],
    dataSource: enumAt(DATA_SOURCES, 86, 'data source'),
    data: account.subarray(DATA_OFFSET, DATA_OFFSET + length),
  }
}

const decodeContent = (bytes: Uint8Array, encoding: MetadataAccount['encoding']): string => {
  switch (encoding) {
    case 'none':
      return Buffer.from(bytes).toString('hex')
    case 'utf8':
      return new TextDecoder().decode(bytes)
    case 'base58':
      return bs58.encode(bytes)
    case 'base64':
      return Buffer.from(bytes).toString('base64')
  }
}

const unpack = async (data: Uint8Array, account: MetadataAccount) =>
  decodeContent(await decompress(data, account.compression), account.encoding)

/** The account's content as a string (an IDL in practice), following URL and external-account data sources. */
export async function readMetadataContent(account: MetadataAccount, fetchers: MetadataFetchers): Promise<string> {
  switch (account.dataSource) {
    case 'direct':
      return unpack(account.data, account)
    case 'url': {
      const url = await unpack(account.data, account)
      if (!fetchers.fetchUrl) throw new Error('URL data sources are disabled here')
      if (!url.startsWith('https://')) throw new Error('Program Metadata URL must use https')
      return fetchers.fetchUrl(url)
    }
    case 'external': {
      // { address (32), offset u32, length u32 (0 = to the end) }
      const buf = Buffer.from(account.data)
      if (buf.length < 40) throw new Error('Program Metadata external reference is too short')
      const address = new PublicKey(buf.subarray(0, 32)).toBase58()
      const offset = buf.readUInt32LE(32)
      const length = buf.readUInt32LE(36)
      const external = await fetchers.fetchAccount(address)
      if (!external) throw new Error(`External data account ${address} not found`)
      const slice = external.subarray(offset, length === 0 ? undefined : offset + length)
      return slice.length === 0 ? '' : unpack(slice, account)
    }
  }
}
