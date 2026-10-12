import { Buffer } from 'buffer'
import { useQuery } from '@tanstack/react-query'
import { PublicKey } from '@solana/web3.js'
import type { Network } from '@/types/network'
import { getSolanaConnection, type RpcUrls } from '@/constants/solana/connection'
import { useRpcConfig } from '@/providers/rpc-urls-context'
import { isExist, isValidPublicKey } from '@/utils/validation/validation.utils'

export interface AccountInfoResult {
  owner: string
  lamports: number
  data: Buffer
  executable: boolean
}

export const fetchAccountInfo = async (
  address: string,
  network: Network,
  urls: RpcUrls
): Promise<AccountInfoResult | null> => {
  const connection = getSolanaConnection(network, urls)
  const info = await connection.getAccountInfo(new PublicKey(address))
  if (!info) return null
  return {
    owner: info.owner.toBase58(),
    lamports: info.lamports,
    data: Buffer.from(info.data),
    executable: info.executable,
  }
}

export const useAccountInfo = (address: string, network: Network | null, refreshKey: number) => {
  const { urls } = useRpcConfig()
  return useQuery({
    queryKey: ['accountInfo', address, network, refreshKey],
    queryFn: async () => {
      if (!network) return null
      return fetchAccountInfo(address, network, urls)
    },
    enabled: isValidPublicKey(address) && isExist(network),
  })
}
