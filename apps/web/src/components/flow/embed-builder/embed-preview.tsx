import { useEffect, useState } from 'react'
import { IFRAME_ALLOW, IFRAME_SANDBOX, type EmbedSnippetSize } from '@/embed/embed-url'

interface EmbedPreviewProps {
  url: string
  size: EmbedSnippetSize
}

export const EmbedPreview = ({ url, size }: EmbedPreviewProps) => {
  const [debouncedUrl, setDebouncedUrl] = useState(url)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedUrl(url), 300)
    return () => window.clearTimeout(timer)
  }, [url])

  const style = size.kind === 'aspect' ? { aspectRatio: size.ratio } : { height: `${size.height}px` }

  return (
    <div className="relative w-full self-start overflow-hidden rounded-md border border-border" style={style}>
      <iframe
        src={debouncedUrl}
        title="PLGRND embed preview"
        sandbox={IFRAME_SANDBOX}
        allow={IFRAME_ALLOW}
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  )
}
