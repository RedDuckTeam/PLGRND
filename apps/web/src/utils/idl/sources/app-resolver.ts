import { PublicKey } from '@solana/web3.js'
import { getSolanaConnection } from '@/constants/solana/connection'
import type { Network } from '@/types/network'
import type { RpcConfig } from '@/providers/rpc-urls-context'
import type { ResolveIdl } from '@/utils/node/compute/types'
import type { IdlResolver, IdlResolverDeps } from './resolve'

// One resolver (and so one in-memory IDL cache) per network and endpoint, shared by every IDL node on the page.
const resolvers = new Map<string, Promise<IdlResolver>>()

const fetchText = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

// Session cache entries are per network: a program can have different IDLs on mainnet and devnet.
const sessionCache = (network: Network): IdlResolverDeps['sessionCache'] => {
  try {
    if (typeof sessionStorage === 'undefined') return undefined
    const store = sessionStorage
    return {
      getItem: (key) => store.getItem(`${key}:${network}`),
      setItem: (key, value) => store.setItem(`${key}:${network}`, value),
    }
  } catch {
    return undefined
  }
}

/**
 * The page's IDL lookup over the configured RPC. The self-hosted widget reads nothing but its RPC (no curated or
 * URL sources) and never touches the host page's storage; IDLs the user pasted before are offered in the editor only.
 */
export function createAppResolveIdl(rpc: RpcConfig, options: { rememberedIdls: boolean }): ResolveIdl {
  const selfHosted = Boolean(rpc.selfHosted)
  const rememberedIdls = !selfHosted && options.rememberedIdls

  return async (programId, { network, prefer }) => {
    const key = JSON.stringify([network, rpc.urls[network], selfHosted, rememberedIdls])
    let resolver = resolvers.get(key)
    if (!resolver) {
      resolver = import('./resolve').then(({ createIdlResolver }) => {
        const connection = getSolanaConnection(network, rpc.urls)
        return createIdlResolver({
          getAccounts: async (addresses) =>
            (await connection.getMultipleAccountsInfo(addresses.map((a) => new PublicKey(a)))).map((info) =>
              info ? new Uint8Array(info.data) : null
            ),
          ...(selfHosted ? {} : { fetchText, sessionCache: sessionCache(network) }),
          rememberedIdls,
        })
      })
      resolvers.set(key, resolver)
      resolver.catch(() => resolvers.delete(key))
    }
    return (await resolver)(programId, { prefer })
  }
}
