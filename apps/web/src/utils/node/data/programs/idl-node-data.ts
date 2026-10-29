import { Position } from '@xyflow/react'
import type { NodeConfig } from '@/types/node-config'

export const idlNodeConfig = {
  label: 'IDL',
  handles: [
    {
      position: Position.Left,
      type: 'target',
      dataField: 'network',
      label: 'Network',
      dataType: 'network',
    },
    {
      position: Position.Right,
      type: 'source',
      dataField: 'idl',
      label: 'IDL',
      dataType: 'idl',
    },
    {
      position: Position.Right,
      type: 'source',
      dataField: 'programId',
      label: 'Program ID',
      dataType: 'publicKey',
    },
  ],
  actions: [],
  transient: ['idl', 'status'],
} as const satisfies NodeConfig
