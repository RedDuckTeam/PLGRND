import { buildPlgrndHref } from '@/embed/plgrnd-links'
import { useEmbedHost } from '@/embed/embed-host-context'

interface EmbedErrorProps {
  title?: string
  detail?: string
  /** Shows a Retry button (the self-hosted widget). */
  onRetry?: () => void
}

export const EmbedError = ({ title = 'This flow could not be loaded', detail, onRetry }: EmbedErrorProps) => {
  const { linkRef } = useEmbedHost()
  const link = (
    <a
      href={buildPlgrndHref('', linkRef)}
      target="_blank"
      rel="noopener"
      className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
    >
      plgrnd.io
    </a>
  )
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background text-foreground">
      <p className="font-mono text-sm">{title}</p>
      {detail && (
        <p className="max-w-md px-4 text-center font-mono text-xs break-words text-muted-foreground">{detail}</p>
      )}
      {onRetry ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="cursor-pointer rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-muted"
          >
            Retry
          </button>
          {link}
        </div>
      ) : (
        link
      )}
    </div>
  )
}
