import type * as React from 'react'
import type { NodeProps } from '@xyflow/react'
import { AlertCircle } from 'lucide-react'
import { CustomNode } from '../../ui/custom-node'
import { Input } from '../../ui/input'
import { Textarea } from '../../ui/textarea'
import { InlineInput } from '@/components/ui/inline-input'
import { useFlowMode } from '@/components/flow/flow-mode-context'
import { cn } from '@/lib/utils'
import type { HandleConfig } from '@/types/node-handle'
import type { RawInstructionNodeType } from '@/types/nodes/programs/raw-instruction-node'
import { rawAccountIndex, useRawInstructionNode } from '@/hooks/nodes/use-raw-instruction-node'
import { getNodeStyles } from '@/utils/node/node-style.utils'

const stop = (e: React.SyntheticEvent) => e.stopPropagation()

// Sits inside a handle row, so its pointer events must not start a connection.
const FlagToggle = (props: {
  label: string
  title: string
  active: boolean
  color: string
  disabled: boolean
  onToggle: () => void
}) => (
  <button
    type="button"
    title={`${props.title}: ${props.active ? 'yes' : 'no'}`}
    disabled={props.disabled}
    style={props.active ? { backgroundColor: props.color, borderColor: props.color } : undefined}
    className={cn(
      'nodrag h-[10px] w-[10px] shrink-0 rounded-[2px] border border-input text-[6px] leading-none cursor-pointer',
      'disabled:cursor-not-allowed',
      props.active ? 'text-white' : 'text-muted-foreground'
    )}
    onMouseDown={stop}
    onPointerDown={stop}
    onTouchStart={stop}
    onDoubleClick={stop}
    onClick={(e) => {
      e.stopPropagation()
      props.onToggle()
    }}
  >
    {props.label}
  </button>
)

const buttonClass =
  'rounded-md border border-border bg-card px-1.5 py-0.5 text-[8px] text-foreground hover:bg-muted transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40'

export const RawInstructionNode = (props: NodeProps<RawInstructionNodeType>) => {
  const data = props.data ?? {}
  const {
    accounts,
    annotations,
    extraHandles,
    decoded,
    programIdError,
    accountErrors,
    update,
    setAccount,
    addAccount,
    removeAccount,
    convert,
  } = useRawInstructionNode(props.id, data)
  const { mode } = useFlowMode()
  const readonly = mode === 'readonly'
  const { color } = getNodeStyles(props.type)

  // Each account row: its pubkey while no edge feeds it, then the signer and writable flags.
  const renderInline = (handle: HandleConfig, connected: boolean) => {
    const index = rawAccountIndex(handle.dataField)
    const meta = index === null ? undefined : accounts[index]
    if (index === null || !meta) return null
    return (
      <>
        {connected ? (
          <span className="w-[86px] shrink-0" />
        ) : (
          <InlineInput
            value={meta.pubkey ?? ''}
            placeholder="pubkey"
            error={accountErrors[index]}
            disabled={readonly}
            onChange={(e) => setAccount(index, { pubkey: e.target.value })}
          />
        )}
        <FlagToggle
          label="S"
          title="Signer"
          active={meta.isSigner}
          color={color}
          disabled={readonly}
          onToggle={() => setAccount(index, { isSigner: !meta.isSigner })}
        />
        <FlagToggle
          label="W"
          title="Writable"
          active={meta.isWritable}
          color={color}
          disabled={readonly}
          onToggle={() => setAccount(index, { isWritable: !meta.isWritable })}
        />
      </>
    )
  }

  return (
    <CustomNode {...props} extraHandles={extraHandles} renderInline={renderInline}>
      {/* Right column: the left side holds the account rows. */}
      <div className="ml-auto mr-9 flex w-[140px] flex-col gap-1.5 py-1 text-[8px] text-foreground">
        <div>
          <label className="block mb-0.5">Program ID</label>
          <Input
            className="nodrag px-1.5 font-mono"
            color={color}
            value={data.programId ?? ''}
            placeholder="program id"
            aria-invalid={programIdError ? true : undefined}
            disabled={readonly}
            onChange={(e) => update({ programId: e.target.value })}
          />
        </div>

        <div>
          <label className="block mb-0.5">Data (hex)</label>
          <Textarea
            className="nodrag nowheel px-1.5 py-1 font-mono break-all"
            color={color}
            rows={3}
            value={data.dataHex ?? ''}
            placeholder="e.g. 02000000e803000000000000"
            disabled={readonly}
            onChange={(e) => update({ dataHex: e.target.value })}
          />
        </div>

        {!readonly && (
          <div className="flex gap-1">
            <button type="button" className={buttonClass} onClick={addAccount}>
              + Account
            </button>
            <button type="button" className={buttonClass} disabled={accounts.length === 0} onClick={removeAccount}>
              − Account
            </button>
          </div>
        )}

        {annotations && (
          <div className="space-y-0.5 rounded border border-border p-1 text-muted-foreground">
            {annotations.instruction && (
              <div>
                Decoded: <span className="font-mono text-foreground">{annotations.instruction}</span> (read-only)
              </div>
            )}
            {Object.entries(annotations.args ?? {}).map(([name, value]) => (
              <div key={name} className="truncate font-mono" title={value}>
                {name} = {value}
              </div>
            ))}
            {annotations.reason && <div className="text-orange-600">{annotations.reason}</div>}
          </div>
        )}

        {decoded && mode === 'editor' && (
          <div className="space-y-1">
            <div className="text-muted-foreground">
              IDL: <span className="font-mono text-foreground">{decoded.name}</span>
            </div>
            <button type="button" className={buttonClass} onClick={convert}>
              Convert to PROGRAM INSTRUCTIONS
            </button>
          </div>
        )}

        {data.error && (
          <div className="flex items-start gap-1 text-red-500 break-words">
            <AlertCircle className="size-2.5 shrink-0 mt-px" /> {data.error}
          </div>
        )}
      </div>
    </CustomNode>
  )
}
