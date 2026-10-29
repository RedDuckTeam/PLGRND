// `PLGRND_CAPTURE=native-idls yarn workspace web capture`: vendors the native programs' Codama IDLs into
// src/constants/programs/native/. They are read from the Solana Foundation's Program Metadata accounts on mainnet —
// the same copies the self-hosted widget can fetch over RPC — so both resolve to one IDL with one content hash.
// `docs` fields are stripped to keep the bundle small (the content hash ignores them). Licence: Apache-2.0
// (github.com/solana-program/*), see the NOTICE in THIRD_PARTY_LICENSES.
import fs from 'node:fs'
import path from 'node:path'
import { Connection, PublicKey } from '@solana/web3.js'
import { it } from 'vitest'
import { FOUNDATION_IDL_AUTHORITY, pmpAuthorityAddress } from '@/utils/idl/sources/addresses'
import { parseMetadataAccount, readMetadataContent } from '@/utils/idl/sources/program-metadata'
import { stripDocs } from '@/utils/idl/sources/content-hash'

const NATIVE = {
  system: '11111111111111111111111111111111',
  token: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'token-2022': 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  'associated-token': 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  'compute-budget': 'ComputeBudget111111111111111111111111111111',
  memo: 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
}

it.skipIf(process.env.PLGRND_CAPTURE !== 'native-idls')(
  'vendors the native IDLs',
  async () => {
    const connection = new Connection(process.env.RPC_URL ?? 'https://api.mainnet-beta.solana.com')
    const out = path.join(__dirname, '../src/constants/programs/native')
    fs.mkdirSync(out, { recursive: true })
    const addresses = Object.values(NATIVE).map((p) => pmpAuthorityAddress(new PublicKey(p), FOUNDATION_IDL_AUTHORITY))
    const infos = await connection.getMultipleAccountsInfo(addresses)
    const fetchAccount = async () => null
    for (const [i, [name, programId]] of Object.entries(NATIVE).entries()) {
      const info = infos[i]
      if (!info) throw new Error(`${name}: no Foundation IDL for ${programId}`)
      const root = JSON.parse(
        await readMetadataContent(parseMetadataAccount(new Uint8Array(info.data)), { fetchAccount })
      )
      fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(stripDocs(root)) + '\n')
    }
  },
  60_000
)
