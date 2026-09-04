import type { Node } from '@xyflow/react'
import type { NodeTypeEnum } from '../../node'

export type AtaTokenProgram = 'token' | 'token-2022'

export type AtaNodeData = {
  tokenProgram?: AtaTokenProgram
  ata?: string
}

export type AtaNodeType = Node<AtaNodeData, NodeTypeEnum.ATA>
