import { QueryClientProvider } from '@tanstack/react-query'
import type { FC, PropsWithChildren } from 'react'

import { SolanaProvider } from './solana-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ReactFlowProvider } from '@xyflow/react'
import { queryClient } from '@/lib/query-client'

const Providers: FC<PropsWithChildren> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <ReactFlowProvider>
        <SolanaProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </SolanaProvider>
      </ReactFlowProvider>
    </QueryClientProvider>
  )
}

export default Providers
