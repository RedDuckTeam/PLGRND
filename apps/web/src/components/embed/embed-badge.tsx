import { Panel } from '@xyflow/react'

export const EmbedBadge = () => (
  <Panel position="bottom-right">
    <a
      href="https://plgrnd.io"
      target="_blank"
      rel="noopener"
      className="flex items-center rounded-md border border-border bg-card px-2 py-1 text-[10px] font-mono text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      Powered by PLGRND
    </a>
  </Panel>
)
