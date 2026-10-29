import { Transaction } from '@solana/web3.js'
import type { TransactionBuilderNodeData } from '@/types/nodes/transactions/transaction-builder-node'

export const computeTransactionBuilder = (): TransactionBuilderNodeData => ({ transaction: new Transaction() })
