import type { Node } from '@xyflow/react'
import type { NodeTypeEnum } from '../../node'

export type TextNodeData = {
  text: string
  /** Set by the transaction importer on a signer's public key: offers to swap in the connected wallet. */
  signer?: boolean
}

export type TextNodeType = Node<TextNodeData, NodeTypeEnum.TEXT>
