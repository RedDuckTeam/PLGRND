import type { Network } from '@/types/network'
import { clusterApiUrl, Connection } from '@solana/web3.js'
import { env } from '@/env'

const heliusUrl = (cluster: 'mainnet' | 'devnet') =>
  env.VITE_HELIUS_API_KEY ? `https://${cluster}.helius-rpc.com/?api-key=${env.VITE_HELIUS_API_KEY}` : undefined

export const SOLANA_RPC_URL: Record<Network, string> = {
  MAINNET: env.VITE_PUBLIC_SOLANA_RPC ?? heliusUrl('mainnet') ?? clusterApiUrl('mainnet-beta'),
  DEVNET: heliusUrl('devnet') ?? clusterApiUrl('devnet'),
}

export const getSolanaConnection = (network: Network) => {
  return new Connection(SOLANA_RPC_URL[network])
}
