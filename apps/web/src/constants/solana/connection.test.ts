import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicKey } from '@solana/web3.js'
import { rpcCall } from '@/utils/tx-import/rpc'
import {
  getSolanaConnection,
  isPublicMainnet,
  isPublicMainnetBlocked,
  PUBLIC_MAINNET_BLOCKED,
  PUBLIC_RPC_URLS,
  rpcFetch,
} from './connection'

// What api.mainnet-beta.solana.com answers to a request whose Origin is not one of Solana's sites.
const forbidden = async () =>
  new Response('{"jsonrpc":"2.0","error":{"code": 403,"message":"Access forbidden"}}', {
    status: 403,
    statusText: 'Forbidden',
  })

const OWN_RPC = 'https://rpc.example.com'

describe('public mainnet refusal', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(forbidden))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fails a 403 of the public mainnet endpoint with a message that says what to do', async () => {
    await expect(rpcFetch(PUBLIC_RPC_URLS.MAINNET, { method: 'POST' })).rejects.toThrow(PUBLIC_MAINNET_BLOCKED)
    await expect(rpcFetch('https://api.mainnet-beta.solana.com', {})).rejects.toThrow(PUBLIC_MAINNET_BLOCKED)
  })

  it('passes a 403 of any other endpoint through', async () => {
    expect((await rpcFetch(OWN_RPC, { method: 'POST' })).status).toBe(403)
    expect((await rpcFetch(PUBLIC_RPC_URLS.DEVNET, { method: 'POST' })).status).toBe(403)
  })

  it('reaches web3.js calls, which wrap it into their own message', async () => {
    const getBalance = (urls: typeof PUBLIC_RPC_URLS) =>
      getSolanaConnection('MAINNET', urls)
        .getBalance(PublicKey.default)
        .catch((error: unknown) => error)
    expect(isPublicMainnetBlocked(await getBalance(PUBLIC_RPC_URLS))).toBe(true)
    expect(isPublicMainnetBlocked(await getBalance({ ...PUBLIC_RPC_URLS, MAINNET: OWN_RPC }))).toBe(false)
  })

  it('reaches the importer RPC', async () => {
    await expect(rpcCall(PUBLIC_RPC_URLS.MAINNET, 'getTransaction', [])).rejects.toThrow(PUBLIC_MAINNET_BLOCKED)
    await expect(rpcCall(OWN_RPC, 'getTransaction', [])).rejects.toThrow('getTransaction: HTTP 403')
  })

  it('recognizes the public mainnet endpoint only', () => {
    expect(isPublicMainnet('https://api.mainnet-beta.solana.com')).toBe(true)
    expect(isPublicMainnet('https://api.mainnet-beta.solana.com/')).toBe(true)
    expect(isPublicMainnet(PUBLIC_RPC_URLS.DEVNET)).toBe(false)
    expect(isPublicMainnet(OWN_RPC)).toBe(false)
  })
})
