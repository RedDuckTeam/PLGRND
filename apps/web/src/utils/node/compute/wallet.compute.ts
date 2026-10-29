import type { WalletNodeData } from '@/types/nodes/wallet/wallet-node'
import type { ComputeContext, NodeData, NodeInputs } from './types'

export const computeWallet = (_data: NodeData, _inputs: NodeInputs, ctx: ComputeContext): WalletNodeData => {
  const publicKey = ctx.walletPublicKey ?? ''
  return { publicKey, wallet: publicKey ? { kind: 'wallet', publicKey } : null }
}
