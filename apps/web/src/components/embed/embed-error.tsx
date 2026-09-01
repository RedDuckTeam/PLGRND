export const EmbedError = () => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background text-foreground">
    <p className="font-mono text-sm">This flow could not be loaded</p>
    <a
      href="https://plgrnd.io"
      target="_blank"
      rel="noopener"
      className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
    >
      plgrnd.io
    </a>
  </div>
)
