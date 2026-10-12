import type { Network } from '@/types/network'
import { useQuery } from '@tanstack/react-query'
import { isExist, isValidSignature } from '@/utils/validation/validation.utils'
import { getSolanaConnection, type RpcUrls } from '@/constants/solana/connection'
import { useRpcConfig } from '@/providers/rpc-urls-context'

export const getTransactionBySignature = async (signature: string, network: Network, urls: RpcUrls) => {
  try {
    const connection = getSolanaConnection(network, urls)

    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    })

    if (!tx) return { transactionJson: '', slot: '', blockTime: '' }

    const transactionJson = JSON.stringify(tx, null, 2)
    const slot = String(tx.slot ?? '')
    const blockTime = String(tx.blockTime ?? '')

    return { transactionJson, slot, blockTime }
  } catch (error) {
    console.error('Error getting transaction by signature:', error)
    return { transactionJson: '', slot: '', blockTime: '' }
  }
}

export const useTransactionBySignature = (signature: string, network: Network | null, key: number) => {
  const { urls } = useRpcConfig()
  return useQuery({
    queryKey: ['transactionBySignature', signature, network, key],
    queryFn: async () => {
      if (!network) return { transactionJson: '', slot: '', blockTime: '' }

      return await getTransactionBySignature(signature, network, urls)
    },
    enabled: isValidSignature(signature) && isExist(network),
  })
}
