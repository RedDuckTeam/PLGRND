import { CustomNode } from '../../ui/custom-node'
import type { TransactionNodeType } from '@/types/nodes/transactions/transaction-node'
import type { ActionsFor, NodeTypeEnum } from '@/types/node'
import { useNodeActions } from '@/hooks/flow/use-node-actions'
import type { NodeProps } from '@xyflow/react'
import { AlertCircle, Check, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useTransactionNode } from '@/hooks/nodes/use-transaction-node'
import { useFlowMode } from '@/components/flow/flow-mode-context'
import { useOpenInEditor } from '@/hooks/embed/use-open-in-editor'
import { truncatePubkey } from '@/utils/solana/transaction.utils'

export const TransactionNode = (props: NodeProps<TransactionNodeType>) => {
  const { status, extraHandles, handleSend, hasKeySigner, hasTransaction, upstreamError, draft } = useTransactionNode(
    props.id
  )
  const { embedded } = useFlowMode()
  const openInEditor = useOpenInEditor()

  const nodeActions = useNodeActions<ActionsFor<NodeTypeEnum.TRANSACTION>>(props.type, {
    Send:
      embedded && !hasKeySigner
        ? () => {
            toast.info('Sending with a connected wallet is available in the full editor')
            openInEditor()
          }
        : handleSend,
  })
  // Send needs a built transaction (an instruction error upstream leaves none); a draft also needs its signers.
  const draftBlocked = !!draft && (!!draft.error || draft.missingSigners.length > 0)
  const actions = nodeActions.map((action) =>
    action.label === 'Send' ? { ...action, disabled: !hasTransaction || draftBlocked } : action
  )

  return (
    <CustomNode {...props} actions={actions} extraHandles={extraHandles}>
      <div className="mt-2 flex items-center gap-2 text-[10px] leading-[12px] justify-center">
        {upstreamError && status !== 'pending' && (
          <>
            <AlertCircle className="size-3 text-red-500" />
            <span>Fix the instruction error to send</span>
          </>
        )}
        {status === 'pending' && (
          <>
            <Loader2 className="size-3 animate-spin" />
            <span>Sending...</span>
          </>
        )}
        {status === 'success' && (
          <>
            <Check className="size-3 text-green-500" />
            <span>Success</span>
          </>
        )}
        {status === 'failed' && (
          <>
            <X className="size-3 text-red-500" />
            <span>Failed</span>
          </>
        )}
      </div>
      {draft && (
        <div className="mt-1 flex flex-col items-center gap-0.5 text-[8px] leading-[10px] text-center">
          {draft.matchesOriginal !== undefined && (
            // An edited import is fine to send; ✗ only says it is no longer the original message.
            <span className={draft.matchesOriginal ? 'text-green-500' : 'text-muted-foreground'}>
              {draft.matchesOriginal ? 'matches original ✓' : 'matches original ✗'}
            </span>
          )}
          {draft.feePayerReplaced && (
            <span className="text-muted-foreground">
              Fee payer {truncatePubkey(draft.feePayerReplaced.from)} can't sign here:{' '}
              {truncatePubkey(draft.feePayerReplaced.to)} pays instead
            </span>
          )}
          {draft.missingSigners.length > 0 && (
            <span className="text-red-500">Missing signers: {draft.missingSigners.map(truncatePubkey).join(', ')}</span>
          )}
          {draft.error && !upstreamError && <span className="text-red-500">{draft.error}</span>}
          {status === 'failed' && draft.sendError && <span className="text-red-500">{draft.sendError}</span>}
        </div>
      )}
    </CustomNode>
  )
}
