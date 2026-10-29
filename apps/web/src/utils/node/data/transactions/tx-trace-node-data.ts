import { Position } from '@xyflow/react'
import type { NodeConfig } from '@/types/node-config'

export const txTraceNodeConfig = {
  label: 'TX TRACE',
  handles: [
    { position: Position.Left, type: 'target', dataField: 'signature', label: 'Signature', dataType: 'signature' },
    { position: Position.Left, type: 'target', dataField: 'network', label: 'Network', dataType: 'network' },
    { position: Position.Left, type: 'target', dataField: 'serialized', label: 'Serialized Tx', dataType: 'text' },
  ],
  actions: [{ position: Position.Right, label: 'Refresh' }],
  transient: ['trace', 'error', 'status'],
} as const satisfies NodeConfig
