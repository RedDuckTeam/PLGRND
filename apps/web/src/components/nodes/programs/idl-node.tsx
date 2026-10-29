import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CustomNode } from '../../ui/custom-node'
import type { IdlNodeData, IdlNodeType } from '@/types/nodes/programs/idl-node'
import { useTypedReactFlow } from '@/hooks/flow/use-typed-react-flow'
import { useTypedNodesData } from '@/hooks/flow/use-typed-nodes-data'
import { useNodeCompute } from '@/hooks/flow/use-node-compute'
import { NodeTypeEnum, type TargetFieldsForEnum } from '@/types/node'
import { NetworkEnum, type Network } from '@/types/network'
import type { NodeProps } from '@xyflow/react'
import { Input } from '../../ui/input'
import { Textarea } from '../../ui/textarea'
import { getNodeStyles } from '@/utils/node/node-style.utils'
import { AlertCircle, AlertTriangle, Check, Loader2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { PROGRAMS } from '@/constants/programs/programs'
import { useFlowMode } from '@/components/flow/flow-mode-context'
import { useRpcConfig } from '@/providers/rpc-urls-context'
import { isProgramIdl } from '@/utils/idl/format'
import { createAppResolveIdl } from '@/utils/idl/sources/app-resolver'
import { rememberUserIdl } from '@/utils/idl/sources/user'
import { idlLoadKey, idlLoadMode, idlNetwork, isNewIdlNode } from '@/utils/node/compute/idl.compute'

export const IdlNode = (props: NodeProps<IdlNodeType>) => {
  const { updateNodeData } = useTypedReactFlow()
  const { embedded } = useFlowMode()
  const rpc = useRpcConfig()
  const [isNew] = useState(() => isNewIdlNode(props.data))
  // Read from the node data, never copied: a replaced flow can reuse this node's id with another IDL.
  const idlJson = props.data?.idlJson ?? ''
  const programId = props.data?.programId ?? ''
  // Only IDLs the user pastes here are remembered, not the ones an opened flow comes with.
  const pasted = useRef(false)
  const resolved = useTypedNodesData<TargetFieldsForEnum<NodeTypeEnum.IDL>>(props.id)
  const { autoLoad, ref, status, network: inlineNetwork } = props.data ?? {}
  // A legacy IDL object persisted by older versions is not a ProgramIdl and is never shown.
  const idl = isProgramIdl(props.data?.idl) ? props.data.idl : null

  const nodeStyles = getNodeStyles(props.type)

  // Nodes from older flows have no autoLoad and never fetch by themselves; a node dropped from the menu does.
  useEffect(() => {
    if (isNew) updateNodeData<IdlNodeData>(props.id, { autoLoad: true })
  }, [isNew, props.id, updateNodeData])

  const resolveIdl = useMemo(() => createAppResolveIdl(rpc, { rememberedIdls: !embedded }), [rpc, embedded])
  const rememberIdl = useCallback((id: string, json: string) => {
    if (pasted.current) rememberUserIdl(id, json)
  }, [])
  const context = useMemo(
    () => (embedded || rpc.selfHosted ? { resolveIdl } : { resolveIdl, rememberIdl }),
    [embedded, rpc.selfHosted, resolveIdl, rememberIdl]
  )

  const params = { idlJson, programId, network: inlineNetwork, autoLoad, ref }
  useNodeCompute(NodeTypeEnum.IDL, props.id, params, resolved, context)

  const mode = idlLoadMode(params)
  const network = idlNetwork(params, { network: resolved.network?.value })
  const statusKey = mode === 'paste' ? 'paste' : idlLoadKey(network, programId.trim())
  const loading = mode === 'load' && status?.key !== statusKey
  const shown = !loading && status?.key === statusKey ? status : undefined

  // The compute writes `idl`, `ref`, `status` and `programId` (a pasted IDL's own address when none is typed).
  const handleProgramIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData<IdlNodeData>(props.id, { programId: e.target.value })
  }

  const handleIdlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    pasted.current = true
    updateNodeData<IdlNodeData>(props.id, { idlJson: e.target.value })
  }

  const handleProgramSelect = (value: string) => {
    const program = PROGRAMS.find((p) => p.programId === value)
    if (program) {
      pasted.current = false
      updateNodeData<IdlNodeData>(props.id, {
        programId: program.programId,
        idlJson: JSON.stringify(program.idl, null, 2),
      })
    }
  }

  return (
    <CustomNode {...props}>
      <div className="flex flex-col gap-2.5 pl-14 py-2 pr-10">
        <div>
          <label className="text-[8px] text-foreground block">Default Programs</label>
          <Select value={programId || undefined} onValueChange={handleProgramSelect}>
            <SelectTrigger color={nodeStyles.color}>
              <SelectValue placeholder="Select a program..." />
            </SelectTrigger>
            <SelectContent>
              {PROGRAMS.map((program) => (
                <SelectItem key={program.programId} value={program.programId}>
                  {program.idl.name || program.programId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[8px] text-foreground block">Program ID</label>
          <Input
            value={programId}
            onChange={handleProgramIdChange}
            placeholder="Enter program ID..."
            color={nodeStyles.color}
          />
        </div>
        {mode !== 'paste' && !resolved.network && (
          <div>
            <label className="text-[8px] text-foreground block">Network</label>
            <Select
              value={inlineNetwork ?? 'MAINNET'}
              onValueChange={(value) => updateNodeData<IdlNodeData>(props.id, { network: value as Network })}
            >
              <SelectTrigger color={nodeStyles.color} className="h-5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(NetworkEnum).map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <label className="text-[8px] text-foreground block">IDL JSON (optional)</label>
          <Textarea
            value={idlJson}
            onChange={handleIdlChange}
            placeholder="Paste an IDL (Anchor, Codama or Shank), or leave empty to load it by program ID"
            className="h-16"
            color={nodeStyles.color}
          />
        </div>
        {mode === 'manual' && (
          <button
            type="button"
            onClick={() => updateNodeData<IdlNodeData>(props.id, { autoLoad: true })}
            className="rounded-md border border-border bg-card px-2 py-1 text-[8px] text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            Load from chain
          </button>
        )}
        {loading && (
          <div className="flex items-center gap-1 text-[8px] text-muted-foreground">
            <Loader2 className="size-2.5 animate-spin" /> Loading IDL...
          </div>
        )}
        {shown?.error && (
          <div className="text-[8px] text-red-500 break-words">
            <AlertCircle className="inline size-2.5" /> {shown.error}
            {shown.failures?.map((failure) => (
              <div key={failure} className="text-muted-foreground">
                {failure}
              </div>
            ))}
          </div>
        )}
        {shown?.warnings?.map((warning) => (
          <div key={warning} className="text-[8px] text-yellow-600 break-words">
            <AlertTriangle className="inline size-2.5" /> {warning}
          </div>
        ))}
        {shown?.loaded && (
          <button
            type="button"
            onClick={() => updateNodeData<IdlNodeData>(props.id, { ref: shown.loaded })}
            className="rounded-md border border-border bg-card px-2 py-1 text-[8px] text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            Keep the loaded IDL
          </button>
        )}
        {idl && !loading && (
          <div className="text-[8px] text-green-600">
            <Check className="inline size-2.5" /> IDL loaded: {idl.name} ({idl.instructions.length} instructions)
            {shown?.badge && (
              <span className="ml-1 rounded border border-border px-1 text-muted-foreground">{shown.badge}</span>
            )}
          </div>
        )}
      </div>
    </CustomNode>
  )
}
