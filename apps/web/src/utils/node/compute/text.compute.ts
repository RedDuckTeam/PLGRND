import type { TextNodeData } from '@/types/nodes/input/text-node'
import type { NodeData } from './types'

export const computeText = (data: NodeData): TextNodeData => ({ text: data.text as string })
