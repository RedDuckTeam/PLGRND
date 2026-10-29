import type { Network } from '@/types/network'
import { clusterApiUrl, Connection } from '@solana/web3.js'

export type RpcUrls = Record<Network, string>

/** Public cluster endpoints: the self-hosted widget's defaults (no API key anywhere). */
export const PUBLIC_RPC_URLS: RpcUrls = {
  MAINNET: clusterApiUrl('mainnet-beta'),
  DEVNET: clusterApiUrl('devnet'),
}

/** The public mainnet endpoint answers 403 to requests from web pages other than Solana's own (it checks `Origin`). */
export const PUBLIC_MAINNET_BLOCKED =
  'The public mainnet RPC (api.mainnet-beta.solana.com) refuses requests from web pages: use your own mainnet RPC'

const withoutSlash = (url: string) => url.replace(/\/+$/, '')

export const isPublicMainnet = (url: string) => withoutSlash(url) === withoutSlash(PUBLIC_RPC_URLS.MAINNET)

/** Whether an error, possibly wrapped by web3.js into another message, comes from that refusal. */
export const isPublicMainnetBlocked = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).includes(PUBLIC_MAINNET_BLOCKED)

/** `fetch` for RPC calls: a 403 of the public mainnet endpoint fails with PUBLIC_MAINNET_BLOCKED. */
export const rpcFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init)
  if (response.status === 403 && isPublicMainnet(String(input))) throw new Error(PUBLIC_MAINNET_BLOCKED)
  return response
}

export const getSolanaConnection = (network: Network, urls: RpcUrls) => {
  return new Connection(urls[network], { fetch: rpcFetch })
}
