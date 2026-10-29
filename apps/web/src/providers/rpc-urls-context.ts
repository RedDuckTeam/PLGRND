import { createContext, useContext } from 'react'
import type { RpcUrls } from '@/constants/solana/connection'
import type { ConfirmMode } from '@/utils/solana/transaction.utils'

export interface RpcConfig {
  urls: RpcUrls
  /** How Send confirms: a WebSocket signature subscription (app), or HTTPS polling (self-hosted, `wss:`-free CSP). */
  confirmMode: ConfirmMode
  /** The self-hosted widget: it contacts only the RPC (no third-party URLs) and never uses the host page's storage. */
  selfHosted?: boolean
}

export const RpcConfigContext = createContext<RpcConfig | null>(null)

export const useRpcConfig = (): RpcConfig => {
  const config = useContext(RpcConfigContext)
  if (!config) throw new Error('[plgrnd] useRpcConfig must be used inside an RpcConfigContext provider')
  return config
}
