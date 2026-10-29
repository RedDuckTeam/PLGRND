import { Panel } from '@xyflow/react'
import { Import, Share2, RotateCcw, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useFlowStore } from '@/stores/flow-store'
import { clearFlowHash } from '@/utils/flow/share'
import { ExampleFlowsModal } from './example-flows-modal'
import { ShareDialog } from './share-dialog'

interface FlowToolbarProps {
  /** Opens the transaction import dialog, which the page owns. */
  onImport: () => void
}

export const FlowToolbar = ({ onImport }: FlowToolbarProps) => {
  const resetFlow = useFlowStore((s) => s.resetFlow)
  const [examplesOpen, setExamplesOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const handleReset = () => {
    resetFlow()
    clearFlowHash()
    toast.success('Canvas reset')
  }

  const buttonClass =
    'flex items-center gap-1.5 rounded-md border border-border bg-sidebar px-3 py-1.5 text-xs font-mono text-foreground hover:bg-muted transition-colors cursor-pointer'

  return (
    <>
      <Panel position="bottom-left">
        <div className="flex gap-2 ml-[30px]">
          <button type="button" onClick={() => setExamplesOpen(true)} className={buttonClass}>
            <Sparkles className="h-3.5 w-3.5" />
            Examples
          </button>
          <button type="button" onClick={onImport} className={buttonClass}>
            <Import className="h-3.5 w-3.5" />
            Import tx
          </button>
          <button type="button" onClick={() => setShareOpen(true)} className={buttonClass}>
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
          <button type="button" onClick={handleReset} className={buttonClass}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </Panel>
      <ExampleFlowsModal open={examplesOpen} onOpenChange={setExamplesOpen} />
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} />
    </>
  )
}
