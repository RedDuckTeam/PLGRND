import { toast } from 'sonner'
import { Copy, Link as LinkIcon } from 'lucide-react'

interface EmbedSnippetProps {
  snippet: string
  url: string
}

const copyText = async (text: string, message: string) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(message)
  } catch {
    toast.error('Failed to copy')
  }
}

export const EmbedSnippet = ({ snippet, url }: EmbedSnippetProps) => (
  <div className="flex flex-col gap-2">
    <textarea
      readOnly
      value={snippet}
      rows={9}
      spellCheck={false}
      onFocus={(event) => event.currentTarget.select()}
      className="w-full resize-none rounded-md border border-border bg-background p-2 font-mono text-[10px] leading-[14px] text-muted-foreground outline-none focus:border-primary"
    />
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => void copyText(snippet, 'Snippet copied')}
        className="flex cursor-pointer items-center gap-1.5 rounded-md border border-primary bg-primary px-3 py-1.5 font-mono text-xs text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Copy className="h-3.5 w-3.5" />
        Copy snippet
      </button>
      <button
        type="button"
        onClick={() => void copyText(url, 'Embed URL copied')}
        className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-muted"
      >
        <LinkIcon className="h-3.5 w-3.5" />
        Copy URL
      </button>
    </div>
  </div>
)
