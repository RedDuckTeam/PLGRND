import { useState, type FC, type PropsWithChildren } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactFlowProvider } from '@xyflow/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { queryClient } from '@/lib/query-client'
import { parseEmbedConfig } from '@/embed/embed-config'
import { parseLocationParams } from '@/embed/embed-location'
import { resolveTheme } from '@/embed/embed-theme'
import { createEmbedStore, EmbedStoreProvider, prefersDark } from '@/stores/embed-store'
import { createFlowStore, FlowStoreProvider } from '@/stores/flow-store'
import { InertWalletProviders } from '@/providers/inert-wallet-providers'
import { RpcConfigContext } from '@/providers/rpc-urls-context'
import { APP_RPC_CONFIG } from '@/constants/solana/app-rpc'

const createStores = () => {
  const { config, ignored } = parseEmbedConfig(parseLocationParams())
  return {
    embed: createEmbedStore({ config, ignored, resolvedTheme: resolveTheme(config.theme, prefersDark()) }),
    flow: createFlowStore(),
  }
}

/** Providers of the hosted `/embed` route: config from the URL, an in-memory flow, no wallet. */
export const EmbedProviders: FC<PropsWithChildren> = ({ children }) => {
  const [stores] = useState(createStores)
  return (
    <QueryClientProvider client={queryClient}>
      <RpcConfigContext.Provider value={APP_RPC_CONFIG}>
        <EmbedStoreProvider store={stores.embed}>
          <FlowStoreProvider store={stores.flow}>
            <ReactFlowProvider>
              <InertWalletProviders>
                <TooltipProvider>{children}</TooltipProvider>
              </InertWalletProviders>
            </ReactFlowProvider>
          </FlowStoreProvider>
        </EmbedStoreProvider>
      </RpcConfigContext.Provider>
    </QueryClientProvider>
  )
}
