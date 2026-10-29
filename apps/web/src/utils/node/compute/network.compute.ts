import type { NetworkNodeData } from '@/types/nodes/network/network-node'
import type { NodeData } from './types'

export const computeNetwork = (data: NodeData): NetworkNodeData => ({
  network: data.network as NetworkNodeData['network'],
})
