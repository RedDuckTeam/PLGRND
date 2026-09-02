import { CustomNode } from '../../ui/custom-node'
import type { TransactionNodeType } from '@/types/nodes/transactions/transaction-node'
import type { ActionsFor, NodeTypeEnum } from '@/types/node'
import { useNodeActions } from '@/hooks/flow/use-node-actions'
import type { NodeProps } from '@xyflow/react'
import { Check, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useTransactionNode } from '@/hooks/nodes/use-transaction-node'
import { useFlowMode } from '@/components/flow/flow-mode-context'
import { useOpenInEditor } from '@/hooks/embed/use-open-in-editor'

export const TransactionNode = (props: NodeProps<TransactionNodeType>) => {
  const { status, extraHandles, handleSend, hasKeySigner } = useTransactionNode(props.id)
  const { embedded } = useFlowMode()
  const openInEditor = useOpenInEditor()

  const actions = useNodeActions<ActionsFor<NodeTypeEnum.TRANSACTION>>(props.type, {
    Send:
      embedded && !hasKeySigner
        ? () => {
          toast.info('Sending with a connected wallet is available in the full editor')
          openInEditor()
        }
        : handleSend,
  })

  return (
    <CustomNode {...props} actions={actions} extraHandles={extraHandles}>
      <div className="mt-2 flex items-center gap-2 text-[10px] leading-[12px] justify-center">
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
    </CustomNode>
  )
}
