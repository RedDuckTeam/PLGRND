// M13: the runtime uses only the wallet-modal context of @solana/wallet-adapter-react-ui (InertWalletProviders
// supplies a value, wallet-node reads it). This stub keeps the UI package out of the self-hosted artifacts (AC-D3).
import { createContext, useContext } from 'react'

export interface WalletModalContextState {
  visible: boolean
  setVisible: (open: boolean) => void
}

export const WalletModalContext = createContext<WalletModalContextState>({
  visible: false,
  setVisible: () => undefined,
})

export function useWalletModal(): WalletModalContextState {
  return useContext(WalletModalContext)
}
