import type { FC, PropsWithChildren } from 'react'
import { WalletContext, type WalletContextState } from '@solana/wallet-adapter-react'
import { WalletModalContext, type WalletModalContextState } from '@solana/wallet-adapter-react-ui'

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

/** Embeds have no wallet: nodes see a disconnected wallet and a modal that never opens. */
export const InertWalletProviders: FC<PropsWithChildren> = ({ children }) => (
  <WalletContext.Provider value={EMBED_WALLET_CONTEXT}>
    <WalletModalContext.Provider value={EMBED_WALLET_MODAL_CONTEXT}>{children}</WalletModalContext.Provider>
  </WalletContext.Provider>
)
