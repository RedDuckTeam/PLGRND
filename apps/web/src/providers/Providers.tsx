import { QueryClientProvider } from '@tanstack/react-query'
import { useState, type FC, type PropsWithChildren } from 'react'

import { SolanaProvider } from './solana-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ReactFlowProvider } from '@xyflow/react'
import { queryClient } from '@/lib/query-client'
import { FlowStoreProvider } from '@/stores/flow-store'
import { createLocalFlowStore } from '@/stores/flow-store-local'
import { RpcConfigContext } from '@/providers/rpc-urls-context'
import { APP_RPC_CONFIG } from '@/constants/solana/app-rpc'

const Providers: FC<PropsWithChildren> = ({ children }) => {
  const [flowStore] = useState(createLocalFlowStore)
  return (
    <QueryClientProvider client={queryClient}>
      <RpcConfigContext.Provider value={APP_RPC_CONFIG}>
        <FlowStoreProvider store={flowStore}>
          <ReactFlowProvider>
            <SolanaProvider>
              <TooltipProvider>{children}</TooltipProvider>
            </SolanaProvider>
          </ReactFlowProvider>
        </FlowStoreProvider>
      </RpcConfigContext.Provider>
    </QueryClientProvider>
  )
}

export default Providers
