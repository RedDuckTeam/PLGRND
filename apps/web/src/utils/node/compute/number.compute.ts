import type { NumberNodeData } from '@/types/nodes/input/number-node'
import type { NodeData } from './types'

export const computeNumber = (data: NodeData): NumberNodeData => ({ number: data.number as number })
