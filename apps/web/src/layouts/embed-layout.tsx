import { memo } from 'react'
import { Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Toaster } from '@/components/ui/sonner'
import { Header } from '@/components/header/header'
import { EmbedProviders } from '@/providers/embed-providers'
import { useEmbedStore } from '@/stores/embed-store'
import { useEmbedTheme } from '@/hooks/embed/use-embed-theme'

const EmbedLayout = memo(() => {
  const resolvedTheme = useEmbedTheme()
  const mode = useEmbedStore((s) => s.config.mode)

  return (
    <EmbedProviders>
      <div
        className={cn('plgrnd-embed flex h-screen w-screen flex-col bg-background text-foreground', {
          'plgrnd-embed--readonly': mode === 'readonly',
          'plgrnd-embed--interactive': mode === 'interactive',
          'plgrnd-embed--editor': mode === 'editor',
        })}
        data-mode={mode}
      >
        {mode === 'editor' && <Header showNodeMenu />}
        <div className="min-h-0 min-w-0 flex-1">
          <Outlet />
        </div>
        {/* top-center keeps toasts clear of the bottom toolbar/badge panels */}
        <Toaster position="top-center" theme={resolvedTheme} />
      </div>
    </EmbedProviders>
  )
})
EmbedLayout.displayName = 'EmbedLayout'

export default EmbedLayout
