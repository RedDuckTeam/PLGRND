import { Panel } from '@xyflow/react'
import { buildPlgrndHref } from '@/embed/plgrnd-links'
import { useEmbedHost } from '@/embed/embed-host-context'

export const EmbedBadge = () => {
  const { linkRef } = useEmbedHost()
  return (
    <Panel position="bottom-right">
      <a
        href={buildPlgrndHref('', linkRef)}
        target="_blank"
        rel="noopener"
        className="flex items-center rounded-md border border-border bg-card px-2 py-1 text-[10px] font-mono text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        Powered by PLGRND
      </a>
    </Panel>
  )
}
