import { CustomNode } from '../../ui/custom-node'
import type {
  TransactionBuilderNodeData,
  TransactionBuilderNodeType,
} from '@/types/nodes/transactions/transaction-builder-node'
import { NodeTypeEnum } from '@/types/node'
import type { HandleConfig } from '@/types/node-handle'
import { useNodeCompute } from '@/hooks/flow/use-node-compute'
import { useTypedReactFlow } from '@/hooks/flow/use-typed-react-flow'
import { useFlowMode } from '@/components/flow/flow-mode-context'
import { InlineInput } from '@/components/ui/inline-input'
import { hasDraftMeta, publicKeyString, readDraftMeta } from '@/utils/flow/tx-draft'
import type { NodeProps } from '@xyflow/react'

export const TransactionBuilderNode = (props: NodeProps<TransactionBuilderNodeType>) => {
  useNodeCompute(NodeTypeEnum.TRANSACTION_BUILDER, props.id)
  const { updateNodeData } = useTypedReactFlow()
  const { mode } = useFlowMode()
  // Draft meta comes from an import; TRANSACTION compiles such chains itself (v0, lookup tables, original order).
  const draft = hasDraftMeta(props.data) ? readDraftMeta(props.data) : null
  const tables = draft?.lookupTables?.length ?? 0

  // The inline fee payer is the draft's own `feePayer` (an edge into the handle beats it); it names itself. Builders
  // that are not drafts keep their plain handle, as in flows and embeds made before imports existed.
  const feePayer = props.data?.feePayer ?? ''
  const inlineFeePayer = draft !== null || props.data?.feePayer !== undefined
  const renderInline = (handle: HandleConfig, connected: boolean) =>
    handle.dataField === 'feePayer' && !connected && inlineFeePayer ? (
      <InlineInput
        className="w-[48px]"
        value={feePayer}
        placeholder="Fee payer"
        error={feePayer && !publicKeyString(feePayer) ? 'Invalid address' : undefined}
        disabled={mode === 'readonly'}
        onChange={(e) =>
          updateNodeData<TransactionBuilderNodeData>(props.id, { feePayer: e.target.value || undefined })
        }
      />
    ) : null

  return (
    <CustomNode {...props} renderInline={renderInline} inlineLabelWidth={0}>
      {draft && (
        // The middle row stays empty: the handles sit on the node's vertical centre.
        <div className="flex flex-col items-center text-[8px] leading-[10px] text-muted-foreground">
          <span>{draft.version === 0 ? `v0 · ${tables} ALT${tables === 1 ? '' : 's'}` : 'legacy'}</span>
          <span className="h-3" />
          <span className="h-[10px]">{draft.original && 'imported'}</span>
        </div>
      )}
    </CustomNode>
  )
}
