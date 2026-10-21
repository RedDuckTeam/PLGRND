const PLGRND_EMBED_URL = 'https://plgrnd.io/embed'

export function isAllowedEmbedSrc(src: string): boolean {
  return src.startsWith(`${PLGRND_EMBED_URL}?`) || src.startsWith(`${PLGRND_EMBED_URL}#`)
}

export function PlgrndEmbed({ src, title }: { src: string; title: string }) {
  if (!isAllowedEmbedSrc(src)) return null

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden', borderRadius: 12 }}>
      <iframe
        src={src}
        title={title}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        allow="clipboard-write"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
      />
    </div>
  )
}
