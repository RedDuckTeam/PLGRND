import { useState, type PropsWithChildren } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

function WidgetFallback({ resetErrorBoundary }: { resetErrorBoundary: () => void }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background text-foreground">
      <p className="font-mono text-sm">This flow could not be displayed</p>
      <button
        type="button"
        onClick={resetErrorBoundary}
        className="cursor-pointer rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-muted"
      >
        Retry
      </button>
    </div>
  )
}

/** 2S.6: a render error shows Retry, which remounts the widget's subtree; the host page is never reloaded. */
export function WidgetBoundary({ children }: PropsWithChildren) {
  const [attempt, setAttempt] = useState(0)
  return (
    <ErrorBoundary key={attempt} FallbackComponent={WidgetFallback} onReset={() => setAttempt((n) => n + 1)}>
      {children}
    </ErrorBoundary>
  )
}
