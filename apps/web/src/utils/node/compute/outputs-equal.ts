import { Transaction, type TransactionInstruction } from '@solana/web3.js'
import type { NodeData, NodeOutputs } from './types'

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

const bytesEqual = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((byte, i) => byte === b[i])

const instructionsEqual = (a: TransactionInstruction, b: TransactionInstruction) =>
  a.programId.equals(b.programId) &&
  bytesEqual(a.data, b.data) &&
  a.keys.length === b.keys.length &&
  a.keys.every(
    (key, i) =>
      key.pubkey.equals(b.keys[i].pubkey) &&
      key.isSigner === b.keys[i].isSigner &&
      key.isWritable === b.keys[i].isWritable
  )

// Send sets the fee payer and blockhash and signs the transaction it receives in place;
// such a transaction never equals a fresh build, so a recompute still replaces it.
const isUnsent = (tx: Transaction) => !tx.feePayer && !tx.recentBlockhash && !tx.nonceInfo && tx.signatures.length === 0

const transactionsEqual = (a: Transaction, b: Transaction) =>
  isUnsent(a) &&
  isUnsent(b) &&
  a.instructions.length === b.instructions.length &&
  a.instructions.every((ix, i) => instructionsEqual(ix, b.instructions[i]))

/** Structural equality; transactions compare by their instructions (program id, keys with flags, data). */
const valuesEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true
  if (a instanceof Transaction && b instanceof Transaction) return transactionsEqual(a, b)
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => valuesEqual(v, b[i]))
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a)
    return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && valuesEqual(a[k], b[k]))
  }
  return false
}

/** True when the node's data already holds an equal value for every output, i.e. writing would change nothing. */
export const outputsEqual = (outputs: NodeOutputs, data: NodeData | undefined) =>
  Object.entries(outputs).every(([key, value]) => valuesEqual(value, data?.[key]))
