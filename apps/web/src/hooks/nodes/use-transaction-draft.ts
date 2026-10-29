import { useCallback, useEffect, useMemo, useState } from 'react'
import bs58 from 'bs58'
import {
  PublicKey,
  Transaction,
  VersionedMessage,
  VersionedTransaction,
  type Connection,
  type Keypair,
  type Message,
} from '@solana/web3.js'
import { useNodesData, useStore, type ReactFlowState } from '@xyflow/react'
import { useWallet } from '@solana/wallet-adapter-react'
import { shallow } from 'zustand/shallow'
import type { Network } from '@/types/network'
import type { TxDraftMeta } from '@/types/nodes/transactions/transaction-builder-node'
import { useTypedReactFlow } from '@/hooks/flow/use-typed-react-flow'
import { useFlowMode } from '@/components/flow/flow-mode-context'
import { getSolanaConnection } from '@/constants/solana/connection'
import { useRpcConfig } from '@/providers/rpc-urls-context'
import { evaluateTxChain } from '@/utils/flow/evaluate-tx-chain'
import { handleDataField } from '@/utils/flow/resolve-inputs'
import {
  findTxChainHead,
  hasDraftMeta,
  lastEdgeInto,
  publicKeyString,
  readDraftMeta,
  upstreamFlow,
} from '@/utils/flow/tx-draft'
import { createAppResolveIdl } from '@/utils/idl/sources/app-resolver'
import {
  compileMessage,
  fromTransactionInstruction,
  type AltAccounts,
  type MessageInstruction,
} from '@/utils/solana/message-compiler'
import { detectDurableNonce, messageHash, planSend, type SendPlan, type SendPlanInput } from '@/utils/solana/send-plan'
import { truncatePubkey } from '@/utils/solana/transaction.utils'

const CHECK_DEBOUNCE_MS = 500

export type TxDraft = TxDraftMeta & { lookupTables: string[] }

export type DraftStatus = {
  /** Undefined without original meta, or while a v0 draft has no network to load its lookup tables from. */
  matchesOriginal?: boolean
  feePayerReplaced?: SendPlan['feePayerReplaced']
  missingSigners: string[]
  error?: string
}

export type DraftSigning = {
  network: Network | null
  /** The wallet or private key on the TRANSACTION's main input. */
  primary: PublicKey | null
  /** Its keypair; null on the wallet path. */
  primaryKeypair: Keypair | null
  useWalletPath: boolean
  /** Keys connected to the signer_i inputs. */
  signerKeypairs: Keypair[]
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

// Lookup tables only grow, so the debounced check reuses fetched ones; Send always fetches them again.
const altCache = new Map<string, Promise<string[]>>()

const loadAltAccounts = async (connection: Connection, tables: string[], fresh: boolean): Promise<AltAccounts> => {
  const entries = await Promise.all(
    tables.map(async (table) => {
      const key = `${connection.rpcEndpoint} ${table}`
      let addresses = fresh ? undefined : altCache.get(key)
      if (!addresses) {
        addresses = connection.getAddressLookupTable(new PublicKey(table)).then(({ value }) => {
          if (!value) throw new Error(`Address lookup table ${table} was not found`)
          return value.state.addresses.map((a) => a.toBase58())
        })
        altCache.set(key, addresses)
        addresses.catch(() => altCache.delete(key))
      }
      return [table, await addresses] as const
    })
  )
  return Object.fromEntries(entries)
}

const instructionSigners = (instructions: MessageInstruction[]) => [
  ...new Set(instructions.flatMap((ix) => ix.metas.filter((m) => m.isSigner).map((m) => m.pubkey))),
]

/**
 * The draft meta of the TX_BUILDER that starts this TRANSACTION's chain, with its fee payer resolved (edge, else
 * inline). Null for chains without draft meta, which keep the legacy send path.
 */
export const useTransactionDraft = (nodeId: string) => {
  const head = useStore(
    useCallback(
      (s: ReactFlowState) => {
        const chain = findTxChainHead(nodeId, s.edges, (id) => s.nodeLookup.get(id)?.type)
        const edge = chain.builderId ? lastEdgeInto(s.edges, chain.builderId, ['feePayer']) : undefined
        return {
          ...chain,
          feePayerSource: edge?.source ?? null,
          feePayerField: edge?.sourceHandle ? handleDataField(edge.sourceHandle, edge.source) : null,
        }
      },
      [nodeId]
    ),
    shallow
  )
  // An empty id matches no node (both hooks then return null).
  const builderData = useNodesData(head.builderId ?? '')?.data
  const feePayerSourceData = useNodesData(head.feePayerSource ?? '')?.data
  const feePayerEdgeValue = head.feePayerField ? feePayerSourceData?.[head.feePayerField] : undefined

  const draft = useMemo((): TxDraft | null => {
    const connected = head.feePayerSource !== null
    if (!builderData || !(hasDraftMeta(builderData) || connected)) return null
    const meta = readDraftMeta(builderData)
    const feePayer = connected ? publicKeyString(feePayerEdgeValue) : meta.feePayer
    return { ...meta, feePayer, lookupTables: meta.version === 0 ? (meta.lookupTables ?? []) : [] }
  }, [builderData, head.feePayerSource, feePayerEdgeValue])

  return { draft, head }
}

/**
 * The draft send path: evaluates the chain headlessly (evaluateTxChain, the code the import round-trip tests),
 * compiles it with compileMessage and signs a VersionedTransaction. Keeps a debounced "matches original" check.
 */
export const useDraftSend = (
  nodeId: string,
  { draft, head }: ReturnType<typeof useTransactionDraft>,
  signing: DraftSigning,
  /** Changes whenever the chain is rebuilt on the canvas; re-runs the check. */
  chainVersion: unknown
) => {
  const { getNodes, getEdges } = useTypedReactFlow()
  const rpc = useRpcConfig()
  const { embedded } = useFlowMode()
  const wallet = useWallet()
  const [status, setStatus] = useState<DraftStatus | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  const walletPublicKey = wallet.publicKey?.toBase58() ?? null
  const resolveIdl = useMemo(() => createAppResolveIdl(rpc, { rememberedIdls: !embedded }), [rpc, embedded])

  const evaluateInstructions = useCallback(async (): Promise<MessageInstruction[]> => {
    if (head.badLink) {
      throw new Error(
        `${head.badLink} can't be replayed with v0/import data: use built-in instruction nodes between TX BUILDER and TRANSACTION`
      )
    }
    const flow = upstreamFlow(nodeId, { nodes: getNodes(), edges: getEdges() })
    const results = await evaluateTxChain(flow, { walletPublicKey, resolveIdl })
    const result = results.find((r) => r.nodeId === head.tailId)
    if (!result) throw new Error("This transaction chain can't be evaluated")
    if (!result.transaction) throw new Error('Fix the instruction error to send')
    return result.transaction.instructions.map(fromTransactionInstruction)
  }, [head.badLink, head.tailId, nodeId, getNodes, getEdges, walletPublicKey, resolveIdl])

  const { primary, primaryKeypair, signerKeypairs, useWalletPath, network } = signing
  const availableSigners = useMemo(
    () => [
      ...new Set([...(primary ? [primary.toBase58()] : []), ...signerKeypairs.map((k) => k.publicKey.toBase58())]),
    ],
    [primary, signerKeypairs]
  )

  const plan = useCallback(
    (
      instructions: MessageInstruction[],
      rest: Pick<SendPlanInput, 'matchesOriginal' | 'blockhashValid' | 'currentNonce' | 'latestBlockhash'>
    ) =>
      planSend({
        ...rest,
        original: draft?.original,
        feePayer: draft?.feePayer,
        instructionSigners: instructionSigners(instructions),
        availableSigners,
        primarySigner: primary?.toBase58(),
      }),
    [availableSigners, draft, primary]
  )

  const compile = useCallback(
    (instructions: MessageInstruction[], feePayer: string, blockhash: string, alts: AltAccounts) =>
      compileMessage(
        { version: draft?.version ?? 'legacy', feePayer, instructions, lookupTables: draft?.lookupTables },
        blockhash,
        alts,
        draft?.hints
      ),
    [draft]
  )

  const matchesOriginal = useCallback(
    (instructions: MessageInstruction[], alts: AltAccounts) => {
      const original = draft?.original
      if (!original || !draft?.feePayer) return false
      return messageHash(compile(instructions, draft.feePayer, original.blockhash, alts)) === original.messageHash
    },
    [compile, draft]
  )

  // Optimistic check for the node: assumes the original blockhash (or nonce) is still usable; Send re-checks.
  const check = useCallback(async (): Promise<DraftStatus> => {
    const instructions = await evaluateInstructions()
    let matches: boolean | undefined
    if (draft?.original && draft.feePayer) {
      const tables = draft.lookupTables
      if (tables.length === 0) {
        matches = matchesOriginal(instructions, {})
      } else if (network) {
        const alts = await loadAltAccounts(getSolanaConnection(network, rpc.urls), tables, false)
        matches = matchesOriginal(instructions, alts)
      }
    }
    const { feePayer, feePayerReplaced, missingSigners } = plan(instructions, {
      matchesOriginal: matches ?? false,
      blockhashValid: true,
      latestBlockhash: '',
    })
    if (!feePayer)
      return { matchesOriginal: matches, missingSigners, error: 'Connect a wallet or private key to pay the fee' }
    return { matchesOriginal: matches, feePayerReplaced, missingSigners }
  }, [draft, evaluateInstructions, matchesOriginal, network, plan, rpc.urls])

  useEffect(() => {
    if (!draft) {
      setStatus(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      check().then(
        (next) => !cancelled && setStatus(next),
        (error) => !cancelled && setStatus({ missingSigners: [], error: errorMessage(error) })
      )
    }, CHECK_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [check, draft, chainVersion])

  const signWithWallet = useCallback(
    async (tx: VersionedTransaction): Promise<Uint8Array> => {
      if (!wallet.signTransaction) throw new Error('Connected wallet does not support signing')
      const versions = wallet.wallet?.adapter.supportedTransactionVersions
      if (tx.version === 0 && !versions?.has(0)) {
        throw new Error(
          'The connected wallet cannot sign version 0 transactions: connect a private key to the TRANSACTION node instead'
        )
      }
      if (versions?.has(tx.version)) return (await wallet.signTransaction(tx)).serialize()
      // Legacy-only adapters sign a Transaction; populate keeps the compiled message bytes.
      const signatures = tx.signatures.map((s) => bs58.encode(s))
      const legacy = Transaction.populate(tx.message as Message, signatures)
      return (await wallet.signTransaction(legacy)).serialize()
    },
    [wallet]
  )

  /** Builds, signs and submits the draft; returns the signature and the blockhash info to confirm against. */
  const send = useCallback(
    async (connection: Connection) => {
      if (!draft) throw new Error('No draft transaction')
      setSendError(null)
      const instructions = await evaluateInstructions()
      const alts = await loadAltAccounts(connection, draft.lookupTables, true)
      const original = draft.original
      const matches = matchesOriginal(instructions, alts)
      const nonce = detectDurableNonce(instructions)
      const [latest, currentNonce, blockhashValid] = await Promise.all([
        connection.getLatestBlockhash(),
        nonce
          ? connection.getNonce(new PublicKey(nonce.account)).then((account) => {
              if (!account) throw new Error(`Nonce account ${nonce.account} was not found`)
              return account.nonce
            })
          : undefined,
        matches && original && !nonce
          ? connection.isBlockhashValid(original.blockhash).then((r) => r.value)
          : Promise.resolve(false),
      ])
      const sendPlan = plan(instructions, {
        matchesOriginal: matches,
        blockhashValid,
        currentNonce,
        latestBlockhash: latest.blockhash,
      })
      setStatus({
        matchesOriginal: original ? matches : undefined,
        feePayerReplaced: sendPlan.feePayerReplaced,
        missingSigners: sendPlan.missingSigners,
      })
      if (!sendPlan.feePayer) throw new Error('Connect a wallet or private key to pay the fee')
      if (sendPlan.missingSigners.length > 0) {
        throw new Error(`Missing signatures from ${sendPlan.missingSigners.map(truncatePubkey).join(', ')}`)
      }

      const message = VersionedMessage.deserialize(compile(instructions, sendPlan.feePayer, sendPlan.blockhash, alts))
      const tx = new VersionedTransaction(message)
      for (const [signer, signature] of Object.entries(sendPlan.keptSignatures)) {
        tx.addSignature(new PublicKey(signer), bs58.decode(signature))
      }
      const keypairs = [...(primaryKeypair ? [primaryKeypair] : []), ...signerKeypairs].filter(
        (k, i, all) =>
          sendPlan.signers.includes(k.publicKey.toBase58()) &&
          all.findIndex((other) => other.publicKey.equals(k.publicKey)) === i
      )
      if (keypairs.length > 0) tx.sign(keypairs)
      const walletSigns = useWalletPath && !!primary && sendPlan.signers.includes(primary.toBase58())
      const raw = walletSigns ? await signWithWallet(tx) : tx.serialize()
      const signature = await connection.sendRawTransaction(raw, { skipPreflight: false })
      return { signature, latest }
    },
    [
      compile,
      draft,
      evaluateInstructions,
      matchesOriginal,
      plan,
      primary,
      primaryKeypair,
      signWithWallet,
      signerKeypairs,
      useWalletPath,
    ]
  )

  const fail = useCallback((error: unknown) => setSendError(errorMessage(error)), [])

  return { status, sendError, send, fail }
}
