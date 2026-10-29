import { Buffer } from 'buffer'
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js'
import type { RawAccountMeta, RawInstructionNodeData } from '@/types/nodes/programs/raw-instruction-node'
import type { NodeData, NodeInputs } from './types'

const publicKey = (address: string, what: string) => {
  try {
    return new PublicKey(address)
  } catch {
    throw new Error(`Invalid address for ${what}: ${address}`)
  }
}

/** Hex bytes; whitespace and a `0x` prefix are ignored. */
export const parseHex = (text: string): Buffer => {
  const hex = text.replace(/\s+/g, '').replace(/^0x/i, '')
  if (!/^([0-9a-fA-F]{2})*$/.test(hex)) throw new Error('Invalid data: expected hex bytes')
  return Buffer.from(hex, 'hex')
}

export const computeRawInstruction = (
  data: NodeData,
  inputs: NodeInputs
): Pick<RawInstructionNodeData, 'transactionOut' | 'error'> => {
  // null: the upstream instruction failed; undefined: nothing connected (a fresh transaction).
  const transactionIn = inputs.transactionIn as Transaction | null | undefined
  if (transactionIn === null) return { transactionOut: null, error: 'The incoming transaction has an error' }

  const programId = typeof data.programId === 'string' ? data.programId.trim() : ''
  // Nothing entered yet: pass the incoming transaction through, like an unconfigured PROGRAM INSTRUCTIONS node.
  if (!programId) return { transactionOut: transactionIn ?? new Transaction(), error: null }

  try {
    const accounts = (Array.isArray(data.accounts) ? data.accounts : []) as RawAccountMeta[]
    const keys = accounts.map((meta, i) => {
      // A connected account wins even while its source is empty, like an edge over an inline value elsewhere.
      const field = `account_${i}`
      const address = (Object.hasOwn(inputs, field) ? String(inputs[field] ?? '') : (meta.pubkey ?? '')).trim()
      if (!address) throw new Error(`Missing account #${i}`)
      return {
        pubkey: publicKey(address, `account #${i}`),
        isSigner: meta.isSigner === true,
        isWritable: meta.isWritable === true,
      }
    })
    const instruction = new TransactionInstruction({
      programId: publicKey(programId, 'the program'),
      keys,
      data: parseHex(typeof data.dataHex === 'string' ? data.dataHex : ''),
    })
    const transactionOut = new Transaction()
    transactionOut.add(...(transactionIn?.instructions ?? []), instruction)
    return { transactionOut, error: null }
  } catch (error) {
    return { transactionOut: null, error: error instanceof Error ? error.message : String(error) }
  }
}
