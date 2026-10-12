import { env } from '@/env'
import type { RpcConfig } from '@/providers/rpc-urls-context'
import { PUBLIC_RPC_URLS } from './connection'

// App and hosted /embed only: endpoints from build-time env (Helius when a key is configured).
// The self-hosted build never imports this module, so no key can reach its artifacts.

const heliusUrl = (cluster: 'mainnet' | 'devnet') =>
  env.VITE_HELIUS_API_KEY ? `https://${cluster}.helius-rpc.com/?api-key=${env.VITE_HELIUS_API_KEY}` : undefined

/** The editor's and hosted `/embed`'s RPC: Send confirms over a signature subscription. */
export const APP_RPC_CONFIG: RpcConfig = {
  urls: {
    MAINNET: env.VITE_PUBLIC_SOLANA_RPC ?? heliusUrl('mainnet') ?? PUBLIC_RPC_URLS.MAINNET,
    DEVNET: heliusUrl('devnet') ?? PUBLIC_RPC_URLS.DEVNET,
  },
  confirmMode: 'subscription',
}
