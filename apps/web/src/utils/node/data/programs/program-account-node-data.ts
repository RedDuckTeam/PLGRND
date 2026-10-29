import { Position } from '@xyflow/react'
import type { NodeConfig } from '@/types/node-config'

export const programAccountNodeConfig = {
  label: 'PROGRAM ACCOUNT',
  handles: [
    { position: Position.Left, type: 'target', dataField: 'idl', label: 'IDL', dataType: 'idl' },
    { position: Position.Left, type: 'target', dataField: 'programId', label: 'Program ID', dataType: 'publicKey' },
    { position: Position.Left, type: 'target', dataField: 'network', label: 'Network', dataType: 'network' },
    { position: Position.Left, type: 'target', dataField: 'address', label: 'Address', dataType: 'publicKey' },
  ],
  actions: [{ position: Position.Right, label: 'Refresh' }],
  transient: ['idl', 'decoded', 'error', 'field_*'],
} as const satisfies NodeConfig
