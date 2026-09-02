import { useCallback, useEffect, useMemo, useState } from 'react'
import { Keypair, Transaction } from '@solana/web3.js'
import { Position, useUpdateNodeInternals } from '@xyflow/react'
import { useWallet } from '@solana/wallet-adapter-react'
import type { Network } from '@/types/network'
import type { TransactionNodeData, TransactionStatus } from '@/types/nodes/transactions/transaction-node'
import type { WalletSignerValue } from '@/types/nodes/wallet/wallet-node'
import { useTypedNodesData } from '@/hooks/flow/use-typed-nodes-data'
import { useTypedReactFlow } from '@/hooks/flow/use-typed-react-flow'
import { getSolanaConnection } from '@/constants/solana/connection'
import { createKeypairFromPrivateKey, getRequiredSigners, truncatePubkey } from '@/utils/solana/transaction.utils'

const isWalletMarker = (value: unknown): value is WalletSignerValue =>
  typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'wallet'

export const useTransactionNode = (nodeId: string) => {
  const { updateNodeData } = useTypedReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const [status, setStatus] = useState<TransactionStatus>('idle')

  const wallet = useWallet()

  const resolved = useTypedNodesData<'privateKey' | 'network' | 'transaction'>(nodeId)

  const inputs = useMemo(() => {
    const rawSigner = resolved.privateKey?.value
    const useWalletPath = isWalletMarker(rawSigner) && wallet.connected && !!wallet.publicKey
    return {
      privateKey: typeof rawSigner === 'string' ? rawSigner : '',
      useWalletPath,
      network: (resolved.network?.value as Network) ?? null,
      transaction: (resolved.transaction?.value as Transaction | null) ?? null,
    }
  }, [resolved, wallet.connected, wallet.publicKey])

  const feePayerKeypair = useMemo(() => {
    if (inputs.useWalletPath) return null
    if (!inputs.privateKey) return null
    return createKeypairFromPrivateKey(inputs.privateKey)
  }, [inputs.useWalletPath, inputs.privateKey])

  const feePayerPublicKey = useMemo(() => {
    if (inputs.useWalletPath && wallet.publicKey) return wallet.publicKey
    if (feePayerKeypair) return feePayerKeypair.publicKey
    return null
  }, [inputs.useWalletPath, wallet.publicKey, feePayerKeypair])

  const requiredSigners = useMemo(() => {
    return getRequiredSigners(inputs.transaction)
  }, [inputs.transaction])

  const additionalSigners = useMemo(() => {
    if (!feePayerPublicKey) return []
    if (requiredSigners.length <= 1) return []

    return requiredSigners.filter((signer) => signer.toBase58() !== feePayerPublicKey.toBase58())
  }, [feePayerPublicKey, requiredSigners])

  const extraHandles = useMemo(() => {
    const handles: {
      position: Position
      type: 'target' | 'source'
      dataField: string
      label: string
      dataType?: string
    }[] = []

    additionalSigners.forEach((signer, index) => {
      handles.push({
        position: Position.Left,
        type: 'target',
        dataField: `signer_${index}`,
        label: `Signer ${truncatePubkey(signer.toBase58())}`,
        dataType: 'privateKey',
      })
    })

    return handles
  }, [additionalSigners])

  useEffect(() => {
    updateNodeInternals(nodeId)
  }, [extraHandles, nodeId, updateNodeInternals])

  const collectAdditionalSigners = useCallback(() => {
    const signers: Keypair[] = []
    const resolvedMap = resolved as unknown as Record<string, { value: unknown }>

    for (let i = 0; i < additionalSigners.length; i++) {
      const signerPrivateKey = resolvedMap[`signer_${i}`]?.value as string | undefined

      if (signerPrivateKey) {
        const signerKeypair = createKeypairFromPrivateKey(signerPrivateKey)
        if (signerKeypair) {
          const expectedPubkey = additionalSigners[i].toBase58()
          const actualPubkey = signerKeypair.publicKey.toBase58()

          if (expectedPubkey === actualPubkey) {
            signers.push(signerKeypair)
          } else {
            console.warn(`Signer ${i} mismatch. Expected: ${expectedPubkey}, Got: ${actualPubkey}`)
          }
        } else {
          console.error(`Failed to decode signer ${i}`)
        }
      } else {
        console.warn(`Missing signer ${i} for ${additionalSigners[i].toBase58()}`)
      }
    }

    return signers
  }, [additionalSigners, resolved])

  const handleSend = useCallback(async () => {
    if (!inputs.network || !inputs.transaction) return
    if (!feePayerPublicKey) return
    if (inputs.transaction.instructions.length === 0) {
      setStatus('failed')
      updateNodeData<TransactionNodeData>(nodeId, { status: 'failed' })
      return
    }

    try {
      setStatus('pending')
      updateNodeData<TransactionNodeData>(nodeId, { status: 'pending' })

      const connection = getSolanaConnection(inputs.network)
      const tx = inputs.transaction

      tx.feePayer = feePayerPublicKey
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

      let raw: Buffer | Uint8Array

      if (inputs.useWalletPath) {
        if (!wallet.signTransaction) throw new Error('Connected wallet does not support signing')

        const additional = collectAdditionalSigners()
        if (additional.length > 0) tx.partialSign(...additional)

        const signed = await wallet.signTransaction(tx as unknown as Parameters<typeof wallet.signTransaction>[0])
        raw = (signed as Transaction).serialize()
      } else {
        if (!feePayerKeypair) throw new Error('Missing fee payer keypair')
        const allSigners: Keypair[] = [feePayerKeypair, ...collectAdditionalSigners()]
        tx.sign(...allSigners)
        raw = tx.serialize()
      }

      const sig = await connection.sendRawTransaction(raw, { skipPreflight: false })
      await connection.confirmTransaction({ signature: sig, ...(await connection.getLatestBlockhash()) }, 'confirmed')

      updateNodeData<TransactionNodeData>(nodeId, { signature: sig, status: 'success' })
      setStatus('success')
    } catch (e) {
      console.error(e)
      updateNodeData<TransactionNodeData>(nodeId, { status: 'failed' })
      setStatus('failed')
    }
  }, [
    inputs.network,
    inputs.transaction,
    inputs.useWalletPath,
    feePayerPublicKey,
    feePayerKeypair,
    wallet,
    nodeId,
    updateNodeData,
    collectAdditionalSigners,
  ])

  return {
    status,
    extraHandles,
    handleSend,
    hasKeySigner: feePayerKeypair !== null,
  }
}
