import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { NodeProps } from '@xyflow/react'
import { AlertCircle, Check, Loader2, X } from 'lucide-react'
import { CustomNode } from '../../ui/custom-node'
import { Input } from '../../ui/input'
import { Textarea } from '../../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { useFlowMode } from '@/components/flow/flow-mode-context'
import { useTypedNodesData } from '@/hooks/flow/use-typed-nodes-data'
import { useTypedReactFlow } from '@/hooks/flow/use-typed-react-flow'
import { useRpcConfig } from '@/providers/rpc-urls-context'
import { NetworkEnum, type Network } from '@/types/network'
import type { NodeType } from '@/types/node'
import type { TxTraceNodeData, TxTraceNodeType } from '@/types/nodes/transactions/tx-trace-node'
import type { ResolvedInputs } from '@/utils/flow/resolve-inputs'
import { createAppResolveIdl } from '@/utils/idl/sources/app-resolver'
import { txTraceNodeConfig } from '@/utils/node/data/transactions/tx-trace-node-data'
import { getNodeStyles } from '@/utils/node/node-style.utils'
import { truncatePubkey } from '@/utils/solana/transaction.utils'
import { isValidSignature } from '@/utils/validation/validation.utils'
import type { TraceSource } from '@/utils/tx-import/load-trace'
import type { CpiEntry, TxTrace } from '@/utils/tx-import/trace'

type TraceInput = (typeof txTraceNodeConfig)['handles'][number]['dataField']

// Waits for typing to settle before fetching.
const LOAD_DELAY_MS = 300

const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const lamportsToSol = (lamports: string) => (Number(lamports) / 1e9).toFixed(9).replace(/\.?0+$/, '')

const deltaClass = (delta: string) => (delta.startsWith('-') ? 'text-red-500' : 'text-green-600')

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <div>
    <div className="text-[7px] font-bold uppercase text-muted-foreground">{title}</div>
    {children}
  </div>
)

const Address = ({ value }: { value: string }) => (
  <span title={value} className="font-mono">
    {truncatePubkey(value)}
  </span>
)

const CpiRow = ({ entry, index }: { entry: CpiEntry; index?: number }) => {
  const label = (
    <span title={entry.programId}>
      {index !== undefined && <span className="text-muted-foreground">#{index} </span>}
      <span className="text-muted-foreground">{entry.program ?? truncatePubkey(entry.programId)}</span>
      {entry.name && <span className={entry.name.startsWith('event') ? 'italic' : ''}> {entry.name}</span>}
    </span>
  )
  if (entry.children.length === 0) return <div className="pl-2.5">{label}</div>
  return (
    <details open>
      <summary className="cursor-pointer select-none">{label}</summary>
      <div className="ml-1 border-l border-border pl-1.5">
        {entry.children.map((child, i) => (
          <CpiRow key={i} entry={child} />
        ))}
      </div>
    </details>
  )
}

const TraceView = ({ trace }: { trace: TxTrace }) => {
  const { error, simulated } = trace
  const cpiCount = (entries: CpiEntry[]): number => entries.reduce((n, e) => n + 1 + cpiCount(e.children), 0)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1 text-[10px] leading-[12px]">
        {trace.status === 'success' ? (
          <Check className="size-3 text-green-500" />
        ) : (
          <X className="size-3 text-red-500" />
        )}
        <span>{trace.status === 'success' ? 'Success' : 'Failed'}</span>
        {simulated && (
          <span className="rounded border border-border px-1 text-[7px] text-muted-foreground">
            simulated{simulated.slot !== undefined ? ` @ slot ${simulated.slot}` : ''}
          </span>
        )}
      </div>
      {error && (
        <div className="break-words text-red-500">
          {error.name ?? error.raw}
          {error.instructionIndex !== undefined && ` · instruction #${error.instructionIndex}`}
          {error.message && <div>{error.message}</div>}
          {error.programId && (
            <div className="text-muted-foreground">
              <Address value={error.programId} />
              {error.code !== undefined && ` · code ${error.code}`}
            </div>
          )}
        </div>
      )}
      <div className="text-muted-foreground">
        {trace.fee !== undefined && <span>Fee {lamportsToSol(trace.fee)} SOL</span>}
        {trace.fee !== undefined && trace.computeUnits !== undefined && ' · '}
        {trace.computeUnits !== undefined && <span>{trace.computeUnits.toLocaleString('en-US')} CU</span>}
      </div>
      {trace.solDeltas && trace.solDeltas.length > 0 && (
        <Section title="SOL changes">
          <table className="w-full">
            <tbody>
              {trace.solDeltas.map((d) => (
                <tr key={d.account}>
                  <td>
                    <Address value={d.account} />
                  </td>
                  <td className={`text-right font-mono ${deltaClass(d.delta)}`} title={`${d.before} → ${d.after}`}>
                    {d.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
      {trace.tokenDeltas && trace.tokenDeltas.length > 0 && (
        <Section title="Token changes (owner · mint)">
          <table className="w-full">
            <tbody>
              {trace.tokenDeltas.map((d) => (
                <tr key={`${d.owner}:${d.mint}`}>
                  <td>
                    <Address value={d.owner} />
                  </td>
                  <td>
                    <Address value={d.mint} />
                  </td>
                  <td className={`text-right font-mono ${deltaClass(d.delta)}`} title={`${d.before} → ${d.after}`}>
                    {d.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
      <details open>
        <summary className="cursor-pointer select-none text-[7px] font-bold uppercase text-muted-foreground">
          Instructions ({cpiCount(trace.cpiTree)})
        </summary>
        <div className="nodrag nowheel max-h-60 overflow-auto">
          {trace.cpiTree.map((entry, i) => (
            <CpiRow key={i} entry={entry} index={i} />
          ))}
        </div>
      </details>
      <details>
        <summary className="cursor-pointer select-none text-[7px] font-bold uppercase text-muted-foreground">
          Logs ({trace.logs.length})
        </summary>
        <pre className="nodrag nowheel max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[7px] leading-[9px]">
          {trace.logs.join('\n')}
        </pre>
      </details>
    </div>
  )
}

export const TxTraceNode = (props: NodeProps<TxTraceNodeType>) => {
  const { updateNodeData } = useTypedReactFlow()
  const { embedded } = useFlowMode()
  const rpc = useRpcConfig()
  const [refreshKey, setRefreshKey] = useState(0)
  const resolved: ResolvedInputs<TraceInput> = useTypedNodesData(props.id)
  const { trace, error, status } = props.data

  const nodeStyles = getNodeStyles(props.type as NodeType)

  const signature = asText(resolved.signature ? resolved.signature.value : props.data.signature)
  const serialized = asText(resolved.serialized ? resolved.serialized.value : props.data.serialized)
  const edgeNetwork = resolved.network?.value as string | undefined
  const network: Network =
    edgeNetwork && edgeNetwork in NetworkEnum ? (edgeNetwork as Network) : (props.data.network ?? 'MAINNET')
  const rpcUrl = rpc.urls[network]

  const source = useMemo<TraceSource | null>(
    () => (signature ? { signature } : serialized ? { serialized } : null),
    [signature, serialized]
  )
  const resolveIdl = useMemo(() => createAppResolveIdl(rpc, { rememberedIdls: !embedded }), [rpc, embedded])

  // The trace is runtime-only: it is fetched again whenever the source changes, on load, and on Refresh.
  useEffect(() => {
    const update = (patch: Partial<TxTraceNodeData>) => updateNodeData<TxTraceNodeData>(props.id, patch)
    if (!source) {
      update({ trace: null, error: undefined, status: undefined })
      return
    }
    if ('signature' in source && !isValidSignature(source.signature)) {
      update({ trace: null, error: 'Not a transaction signature', status: 'error' })
      return
    }
    const controller = new AbortController()
    update({ trace: null, error: undefined, status: 'loading' })
    const timer = setTimeout(() => {
      // The trace module (and the IDL model it uses) is a lazy chunk.
      import('@/utils/tx-import/load-trace')
        .then(({ loadTrace }) => loadTrace(source, { network, rpcUrl, resolveIdl, signal: controller.signal }))
        .then((loaded) => {
          if (!controller.signal.aborted) update({ trace: loaded, error: undefined, status: 'loaded' })
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            update({ trace: null, error: e instanceof Error ? e.message : String(e), status: 'error' })
          }
        })
    }, LOAD_DELAY_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [source, network, rpcUrl, resolveIdl, refreshKey, props.id, updateNodeData])

  const actions = useMemo(
    () => txTraceNodeConfig.actions.map((action) => ({ ...action, onClick: () => setRefreshKey((k) => k + 1) })),
    []
  )

  return (
    <CustomNode {...props} actions={actions}>
      <div className="flex flex-col gap-2 py-1 pl-16 pr-6 text-[8px] leading-[10px]">
        {!resolved.signature && (
          <div>
            <label className="block text-[8px] text-foreground">Signature</label>
            <Input
              value={props.data.signature ?? ''}
              onChange={(e) => updateNodeData<TxTraceNodeData>(props.id, { signature: e.target.value })}
              placeholder="Transaction signature..."
              color={nodeStyles.color}
            />
          </div>
        )}
        {!signature && !resolved.serialized && (
          <div>
            <label className="block text-[8px] text-foreground">Serialized transaction (simulated)</label>
            <Textarea
              value={props.data.serialized ?? ''}
              onChange={(e) => updateNodeData<TxTraceNodeData>(props.id, { serialized: e.target.value })}
              placeholder="Base64 or base58, e.g. from a swap API"
              className="h-10"
              color={nodeStyles.color}
            />
          </div>
        )}
        {!resolved.network && (
          <div>
            <label className="block text-[8px] text-foreground">Network</label>
            <Select
              value={props.data.network ?? 'MAINNET'}
              onValueChange={(value) => updateNodeData<TxTraceNodeData>(props.id, { network: value as Network })}
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
        {status === 'loading' && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Loader2 className="size-2.5 animate-spin" />
            {source && 'serialized' in source ? 'Simulating...' : 'Loading transaction...'}
          </div>
        )}
        {status === 'error' && error && (
          <div className="break-words text-red-500">
            <AlertCircle className="inline size-2.5" /> {error}
          </div>
        )}
        {status === 'loaded' && trace && <TraceView trace={trace} />}
      </div>
    </CustomNode>
  )
}
