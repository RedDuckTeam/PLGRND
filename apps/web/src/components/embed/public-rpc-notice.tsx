import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, X } from 'lucide-react'
import { isPublicMainnet, isPublicMainnetBlocked } from '@/constants/solana/connection'
import { useRpcConfig } from '@/providers/rpc-urls-context'

/**
 * Says why mainnet reads fail in a self-hosted widget left on the public mainnet endpoint, which refuses requests from
 * web pages: nodes such as BALANCE would otherwise just show nothing new. Shown once a query of this widget fails so.
 */
export const PublicRpcNotice = () => {
  const queryClient = useQueryClient()
  const { urls } = useRpcConfig()
  const [blocked, setBlocked] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.type === 'updated' && event.action.type === 'error' && isPublicMainnetBlocked(event.action.error)) {
          setBlocked(true)
        }
      }),
    [queryClient]
  )

  if (!blocked || dismissed || !isPublicMainnet(urls.MAINNET)) return null
  return (
    <div
      role="status"
      className="absolute inset-x-3 top-3 z-10 mx-auto flex w-fit max-w-md items-start gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 font-mono text-[10px] leading-4 text-muted-foreground shadow-sm"
    >
      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-yellow-600" />
      <span>
        Mainnet data is unavailable: the public mainnet RPC refuses requests from web pages. Set rpc-mainnet on this
        widget to your own endpoint.
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss the RPC notice"
        className="mt-0.5 cursor-pointer rounded-xs transition-colors hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
