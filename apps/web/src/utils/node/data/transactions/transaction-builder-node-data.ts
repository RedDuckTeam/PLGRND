import { Position } from '@xyflow/react'
import type { NodeConfig } from '@/types/node-config'

export const transactionBuilderNodeConfig = {
  label: 'TX BUILDER',
  handles: [
    { position: Position.Left, type: 'target', dataField: 'feePayer', label: 'Fee payer', dataType: 'publicKey' },
    {
      position: Position.Right,
      type: 'source',
      dataField: 'transaction',
      label: 'Transaction',
      dataType: 'transaction',
    },
  ],
  actions: [],
  transient: ['transaction'],
} as const satisfies NodeConfig
