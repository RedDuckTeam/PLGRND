import type { Network } from '@/types/network'
import { clusterApiUrl, Connection } from '@solana/web3.js'

export type RpcUrls = Record<Network, string>

/** Public cluster endpoints: the self-hosted widget's defaults (no API key anywhere). */
export const PUBLIC_RPC_URLS: RpcUrls = {
  MAINNET: clusterApiUrl('mainnet-beta'),
  DEVNET: clusterApiUrl('devnet'),
}

export const getSolanaConnection = (network: Network, urls: RpcUrls) => {
  return new Connection(urls[network])
}
