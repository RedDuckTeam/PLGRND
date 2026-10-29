import { useCallback, useEffect, useMemo, useState } from 'react'
import { Position, useUpdateNodeInternals } from '@xyflow/react'
import { toast } from 'sonner'
import { NodeTypeEnum, type TargetFieldsForEnum } from '@/types/node'
import type { HandleConfig } from '@/types/node-handle'
import type { RawAccountMeta, RawInstructionNodeData } from '@/types/nodes/programs/raw-instruction-node'
import { useTypedNodesData } from '@/hooks/flow/use-typed-nodes-data'
import { useTypedReactFlow } from '@/hooks/flow/use-typed-react-flow'
import { useNodeCompute } from '@/hooks/flow/use-node-compute'
import { convertRawToProgramInstructions } from '@/utils/flow/convert-raw-instruction'
import type { ResolvedInputs } from '@/utils/flow/resolve-inputs'
import { generateNodeId } from '@/utils/crypto/crypto.utils'
import { isProgramIdl } from '@/utils/idl/format'
import type { DecodedInstruction } from '@/utils/idl/model/codec'
import { parseHex } from '@/utils/node/compute/raw-instruction.compute'
import { isValidPublicKey } from '@/utils/validation/validation.utils'

const NO_ACCOUNTS: RawAccountMeta[] = []

/** The account position of an `account_<i>` handle, or null. */
export const rawAccountIndex = (field: string) => {
  const match = /^account_(\d+)$/.exec(field)
  return match ? Number(match[1]) : null
}

export const useRawInstructionNode = (nodeId: string, data: RawInstructionNodeData) => {
  const updateNodeInternals = useUpdateNodeInternals()
  const { updateNodeData, getNodes, getEdges, setNodes, setEdges } = useTypedReactFlow()
  const resolved = useTypedNodesData<TargetFieldsForEnum<NodeTypeEnum.RAW_INSTRUCTION>>(nodeId)
  const { programId, dataHex, annotations } = data
  const accounts = data.accounts ?? NO_ACCOUNTS

  useNodeCompute(NodeTypeEnum.RAW_INSTRUCTION, nodeId, { programId, accounts: data.accounts, dataHex }, resolved)

  const rawIdl = resolved.idl?.value
  const idl = useMemo(() => (isProgramIdl(rawIdl) ? rawIdl : null), [rawIdl])

  const connected = useCallback((field: string) => Boolean((resolved as ResolvedInputs)[field]?.sourceId), [resolved])

  // The pubkeys the compute uses (a connected edge replaces the typed one, even while empty), joined so unrelated
  // input changes do not re-run the decode.
  const pubkeys = useMemo(
    () =>
      accounts
        .map((meta, i) => {
          const edge = (resolved as ResolvedInputs)[`account_${i}`]
          return edge ? String(edge.value ?? '').trim() : (meta.pubkey ?? '')
        })
        .join(','),
    [accounts, resolved]
  )

  // An IDL of this program that decodes the bytes exactly offers the conversion to PROGRAM INSTRUCTIONS.
  const [decoded, setDecoded] = useState<DecodedInstruction | null>(null)
  useEffect(() => {
    if (!idl || !programId || idl.programId !== programId.trim()) {
      setDecoded(null)
      return
    }
    let cancelled = false
    void import('@/utils/idl/model/codec').then(({ decodeInstruction }) => {
      let result: DecodedInstruction | null = null
      try {
        const list = pubkeys.split(',')
        const metas = accounts.map((meta, i) => ({ ...meta, pubkey: list[i] }))
        result = decodeInstruction(idl, { data: parseHex(dataHex ?? ''), accounts: metas })
      } catch {
        // Invalid hex or accounts: nothing to convert.
      }
      if (!cancelled) setDecoded(result?.exact ? result : null)
    })
    return () => {
      cancelled = true
    }
  }, [accounts, dataHex, idl, programId, pubkeys])

  const extraHandles = useMemo<HandleConfig[]>(
    () =>
      accounts.map((_, i) => {
        const name = annotations?.accounts?.[i] ?? decoded?.accounts[i]?.name
        return {
          position: Position.Left,
          type: 'target' as const,
          dataField: `account_${i}`,
          label: !name || name.startsWith('#') ? (name ?? `#${i}`) : `#${i} ${name}`,
          dataType: 'publicKey',
        }
      }),
    [accounts, annotations, decoded]
  )

  useEffect(() => {
    updateNodeInternals(nodeId)
  }, [extraHandles, nodeId, updateNodeInternals])

  const update = useCallback(
    (patch: Partial<RawInstructionNodeData>) => updateNodeData<RawInstructionNodeData>(nodeId, patch),
    [nodeId, updateNodeData]
  )

  const setAccount = useCallback(
    (index: number, patch: Partial<RawAccountMeta>) =>
      update({ accounts: accounts.map((meta, i) => (i === index ? { ...meta, ...patch } : meta)) }),
    [accounts, update]
  )

  const addAccount = useCallback(
    () => update({ accounts: [...accounts, { pubkey: '', isSigner: false, isWritable: false }] }),
    [accounts, update]
  )

  // Removes the last account and any edge into it.
  const removeAccount = useCallback(() => {
    if (accounts.length === 0) return
    const handle = `${nodeId}-account_${accounts.length - 1}-${Position.Left}`
    setEdges((edges) => edges.filter((e) => e.targetHandle !== handle))
    update({ accounts: accounts.slice(0, -1) })
  }, [accounts, nodeId, setEdges, update])

  const convert = useCallback(() => {
    if (!idl || !decoded) return
    const flow = { nodes: getNodes(), edges: getEdges() }
    const converted = convertRawToProgramInstructions(flow, nodeId, generateNodeId(), idl, decoded)
    if (!converted) {
      toast.error('This instruction cannot be converted')
      return
    }
    setNodes(converted.nodes)
    setEdges(converted.edges)
  }, [decoded, getEdges, getNodes, idl, nodeId, setEdges, setNodes])

  // Typed values that are not addresses (a connected account takes its pubkey from the edge).
  const programIdError = programId?.trim() && !isValidPublicKey(programId.trim()) ? 'Invalid address' : undefined
  const accountErrors = useMemo(
    () =>
      accounts.map((meta, i) => {
        const pubkey = meta.pubkey?.trim()
        return !connected(`account_${i}`) && pubkey && !isValidPublicKey(pubkey) ? 'Invalid address' : undefined
      }),
    [accounts, connected]
  )

  return {
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
  }
}
