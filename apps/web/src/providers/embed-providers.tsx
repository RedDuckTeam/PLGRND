import type { FC, PropsWithChildren } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactFlowProvider } from '@xyflow/react'
import { WalletContext, type WalletContextState } from '@solana/wallet-adapter-react'
import { WalletModalContext, type WalletModalContextState } from '@solana/wallet-adapter-react-ui'
import { TooltipProvider } from '@/components/ui/tooltip'
import { queryClient } from '@/lib/query-client'

const unavailable = async (): Promise<never> => {
  throw new Error('[plgrnd] Wallet is not available in embedded widgets')
}

const EMBED_WALLET_CONTEXT: WalletContextState = {
  autoConnect: false,
  wallets: [],
  wallet: null,
  publicKey: null,
  connecting: false,
  connected: false,
  disconnecting: false,
  select: () => {},
  connect: unavailable,
  disconnect: async () => {},
  sendTransaction: unavailable,
  signTransaction: undefined,
  signAllTransactions: undefined,
  signMessage: undefined,
  signIn: undefined,
}

const EMBED_WALLET_MODAL_CONTEXT: WalletModalContextState = {
  visible: false,
  setVisible: () => {},
}

export const EmbedProviders: FC<PropsWithChildren> = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <ReactFlowProvider>
      <WalletContext.Provider value={EMBED_WALLET_CONTEXT}>
        <WalletModalContext.Provider value={EMBED_WALLET_MODAL_CONTEXT}>
          <TooltipProvider>{children}</TooltipProvider>
        </WalletModalContext.Provider>
      </WalletContext.Provider>
    </ReactFlowProvider>
  </QueryClientProvider>
)
