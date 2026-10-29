import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, AlertTriangle, Check, Circle, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Network } from '@/types/network'
import {
  describeInput,
  importErrorMessage,
  IMPORT_STAGES,
  loadTxImport,
  type DetectedInput,
} from '@/hooks/import/tx-import'
import type { TxImportStatus } from '@/hooks/import/use-tx-import'
import { labelClass, noteClass, segmentClass } from '../embed-builder/styles'

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  status: TxImportStatus
  onImport: (input: string, network?: Network) => void
  onStop: () => void
  /** Nodes on the canvas: replacing a non-empty canvas asks first. */
  nodeCount: number
  initialInput?: string
  initialNetwork?: Network
}

const NETWORKS: { value?: Network; label: string }[] = [
  { label: 'Auto' },
  { value: 'MAINNET', label: 'Mainnet' },
  { value: 'DEVNET', label: 'Devnet' },
]

const buttonClass =
  'flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50'

type Detect = (input: string) => DetectedInput

const StageIcon = ({ done, current, failed }: { done: boolean; current: boolean; failed: boolean }) => {
  if (done) return <Check className="h-3.5 w-3.5 text-green-600" />
  if (failed) return <AlertCircle className="h-3.5 w-3.5 text-red-500" />
  if (current) return <Loader2 className="h-3.5 w-3.5 animate-spin" />
  return <Circle className="h-3.5 w-3.5" />
}

export const ImportDialog = ({
  open,
  onOpenChange,
  status,
  onImport,
  onStop,
  nodeCount,
  initialInput = '',
  initialNetwork,
}: ImportDialogProps) => {
  const [input, setInput] = useState(initialInput)
  const [network, setNetwork] = useState<Network | undefined>(initialNetwork)
  const [confirming, setConfirming] = useState(false)
  const [detect, setDetect] = useState<Detect | null>(null)

  // The importer's own input check, once its chunk is loaded.
  useEffect(() => {
    let live = true
    loadTxImport()
      .then(({ detectInput }) => {
        if (live) setDetect(() => detectInput)
      })
      .catch(() => {
        // Importing reports a failed load.
      })
    return () => {
      live = false
    }
  }, [])

  const text = input.trim()
  const detection = useMemo(() => {
    if (!detect || !text) return null
    try {
      return { label: describeInput(detect(text)) }
    } catch (error) {
      return { error: importErrorMessage(error) }
    }
  }, [detect, text])

  const canImport = Boolean(text) && !status.running && !detection?.error
  const stageIndex = IMPORT_STAGES.findIndex(({ stage }) => stage === status.stage)

  const submit = () => {
    if (!canImport) return
    if (nodeCount > 0 && !confirming) {
      setConfirming(true)
      return
    }
    setConfirming(false)
    onImport(text, network)
  }

  const secondary = () => {
    if (status.running) onStop()
    else if (confirming) setConfirming(false)
    else onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">Import transaction</DialogTitle>
          <DialogDescription className="text-xs">
            Turns a transaction into a flow that rebuilds the same instructions.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Signature or serialized transaction</span>
          <textarea
            value={input}
            autoFocus
            spellCheck={false}
            disabled={status.running}
            onChange={(event) => {
              setInput(event.target.value)
              setConfirming(false)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                submit()
              }
            }}
            placeholder="Paste a transaction signature or a serialized transaction"
            className="h-24 w-full resize-none break-all rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
          />
          <p className={cn(noteClass, detection?.error && 'text-red-500')}>
            {detection
              ? (detection.label ?? detection.error)
              : 'A signature, or a signed or unsigned transaction in base64 or base58'}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Network</span>
          <div className="flex gap-1.5">
            {NETWORKS.map(({ value, label }) => (
              <button
                key={label}
                type="button"
                disabled={status.running}
                onClick={() => setNetwork(value)}
                className={segmentClass(network === value)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className={noteClass}>
            {network
              ? `Looks only on ${network.toLowerCase()}.`
              : 'A signature is looked up on mainnet, then devnet; a serialized transaction is simulated on mainnet.'}
          </p>
        </div>
        {status.stage && (status.running || status.error) && (
          <ol className="flex flex-col gap-1 font-mono text-xs">
            {IMPORT_STAGES.map(({ stage, label }, i) => (
              <li
                key={stage}
                className={cn('flex items-center gap-2', i > stageIndex ? 'text-muted-foreground' : 'text-foreground')}
              >
                <StageIcon
                  done={i < stageIndex}
                  current={i === stageIndex}
                  failed={i === stageIndex && Boolean(status.error)}
                />
                {label}
              </li>
            ))}
          </ol>
        )}
        {status.running && !status.stage && (
          <p className={cn(noteClass, 'flex items-center gap-1.5')}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the importer…
          </p>
        )}
        {status.error && !status.running && (
          <p className="flex items-start gap-1.5 break-words font-mono text-xs text-red-500">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {status.error}
          </p>
        )}
        {confirming && (
          <p className="flex items-start gap-1.5 rounded-md border border-yellow-600/40 bg-yellow-600/10 p-2 font-mono text-xs text-yellow-600">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            The imported flow replaces the {nodeCount === 1 ? 'node' : `${nodeCount} nodes`} on the canvas. Use Share
            first to keep a link to them.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={secondary} className={buttonClass}>
            {status.running ? 'Stop' : confirming ? 'Back' : 'Cancel'}
          </button>
          <button type="button" disabled={!canImport} onClick={submit} className={cn(buttonClass, 'border-primary')}>
            {status.running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {status.running ? 'Importing…' : confirming ? 'Replace and import' : 'Import'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
