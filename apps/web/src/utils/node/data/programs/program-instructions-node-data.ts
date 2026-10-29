import { Position } from '@xyflow/react'
import type { NodeConfig } from '@/types/node-config'

export const programInstructionsNodeConfig = {
  label: 'PROGRAM INSTRUCTIONS',
  handles: [
    {
      position: Position.Left,
      type: 'target',
      dataField: 'idl',
      label: 'IDL',
      dataType: 'idl',
    },
    {
      position: Position.Left,
      type: 'target',
      dataField: 'programId',
      label: 'Program ID',
      dataType: 'publicKey',
    },
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
  transient: ['idl', 'transactionOut', 'error'],
} as const satisfies NodeConfig
