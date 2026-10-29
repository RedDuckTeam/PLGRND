import { CustomNode } from '../../ui/custom-node'
import type { ProgramInstructionsNodeType } from '@/types/nodes/programs/program-instructions-node'
import type { ActionsFor, NodeTypeEnum } from '@/types/node'
import type { HandleConfig } from '@/types/node-handle'
import { useNodeActions } from '@/hooks/flow/use-node-actions'
import type { NodeProps } from '@xyflow/react'
import { AlertCircle } from 'lucide-react'
import { InlineInput } from '@/components/ui/inline-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFlowMode } from '@/components/flow/flow-mode-context'
import { getNodeStyles } from '@/utils/node/node-style.utils'
import { useProgramInstructionsNode } from '@/hooks/nodes/use-program-instructions-node'

export const ProgramInstructionsNode = (props: NodeProps<ProgramInstructionsNodeType>) => {
  const { idl, selectedInstruction, setSelectedInstruction, extraHandles, inlineField, fieldErrors } =
    useProgramInstructionsNode(props.id, props.data ?? {})
  const { mode } = useFlowMode()

  const actions = useNodeActions<ActionsFor<NodeTypeEnum.PROGRAM_INSTRUCTIONS>>(props.type, {})
  const error = props.data?.error

  // Accounts, arguments and the program id take a typed value while no edge feeds them.
  const renderInline = (handle: HandleConfig, connected: boolean) => {
    const field = connected ? null : inlineField(handle.dataField)
    if (!field) return null
    return (
      <InlineInput
        value={field.value}
        placeholder={field.placeholder}
        error={field.error}
        disabled={mode === 'readonly'}
        onChange={(e) => field.onChange(e.target.value)}
      />
    )
  }

  return (
    <CustomNode {...props} actions={actions} extraHandles={extraHandles} renderInline={renderInline}>
      {/* Right column: the left side holds the handle rows and their inline fields. */}
      <div className="ml-auto mr-9 flex w-[118px] flex-col gap-1.5 py-1">
        {!idl && <div className="text-[8px] text-foreground italic">Connect an IDL node to begin</div>}

        {idl && (
          <>
            <div className="text-[8px] text-foreground truncate" title={idl.name}>
              Program: <span className="font-mono">{idl.name}</span>
            </div>

            <div>
              <label className="text-[8px] text-foreground block mb-1">Select Instruction</label>
              <Select value={selectedInstruction} onValueChange={setSelectedInstruction}>
                <SelectTrigger color={getNodeStyles(props.type).color}>
                  <SelectValue placeholder="Select instruction" />
                </SelectTrigger>
                <SelectContent>
                  {idl.instructions.map((instruction) => (
                    <SelectItem key={instruction.name} value={instruction.name}>
                      {instruction.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {(fieldErrors.length > 0 ? fieldErrors : error ? [error] : []).map((message, i) => (
          <div key={i} className="flex items-start gap-1 text-[8px] text-red-500 break-words">
            <AlertCircle className="size-2.5 shrink-0 mt-px" /> {message}
          </div>
        ))}
      </div>
    </CustomNode>
  )
}
