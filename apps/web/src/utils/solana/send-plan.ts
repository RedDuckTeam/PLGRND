import { sha256 } from 'js-sha256'
import { SystemProgram } from '@solana/web3.js'
import type { TxDraftOriginal } from '@/types/nodes/transactions/transaction-builder-node'
import type { MessageInstruction } from './message-compiler'

/** Hex sha256 of message bytes, as stored in `original.messageHash`. */
export const messageHash = (bytes: Uint8Array): string => sha256(bytes)

const ADVANCE_NONCE_ACCOUNT = 4

/** The nonce account and authority when instruction 0 is System AdvanceNonceAccount (a durable-nonce transaction). */
export function detectDurableNonce(instructions: MessageInstruction[]): { account: string; authority: string } | null {
  const ix = instructions[0]
  if (!ix || ix.programId !== SystemProgram.programId.toBase58() || ix.data.length !== 4) return null
  const index = new DataView(ix.data.buffer, ix.data.byteOffset, 4).getUint32(0, true)
  if (index !== ADVANCE_NONCE_ACCOUNT || ix.metas.length < 3) return null
  return { account: ix.metas[0].pubkey, authority: ix.metas[2].pubkey }
}

export type SendPlanInput = {
  /** The message compiled with the draft fee payer and `original.blockhash` hashes to `original.messageHash`. */
  matchesOriginal: boolean
  original?: TxDraftOriginal
  /** The draft's fee payer, if it names one. */
  feePayer?: string
  /** Every signer the instructions ask for. */
  instructionSigners: string[]
  /** Keys the user can sign with now: the wallet or private key on the main input, and connected signer keys. */
  availableSigners: string[]
  /** The wallet or private key on the main input; it pays when the draft's fee payer cannot sign. */
  primarySigner?: string
  /** Whether `original.blockhash` is still valid (ignored for durable-nonce transactions). */
  blockhashValid: boolean
  /** Durable-nonce transactions: the nonce account's current nonce. */
  currentNonce?: string
  latestBlockhash: string
}

export type SendPlan = {
  feePayer: string | null
  /** Set when the draft's fee payer cannot sign here and another signer pays instead. */
  feePayerReplaced?: { from: string; to: string }
  /** The unchanged original message is sent again with its blockhash (or nonce) and stored signatures. */
  reuseOriginal: boolean
  blockhash: string
  /** Stored signatures to put on the transaction, by signer. */
  keptSignatures: Record<string, string>
  /** Signers that still have to sign, fee payer first. */
  signers: string[]
  /** Signers that have to sign but are not available. */
  missingSigners: string[]
}

/**
 * Decides how a draft is sent. The original blockhash (or durable nonce) and the stored signatures are reused only
 * when the message is unchanged and the blockhash is still usable — a nonce transaction is usable while the nonce
 * account still holds the message's blockhash. Otherwise a fresh blockhash (the current nonce for nonce
 * transactions) and every signature are needed. The draft's fee payer is replaced by the primary signer when it
 * cannot sign.
 */
export function planSend(input: SendPlanInput): SendPlan {
  const { original, primarySigner } = input
  const available = new Set(input.availableSigners)
  const nonce = input.currentNonce !== undefined
  const usable = nonce ? input.currentNonce === original?.blockhash : input.blockhashValid
  const unchanged = input.matchesOriginal && !!original && usable
  const stored = unchanged ? (original.signatures ?? {}) : {}

  let feePayer = input.feePayer ?? primarySigner ?? null
  let feePayerReplaced: SendPlan['feePayerReplaced']
  if (input.feePayer && !available.has(input.feePayer) && !stored[input.feePayer] && primarySigner) {
    feePayer = primarySigner
    feePayerReplaced = { from: input.feePayer, to: primarySigner }
  }

  // Another fee payer is another message: nothing of the original can be reused.
  const reuseOriginal = unchanged && !feePayerReplaced
  const required = [...new Set([...(feePayer ? [feePayer] : []), ...input.instructionSigners])]
  const keptSignatures = reuseOriginal
    ? Object.fromEntries(Object.entries(stored).filter(([signer]) => required.includes(signer)))
    : {}
  const signers = required.filter((s) => !keptSignatures[s])

  return {
    feePayer,
    feePayerReplaced,
    reuseOriginal,
    blockhash: reuseOriginal ? original!.blockhash : nonce ? input.currentNonce! : input.latestBlockhash,
    keptSignatures,
    signers,
    missingSigners: signers.filter((s) => !available.has(s)),
  }
}
