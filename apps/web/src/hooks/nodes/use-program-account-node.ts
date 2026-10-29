import { useCallback, useEffect, useMemo, useState } from 'react'
import { Position, useUpdateNodeInternals } from '@xyflow/react'
import type { TypeNode } from '@codama/nodes'
import type { Network } from '@/types/network'
import type { ProgramAccountNodeData } from '@/types/nodes/programs/program-account-node'
import { useTypedNodesData } from '@/hooks/flow/use-typed-nodes-data'
import { useTypedReactFlow } from '@/hooks/flow/use-typed-react-flow'
import { useAccountInfo } from '@/hooks/solana/query/use-account-info'
import { isProgramIdl } from '@/utils/idl/format'
import { handleDataType, typeLabel } from '@/utils/idl/type-label'

export type ProgramAccountFieldDef = { name: string; label: string; dataType: string }

export const useProgramAccountNode = (nodeId: string, initialSelectedAccount?: string) => {
  const { updateNodeData } = useTypedReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()

  const resolved = useTypedNodesData<'idl' | 'programId' | 'network' | 'address'>(nodeId)

  // Only the normalized model: a legacy IDL object persisted by older versions is ignored until the IDL node reloads.
  const rawIdl = resolved.idl?.value
  const idl = useMemo(() => (isProgramIdl(rawIdl) ? rawIdl : null), [rawIdl])
  const { network, address } = useMemo(
    () => ({
      network: (resolved.network?.value as Network) ?? null,
      address: (resolved.address?.value as string) ?? '',
    }),
    [resolved]
  )

  // Source-IDL account name, as saved by older versions (example flow 5: "Counter").
  const [selectedAccount, setSelectedAccount] = useState<string>(initialSelectedAccount ?? '')
  const [refreshKey, setRefreshKey] = useState(1)
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const selectedAccountDef = useMemo<{ name: string; fields: ProgramAccountFieldDef[] } | null>(() => {
    const summary = idl && selectedAccount ? idl.accounts.find((a) => a.name === selectedAccount) : undefined
    if (!idl || !summary) return null
    const node = (idl.root.program.accounts ?? []).find((a) => a.name === summary.codamaName)
    const fields = node?.data?.kind === 'structTypeNode' ? (node.data.fields ?? []) : []
    const types = new Map<string, TypeNode>(fields.map((f) => [f.name, f.type]))
    return {
      name: summary.name,
      fields: summary.fields.map((field) => {
        const type = types.get(field.codamaName)
        return { name: field.name, label: type ? typeLabel(type) : '', dataType: type ? handleDataType(type) : 'any' }
      }),
    }
  }, [idl, selectedAccount])

  const { data: accountInfo, isLoading, error: fetchError } = useAccountInfo(address, network, refreshKey)

  const extraHandles = useMemo(() => {
    if (!selectedAccountDef) return []
    return selectedAccountDef.fields.map((field) => ({
      position: Position.Right,
      type: 'source' as const,
      dataField: `field_${field.name}`,
      label: field.name,
      dataType: field.dataType,
    }))
  }, [selectedAccountDef])

  useEffect(() => {
    updateNodeInternals(nodeId)
  }, [extraHandles, nodeId, updateNodeInternals])

  const [decodeError, setDecodeError] = useState<string | null>(null)
  const [decoded, setDecoded] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    if (!idl || !selectedAccountDef || !accountInfo) {
      setDecoded(null)
      setDecodeError(null)
      return
    }
    let current = true
    import('@/utils/idl/model/codec')
      .then(({ decodeAccountOfType }) => decodeAccountOfType(idl, selectedAccountDef.name, accountInfo.data))
      .then((result) => {
        if (!current) return
        setDecoded(result)
        setDecodeError(null)
      })
      .catch((e: unknown) => {
        if (!current) return
        setDecoded(null)
        setDecodeError(e instanceof Error ? e.message : 'Decode failed')
      })
    return () => {
      current = false
    }
  }, [idl, selectedAccountDef, accountInfo])

  useEffect(() => {
    const fieldEntries: Record<string, unknown> = {}
    if (decoded) {
      for (const [name, value] of Object.entries(decoded)) {
        fieldEntries[`field_${name}`] = value
      }
    }
    updateNodeData<ProgramAccountNodeData>(nodeId, {
      selectedAccount,
      decoded,
      error: decodeError ?? (fetchError instanceof Error ? fetchError.message : null),
      ...fieldEntries,
    })
  }, [nodeId, selectedAccount, decoded, decodeError, fetchError, updateNodeData])

  return {
    idl,
    address,
    network,
    selectedAccount,
    setSelectedAccount,
    selectedAccountDef,
    extraHandles,
    decoded,
    decodeError,
    isLoading,
    fetchError,
    accountFound: !!accountInfo,
    refresh,
  }
}
