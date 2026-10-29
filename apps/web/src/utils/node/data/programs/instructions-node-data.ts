import { Position } from '@xyflow/react'
import type { NodeConfig } from '@/types/node-config'

export const instructionsNodeConfig = {
  label: 'INSTRUCTIONS',
  handles: [
    {
      position: Position.Left,
      type: 'target',
      dataField: 'transactionIn',
      label: 'Transaction',
      dataType: 'transaction',
    },
    {
      position: Position.Right,
      type: 'source',
      dataField: 'transactionOut',
      label: 'Transaction',
      dataType: 'transaction',
    },
  ],
  actions: [],
  transient: ['transactionOut'],
} as const satisfies NodeConfig
