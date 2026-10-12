import { Transaction, PublicKey, Keypair, type BlockhashWithExpiryBlockHeight, type Connection } from '@solana/web3.js'
import bs58 from 'bs58'

const coerceToBase58 = (pubkey: unknown): string | null => {
  if (!pubkey) return null
  if (typeof pubkey === 'string') return pubkey
  if (pubkey instanceof PublicKey) return pubkey.toBase58()
  if (typeof pubkey === 'object' && 'toBase58' in pubkey && typeof (pubkey as PublicKey).toBase58 === 'function') {
    return (pubkey as PublicKey).toBase58()
  }
  return null
}

export const getRequiredSigners = (transaction: Transaction | null): PublicKey[] => {
  if (!transaction || !Array.isArray(transaction.instructions)) return []

  const signerSet = new Set<string>()

  for (const instruction of transaction.instructions) {
    if (!Array.isArray(instruction?.keys)) continue
    for (const key of instruction.keys) {
      if (!key?.isSigner) continue
      const base58 = coerceToBase58(key.pubkey)
      if (base58) signerSet.add(base58)
    }
  }

  return Array.from(signerSet)
    .map((pubkey) => {
      try {
        return new PublicKey(pubkey)
      } catch {
        return null
      }
    })
    .filter((pk): pk is PublicKey => pk !== null)
}

export const truncatePubkey = (pubkey: string): string => {
  if (pubkey.length <= 8) return pubkey
  return `${pubkey.slice(0, 4)}...${pubkey.slice(-4)}`
}

export const createKeypairFromPrivateKey = (privateKeyBase58: string): Keypair | null => {
  try {
    return Keypair.fromSecretKey(bs58.decode(privateKeyBase58))
  } catch {
    return null
  }
}

export type ConfirmMode = 'subscription' | 'polling'

const POLL_INTERVAL_MS = 1000

const abortError = () => new DOMException('Send confirmation aborted', 'AbortError')

export const isAbortError = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError'

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(abortError())
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortError())
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })

/**
 * Waits until `signature` is confirmed.
 * - 'subscription': web3.js `confirmTransaction` (WebSocket signature subscription), as the app has always done.
 * - 'polling': HTTPS only (`getSignatureStatuses` every second) for pages whose CSP allows no `wss:`; gives up once
 *   the block height passes `latest.lastValidBlockHeight`. `signal` aborts it with an AbortError (e.g. on unmount).
 */
export const confirmSignature = async (
  connection: Connection,
  signature: string,
  latest: BlockhashWithExpiryBlockHeight,
  mode: ConfirmMode,
  signal?: AbortSignal
): Promise<void> => {
  if (mode === 'subscription') {
    await connection.confirmTransaction({ signature, ...(await connection.getLatestBlockhash()) }, 'confirmed')
    return
  }
  for (;;) {
    if (signal?.aborted) throw abortError()
    const { value } = await connection.getSignatureStatuses([signature])
    const status = value[0]
    if (status?.err) throw new Error(`Transaction ${signature} failed: ${JSON.stringify(status.err)}`)
    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') return
    if ((await connection.getBlockHeight('confirmed')) > latest.lastValidBlockHeight) {
      throw new Error(`Transaction ${signature} expired before it was confirmed`)
    }
    await wait(POLL_INTERVAL_MS, signal)
  }
}
