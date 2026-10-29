import { Buffer } from 'buffer'
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction } from '@solana/web3.js'
import type {
  InstructionMetaOverride,
  ProgramInstructionsNodeData,
} from '@/types/nodes/programs/program-instructions-node'
import type { RawAccountMeta } from '@/types/nodes/programs/raw-instruction-node'
import { isProgramIdl } from '@/utils/idl/format'
import type { IdlAccountMetaSummary } from '@/utils/idl/model/program-idl'
import type { NodeData, NodeInputs } from './types'

// Unconnected accounts the pre-rework builder filled by name, kept so older flows build the same bytes.
const legacyDefault = (accountName: string): string | undefined => {
  const normalized = accountName.toLowerCase().replace(/[_\s]/g, '')
  if (normalized === 'systemprogram' || normalized === 'system') return SystemProgram.programId.toBase58()
  if (normalized === 'rent' || normalized === 'sysvarrent') return SYSVAR_RENT_PUBKEY.toBase58()
  return undefined
}

/** The address an unconnected account falls back to, if any. */
export const defaultAddress = (account: IdlAccountMetaSummary) => account.defaultAddress ?? legacyDefault(account.name)

const text = (value: unknown) => (value ? String(value).trim() : '')

const publicKey = (address: string, account: string) => {
  try {
    return new PublicKey(address)
  } catch {
    throw new Error(`Invalid address for account ${account}: ${address}`)
  }
}

type Meta = { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }

/** Edge or inline value, else the IDL's fixed address, else a legacy name default; flags from the IDL. */
const idlMetas = (
  accounts: IdlAccountMetaSummary[],
  inputs: NodeInputs,
  programId: string,
  strategy: string
): Meta[] => {
  const keys: Meta[] = []
  for (const account of accounts) {
    const address = text(inputs[`account_${account.name}`]) || defaultAddress(account)
    if (address) {
      keys.push({
        pubkey: publicKey(address, account.name),
        isSigner: account.isSigner !== false,
        isWritable: account.isWritable,
      })
    } else if (!account.isOptional) {
      throw new Error(`Missing account ${account.name}`)
    } else if (strategy === 'programId') {
      // An absent optional account is passed as the program id itself (Anchor's convention).
      keys.push({ pubkey: new PublicKey(programId), isSigner: false, isWritable: false })
    }
  }
  return keys
}

/** Imported instructions: position i is the IDL's account i with the original flags; the count is the original one. */
const overriddenMetas = (
  overrides: InstructionMetaOverride[],
  accounts: IdlAccountMetaSummary[],
  inputs: NodeInputs
): Meta[] =>
  overrides.map((meta, i) => {
    const account = accounts[i] as IdlAccountMetaSummary | undefined
    const label = account?.name ?? `#${i}`
    const address =
      text(account && inputs[`account_${account.name}`]) ||
      text(meta.pubkey) ||
      (account ? defaultAddress(account) : undefined)
    if (!address) throw new Error(`Missing account ${label}`)
    return { pubkey: publicKey(address, label), isSigner: meta.isSigner === true, isWritable: meta.isWritable === true }
  })

export const computeProgramInstructions = async (
  data: NodeData,
  inputs: NodeInputs
): Promise<ProgramInstructionsNodeData> => {
  const idl = isProgramIdl(inputs.idl) ? inputs.idl : null
  const programId = typeof inputs.programId === 'string' ? inputs.programId.trim() : ''
  // null: the upstream instruction failed; undefined: nothing connected (a fresh transaction).
  const transactionIn = inputs.transactionIn as Transaction | null | undefined
  const selectedInstruction = (data.selectedInstruction as string | undefined) ?? ''
  const summary =
    idl && selectedInstruction ? idl.instructions.find((ix) => ix.name === selectedInstruction) : undefined

  if (transactionIn === null) {
    return { transactionOut: null, selectedInstruction, error: 'The incoming transaction has an error' }
  }
  // No IDL, program or instruction yet: pass the incoming transaction through.
  if (!idl || !programId || !summary) {
    return { transactionOut: transactionIn ?? new Transaction(), selectedInstruction, error: null }
  }

  try {
    const { encodeInstructionData } = await import('@/utils/idl/model/codec')
    const node = (idl.root.program.instructions ?? []).find((ix) => ix.name === summary.codamaName)
    const overrides = Array.isArray(data.metaOverrides) ? (data.metaOverrides as InstructionMetaOverride[]) : null
    const remaining = Array.isArray(data.remainingAccounts) ? (data.remainingAccounts as RawAccountMeta[]) : []

    const keys = overrides
      ? overriddenMetas(overrides, summary.accounts, inputs)
      : idlMetas(summary.accounts, inputs, programId, node?.optionalAccountStrategy ?? 'programId')
    const first = keys.length
    remaining.forEach((meta, i) => {
      const label = `#${first + i}`
      const address = text(inputs[`remaining_${i}`]) || text(meta.pubkey)
      if (!address) throw new Error(`Missing account ${label}`)
      keys.push({
        pubkey: publicKey(address, label),
        isSigner: meta.isSigner === true,
        isWritable: meta.isWritable === true,
      })
    })

    const args: Record<string, unknown> = {}
    for (const arg of summary.args) {
      const value = inputs[`arg_${arg.name}`]
      if (value !== undefined) args[arg.name] = value
    }
    const bytes = encodeInstructionData(idl, summary.name, args, { legacyEmptyData: data.legacyEmptyData === true })

    const instruction = new TransactionInstruction({
      programId: new PublicKey(programId),
      keys,
      data: Buffer.from(bytes),
    })
    const transactionOut = new Transaction()
    transactionOut.add(...(transactionIn?.instructions ?? []), instruction)
    return { transactionOut, selectedInstruction, programId, error: null }
  } catch (error) {
    return { transactionOut: null, selectedInstruction, error: error instanceof Error ? error.message : String(error) }
  }
}
