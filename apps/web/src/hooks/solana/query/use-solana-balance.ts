import type { Network } from '@/types/network'
import { useQuery } from '@tanstack/react-query'
import { PublicKey } from '@solana/web3.js'
import { isExist, isValidPublicKey } from '@/utils/validation/validation.utils'
import { formatUnits } from '@/utils/format/format.utils'
import { getSolanaConnection, type RpcUrls } from '@/constants/solana/connection'
import { useRpcConfig } from '@/providers/rpc-urls-context'

export const getSolanaBalance = async (pubkey: string, network: Network, urls: RpcUrls) => {
  try {
    const connection = getSolanaConnection(network, urls)

    const balance = await connection.getBalance(new PublicKey(pubkey))

    const parsedBalance = formatUnits(balance, 9)

    return { rawBalance: balance.toString(), uiBalance: parsedBalance.toString() }
  } catch (error) {
    console.error('Error getting Solana balance:', error)
    return { rawBalance: '0', uiBalance: '0' }
  }
}

export const useSolanaBalance = (pubkey: string, network: Network | null, key: number) => {
  const { urls } = useRpcConfig()
  return useQuery({
    queryKey: ['solanaBalance', pubkey, network, key],
    queryFn: async () => {
      if (!network) return { rawBalance: '0', uiBalance: '0' }
      return getSolanaBalance(pubkey, network, urls)
    },
    enabled: isValidPublicKey(pubkey) && isExist(network),
  })
}
