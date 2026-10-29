// Frozen copy of the pre-rework IDL builder (formerly utils/idl), kept only so the baseline capture stays reproducible.
import { Transaction, TransactionInstruction, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import type { IdlInstruction } from './idl-types'
import { encodeInstructionData } from './instruction-encoder'

const getCommonProgramId = (accountName: string): PublicKey | null => {
  const normalized = accountName.toLowerCase().replace(/[_\s]/g, '')

  if (normalized === 'systemprogram' || normalized === 'system') {
    return SystemProgram.programId
  }

  if (normalized === 'rent' || normalized === 'sysvarrent') {
    return SYSVAR_RENT_PUBKEY
  }

  return null
}

export type BuildInstructionParams = {
  programId: string
  instructionDef: IdlInstruction
  resolvedInputs: Record<string, { value: unknown }>
  baseTransaction?: Transaction | null
}

export const buildProgramInstruction = async ({
  programId,
  instructionDef,
  resolvedInputs,
  baseTransaction,
}: BuildInstructionParams): Promise<Transaction> => {
  try {
    const base = baseTransaction ?? new Transaction()
    const ixs = [...base.instructions]

    const accountMetas: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = []

    for (const account of instructionDef.accounts) {
      const pubkeyValue = resolvedInputs[`account_${account.name}`]?.value

      if (pubkeyValue) {
        try {
          accountMetas.push({
            pubkey: new PublicKey(String(pubkeyValue)),
            isSigner: account.isSigner,
            isWritable: account.isMut,
          })
        } catch (error) {
          console.error(`Error parsing public key for account ${account.name}:`, error)
        }
      } else {
        const commonProgramId = getCommonProgramId(account.name)
        if (commonProgramId) {
          accountMetas.push({
            pubkey: commonProgramId,
            isSigner: account.isSigner,
            isWritable: account.isMut,
          })
        }
      }
    }

    const args: Record<string, unknown> = {}
    for (const arg of instructionDef.args) {
      const argValue = resolvedInputs[`arg_${arg.name}`]?.value
      if (argValue !== undefined) {
        args[`arg_${arg.name}`] = argValue
      }
    }

    const data = encodeInstructionData(instructionDef.name, args, instructionDef)

    const programIdPubkey = new PublicKey(programId)
    const instruction = new TransactionInstruction({
      keys: accountMetas,
      programId: programIdPubkey,
      data,
    })

    ixs.push(instruction)

    const out = new Transaction()
    if (ixs.length > 0) out.add(...ixs)

    return out
  } catch (error) {
    console.error('Error building program instruction:', error)
    return baseTransaction ?? new Transaction()
  }
}
