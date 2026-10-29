import type { Network } from '@/types/network'
import { useQuery } from '@tanstack/react-query'
import { isExist, isValidPublicKey } from '@/utils/validation/validation.utils'
import { getSolanaConnection, isPublicMainnetBlocked, type RpcUrls } from '@/constants/solana/connection'
import { useRpcConfig } from '@/providers/rpc-urls-context'
import { getATA } from '@/utils/solana/solana.utils'

export const getTokenBalance = async (pubkey: string, network: Network, token: string, urls: RpcUrls) => {
  try {
    const connection = getSolanaConnection(network, urls)
    const ata = await getATA(pubkey, token)

    const balance = await connection.getTokenAccountBalance(ata)

    return { rawBalance: balance.value.amount.toString(), uiBalance: balance.value.uiAmountString }
  } catch (error) {
    // Left to the query, so the self-hosted widget can say why mainnet reads fail.
    if (isPublicMainnetBlocked(error)) throw error
    console.error('Error getting token balance:', error)
    return { rawBalance: '0', uiBalance: '0' }
  }
}

export const useTokenBalance = (pubkey: string, network: Network | null, token: string, key: number) => {
  const { urls } = useRpcConfig()
  return useQuery({
    queryKey: ['tokenBalance', pubkey, network, token, key],
    queryFn: async () => {
      if (!network) return { rawBalance: '0', uiBalance: '0' }
      return getTokenBalance(pubkey, network, token, urls)
    },
    enabled: isValidPublicKey(pubkey) && isExist(network) && isValidPublicKey(token),
  })
}
