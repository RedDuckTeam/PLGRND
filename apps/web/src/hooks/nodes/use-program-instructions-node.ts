import { useCallback, useEffect, useMemo, useState } from 'react'
import { Position, useUpdateNodeInternals } from '@xyflow/react'
import { NodeTypeEnum } from '@/types/node'
import type { HandleConfig } from '@/types/node-handle'
import type { ProgramInstructionsNodeData } from '@/types/nodes/programs/program-instructions-node'
import { useTypedNodesData } from '@/hooks/flow/use-typed-nodes-data'
import { useTypedReactFlow } from '@/hooks/flow/use-typed-react-flow'
import { useNodeCompute } from '@/hooks/flow/use-node-compute'
import { useSetInlineValue } from '@/hooks/flow/use-set-inline-value'
import type { ResolvedInputs } from '@/utils/flow/resolve-inputs'
import { isProgramIdl } from '@/utils/idl/format'
import type { IdlAccountMetaSummary } from '@/utils/idl/model/program-idl'
import { typeLabel } from '@/utils/idl/type-label'
import { defaultAddress } from '@/utils/node/compute/program-instructions.compute'
import { isValidPublicKey } from '@/utils/validation/validation.utils'

/** e.g. `authority (signer, mut, optional)`. */
const accountFlags = (account: IdlAccountMetaSummary) =>
  [
    account.isSigner === 'either' ? 'optional signer' : account.isSigner && 'signer',
    account.isWritable && 'mut',
    account.isOptional && 'optional',
  ]
    .filter(Boolean)
    .join(', ')

const metaFlags = (meta: { isSigner: boolean; isWritable: boolean }) =>
  [meta.isSigner && 'signer', meta.isWritable && 'mut'].filter(Boolean).join(', ')

const withFlags = (name: string, flags: string) => (flags ? `${name} (${flags})` : name)

export type InlineField = { value: string; placeholder: string; onChange: (value: string) => void; error?: string }

export const useProgramInstructionsNode = (nodeId: string, data: ProgramInstructionsNodeData) => {
  const updateNodeInternals = useUpdateNodeInternals()
  const { updateNodeData } = useTypedReactFlow()
  const setInline = useSetInlineValue(nodeId)
  const { inline, metaOverrides, remainingAccounts, legacyEmptyData } = data

  const resolved = useTypedNodesData<'idl' | 'programId' | 'transactionIn'>(nodeId, inline)

  // Only the normalized model: a legacy IDL object persisted by older versions is ignored until the IDL node reloads.
  const rawIdl = resolved.idl?.value
  const idl = useMemo(() => (isProgramIdl(rawIdl) ? rawIdl : null), [rawIdl])

  const [selectedInstruction, setSelected] = useState<string>(data.selectedInstruction ?? '')

  // Original metas describe the imported instruction only; picking another one drops them.
  const setSelectedInstruction = useCallback(
    (name: string) => {
      setSelected(name)
      if (metaOverrides || remainingAccounts || legacyEmptyData) {
        updateNodeData<ProgramInstructionsNodeData>(nodeId, {
          metaOverrides: undefined,
          remainingAccounts: undefined,
          legacyEmptyData: undefined,
        })
      }
    },
    [legacyEmptyData, metaOverrides, nodeId, remainingAccounts, updateNodeData]
  )

  const selectedInstructionDef = useMemo(
    () => (idl && selectedInstruction ? (idl.instructions.find((i) => i.name === selectedInstruction) ?? null) : null),
    [idl, selectedInstruction]
  )

  // Handle ids use the source-IDL names, so edges of flows saved before the IDL rework still connect.
  const extraHandles = useMemo<HandleConfig[]>(() => {
    if (!selectedInstructionDef) return []
    // With original metas, only the accounts the instruction passed exist, with their original flags.
    const accounts = metaOverrides
      ? selectedInstructionDef.accounts.slice(0, metaOverrides.length)
      : selectedInstructionDef.accounts
    const first = metaOverrides?.length ?? selectedInstructionDef.accounts.length
    return [
      ...accounts.map((account, i) => ({
        position: Position.Left,
        type: 'target' as const,
        dataField: `account_${account.name}`,
        label: withFlags(account.name, metaOverrides ? metaFlags(metaOverrides[i]) : accountFlags(account)),
        dataType: 'publicKey',
      })),
      ...selectedInstructionDef.args.map((arg) => ({
        position: Position.Left,
        type: 'target' as const,
        dataField: `arg_${arg.name}`,
        label: `${arg.name}: ${typeLabel(arg.type)}`,
        dataType: 'any',
      })),
      ...(remainingAccounts ?? []).map((meta, i) => ({
        position: Position.Left,
        type: 'target' as const,
        dataField: `remaining_${i}`,
        label: withFlags(`#${first + i}`, metaFlags(meta)),
        dataType: 'publicKey',
      })),
    ]
  }, [metaOverrides, remainingAccounts, selectedInstructionDef])

  useEffect(() => {
    updateNodeInternals(nodeId)
  }, [extraHandles, nodeId, updateNodeInternals])

  useNodeCompute(
    NodeTypeEnum.PROGRAM_INSTRUCTIONS,
    nodeId,
    { selectedInstruction, metaOverrides, remainingAccounts, legacyEmptyData },
    resolved
  )

  // Inline arguments are checked with the codec's parser (complex types are JSON); it loads with the IDL model.
  const [argErrors, setArgErrors] = useState<Record<string, string>>({})
  useEffect(() => {
    const args = (selectedInstructionDef?.args ?? []).filter((arg) => inline?.[`arg_${arg.name}`] !== undefined)
    if (!idl || args.length === 0) {
      setArgErrors({})
      return
    }
    let cancelled = false
    void import('@/utils/idl/model/values').then(({ parseValue }) => {
      const errors: Record<string, string> = {}
      for (const arg of args) {
        try {
          parseValue(inline?.[`arg_${arg.name}`], arg.type, idl.root)
        } catch (error) {
          errors[`arg_${arg.name}`] = error instanceof Error ? error.message : String(error)
        }
      }
      if (!cancelled) setArgErrors(errors)
    })
    return () => {
      cancelled = true
    }
  }, [idl, inline, selectedInstructionDef])

  const setRemainingPubkey = useCallback(
    (index: number, pubkey: string) =>
      updateNodeData<ProgramInstructionsNodeData>(nodeId, (node) => ({
        remainingAccounts: ((node.data as ProgramInstructionsNodeData).remainingAccounts ?? []).map((meta, i) =>
          i === index ? { ...meta, pubkey } : meta
        ),
      })),
    [nodeId, updateNodeData]
  )

  const connected = useCallback((field: string) => Boolean((resolved as ResolvedInputs)[field]?.sourceId), [resolved])

  /** The inline field shown next to an unconnected handle, or null for handles without one. */
  const inlineField = useCallback(
    (field: string): InlineField | null => {
      const value = inline?.[field] ?? ''
      const addressError = value && !isValidPublicKey(value.trim()) ? 'Invalid address' : undefined
      const onChange = (next: string) => setInline(field, next)
      if (field === 'programId') return { value, placeholder: 'program id', onChange, error: addressError }

      const remaining = /^remaining_(\d+)$/.exec(field)
      if (remaining) {
        const index = Number(remaining[1])
        const pubkey = remainingAccounts?.[index]?.pubkey ?? ''
        return {
          value: pubkey,
          placeholder: 'pubkey',
          onChange: (next) => setRemainingPubkey(index, next),
          error: pubkey && !isValidPublicKey(pubkey.trim()) ? 'Invalid address' : undefined,
        }
      }

      const account = selectedInstructionDef?.accounts.find((a) => `account_${a.name}` === field)
      if (account) {
        const placeholder =
          metaOverrides?.[selectedInstructionDef!.accounts.indexOf(account)]?.pubkey ??
          defaultAddress(account) ??
          (account.isOptional ? 'optional' : 'pubkey')
        return { value, placeholder, onChange, error: addressError }
      }

      const arg = selectedInstructionDef?.args.find((a) => `arg_${a.name}` === field)
      if (arg) return { value, placeholder: typeLabel(arg.type), onChange, error: argErrors[field] }
      return null
    },
    [argErrors, inline, metaOverrides, remainingAccounts, selectedInstructionDef, setInline, setRemainingPubkey]
  )

  // Problems with the values typed into unconnected fields, by name (the handle label without type or flags).
  const fieldErrors = useMemo(
    () =>
      [{ dataField: 'programId', label: 'Program ID' }, ...extraHandles].flatMap((handle) => {
        const error = connected(handle.dataField) ? undefined : inlineField(handle.dataField)?.error
        return error ? [`${(handle.label ?? handle.dataField).replace(/\s*[:(].*$/, '')}: ${error}`] : []
      }),
    [connected, extraHandles, inlineField]
  )

  return {
    idl,
    selectedInstruction,
    setSelectedInstruction,
    selectedInstructionDef,
    extraHandles,
    inlineField,
    fieldErrors,
  }
}
