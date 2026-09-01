import { Panel } from '@xyflow/react'
import { ExternalLink, RotateCcw } from 'lucide-react'
import { useEmbedStore } from '@/stores/embed-store'
import { useOpenInEditor } from '@/hooks/embed/use-open-in-editor'

const buttonClass =
  'flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-mono text-foreground hover:bg-muted transition-colors cursor-pointer'

export const EmbedToolbar = () => {
  const requestFit = useEmbedStore((s) => s.requestFit)
  const openInEditor = useOpenInEditor()

  const handleReset = () => {
    requestFit()
  }

  return (
    <Panel position="bottom-left">
      <div className="flex gap-2 ml-[30px]">
        <button type="button" onClick={openInEditor} className={buttonClass}>
          <ExternalLink className="h-3.5 w-3.5" />
          Open in PLGRND
        </button>
        <button type="button" onClick={handleReset} className={buttonClass}>
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>
    </Panel>
  )
}
