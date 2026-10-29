import { CustomNode } from '../../ui/custom-node'
import type { NodeProps } from '@xyflow/react'
import type { ProgramAccountNodeType } from '@/types/nodes/programs/program-account-node'
import type { ActionsFor, NodeTypeEnum } from '@/types/node'
import { useNodeActions } from '@/hooks/flow/use-node-actions'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getNodeStyles } from '@/utils/node/node-style.utils'
import { useProgramAccountNode } from '@/hooks/nodes/use-program-account-node'
import { Check, Loader2, AlertCircle } from 'lucide-react'

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  if (Array.isArray(value)) return `[${value.length} items]`
  return JSON.stringify(value)
}

export const ProgramAccountNode = (props: NodeProps<ProgramAccountNodeType>) => {
  const {
    idl,
    address,
    selectedAccount,
    setSelectedAccount,
    selectedAccountDef,
    extraHandles,
    decoded,
    decodeError,
    isLoading,
    fetchError,
    accountFound,
    refresh,
  } = useProgramAccountNode(props.id, props.data?.selectedAccount)

  const actions = useNodeActions<ActionsFor<NodeTypeEnum.PROGRAM_ACCOUNT>>(props.type, {
    Refresh: refresh,
  })

  const accounts = idl?.accounts ?? []

  return (
    <CustomNode {...props} actions={actions} extraHandles={extraHandles}>
      <div className="flex flex-col gap-1.5 pl-16 pr-10 py-2 min-w-[300px]">
        {!idl && <div className="text-[8px] text-foreground italic">Connect an IDL node to begin</div>}

        {idl && accounts.length === 0 && (
          <div className="text-[8px] text-foreground italic">This IDL has no accounts defined</div>
        )}

        {idl && accounts.length > 0 && (
          <>
            <div className="text-[8px] text-foreground mb-1">
              Program: <span className="font-mono">{idl.name}</span>
            </div>

            <div>
              <label className="text-[8px] text-foreground block mb-1">Select Account</label>
              <Select value={selectedAccount || undefined} onValueChange={setSelectedAccount}>
                <SelectTrigger color={getNodeStyles(props.type).color}>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.name} value={account.name}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedAccountDef && (
              <div className="mt-2 text-[8px] space-y-1.5">
                <div className="font-semibold text-foreground">Fields:</div>
                <div className="space-y-1 pl-2">
                  {selectedAccountDef.fields.map((field) => (
                    <div key={field.name} className="text-foreground flex items-baseline gap-1">
                      <span>•</span>
                      <span className="font-mono">{field.name}</span>
                      {field.label && <span className="text-muted-foreground">: {field.label}</span>}
                      {decoded && (
                        <span className="ml-auto font-mono text-foreground truncate max-w-[140px]">
                          {formatValue(decoded[field.name])}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  {!address && <div className="italic text-muted-foreground">Connect an address to fetch</div>}
                  {address && isLoading && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="size-2.5 animate-spin" /> Fetching...
                    </div>
                  )}
                  {address && !isLoading && fetchError && (
                    <div className="flex items-center gap-1 text-red-500">
                      <AlertCircle className="size-2.5" /> Fetch failed
                    </div>
                  )}
                  {address && !isLoading && !fetchError && !accountFound && (
                    <div className="flex items-center gap-1 text-yellow-500">
                      <AlertCircle className="size-2.5" /> Account not found
                    </div>
                  )}
                  {address && !isLoading && !fetchError && accountFound && decodeError && (
                    <div className="flex items-center gap-1 text-red-500">
                      <AlertCircle className="size-2.5" /> {decodeError}
                    </div>
                  )}
                  {address && !isLoading && !fetchError && accountFound && !decodeError && decoded && (
                    <div className="flex items-center gap-1 text-green-600">
                      <Check className="size-2.5" /> Decoded
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </CustomNode>
  )
}
