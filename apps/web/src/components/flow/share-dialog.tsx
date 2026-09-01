import { useEffect, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { toast } from 'sonner'
import { Copy } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFlowStore, type FlowSnapshot } from '@/stores/flow-store'
import { buildShareUrl } from '@/utils/flow/share'
import { EmbedBuilder } from './embed-builder/embed-builder'

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ShareDialog = ({ open, onOpenChange }: ShareDialogProps) => {
  const { getViewport } = useReactFlow()
  const [snapshot, setSnapshot] = useState<FlowSnapshot | null>(null)

  useEffect(() => {
    if (!open) return
    const { nodes, edges } = useFlowStore.getState()
    setSnapshot({ nodes, edges, viewport: getViewport() })
  }, [open, getViewport])

  const shareUrl = snapshot ? buildShareUrl(snapshot) : ''

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Share link copied')
    } catch {
      toast.error('Failed to copy link')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">Share</DialogTitle>
        </DialogHeader>
        {snapshot && (
          <Tabs defaultValue="link">
            <TabsList>
              <TabsTrigger value="link">Link</TabsTrigger>
              <TabsTrigger value="embed">Embed</TabsTrigger>
            </TabsList>
            <TabsContent value="link">
              <div className="flex gap-2 pt-2">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(event) => event.currentTarget.select()}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs text-muted-foreground outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => void handleCopyUrl()}
                  className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-muted"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
              </div>
            </TabsContent>
            <TabsContent value="embed" className="pt-2">
              <EmbedBuilder snapshot={snapshot} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
