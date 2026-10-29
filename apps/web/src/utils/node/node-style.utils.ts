import { NodeTypeEnum, type NodeType } from '@/types/node'

interface NodeStyle {
  color: string
  width?: number
  height?: number
}

export const nodeStyles: Record<NodeType, NodeStyle> = {
  [NodeTypeEnum.TEXT]: { color: '#531d2b', width: 300 },
  [NodeTypeEnum.DISPLAY]: { color: '#531d2b', width: 300 },
  [NodeTypeEnum.NUMBER]: { color: '#531d2b', width: 100 },
  [NodeTypeEnum.BOOLEAN]: { color: '#8a641f', width: 130 },

  [NodeTypeEnum.ADD]: { color: '#3d4f91', width: 100 },
  [NodeTypeEnum.SUBTRACT]: { color: '#3d4f91', width: 100 },
  [NodeTypeEnum.MULTIPLY]: { color: '#3d4f91', width: 100 },
  [NodeTypeEnum.DIVIDE]: { color: '#3d4f91', width: 100 },
  [NodeTypeEnum.MODULO]: { color: '#3d4f91', width: 100 },
  [NodeTypeEnum.EXPONENT]: { color: '#3d4f91', width: 100 },
  [NodeTypeEnum.ROUND]: { color: '#3d4f91', width: 100 },
  [NodeTypeEnum.MIN]: { color: '#3d4f91', width: 100 },
  [NodeTypeEnum.MAX]: { color: '#3d4f91', width: 100 },

  [NodeTypeEnum.AND]: { color: '#8a641f', width: 120 },
  [NodeTypeEnum.OR]: { color: '#8a641f', width: 120 },
  [NodeTypeEnum.NOT]: { color: '#8a641f', width: 120 },
  [NodeTypeEnum.EQUAL]: { color: '#8a641f', width: 150 },
  [NodeTypeEnum.COMPARE]: { color: '#8a641f', width: 170 },
  [NodeTypeEnum.HAS_VALUE]: { color: '#8a641f', width: 150 },
  [NodeTypeEnum.IF]: { color: '#8a641f', width: 210 },

  [NodeTypeEnum.SOL_TO_LAMPORTS]: { color: '#2f6f6a', width: 180 },
  [NodeTypeEnum.LAMPORTS_TO_SOL]: { color: '#2f6f6a', width: 180 },
  [NodeTypeEnum.VALID_PUBLIC_KEY]: { color: '#2f6f6a', width: 200 },
  [NodeTypeEnum.ATA]: { color: '#2f6f6a', width: 180 },
  [NodeTypeEnum.TOKEN_AMOUNT_TO_RAW]: { color: '#2f6f6a', width: 210 },
  [NodeTypeEnum.RAW_TO_TOKEN_AMOUNT]: { color: '#2f6f6a', width: 210 },
  [NodeTypeEnum.RENT_EXEMPT]: { color: '#2f6f6a', width: 190 },
  [NodeTypeEnum.STRING_ENCODE]: { color: '#2f6f6a', width: 240 },
  [NodeTypeEnum.STRING_DECODE]: { color: '#2f6f6a', width: 240 },

  [NodeTypeEnum.TRANSACTION_BUILDER]: { color: '#2a5f2b', width: 100 },
  [NodeTypeEnum.TRANSACTION]: { color: '#2a5f2b', width: 300 },
  [NodeTypeEnum.TRANSACTION_VIEW]: { color: '#2a5f2b', width: 300 },

  [NodeTypeEnum.NETWORK]: { color: '#75511e', width: 200 },
  [NodeTypeEnum.BALANCE]: { color: '#75511e', width: 200 },

  [NodeTypeEnum.IDL]: { color: '#5a1d5f', width: 350 },
  [NodeTypeEnum.PROGRAM_INSTRUCTIONS]: { color: '#5a1d5f', width: 350 },
  [NodeTypeEnum.PROGRAM_ACCOUNT]: { color: '#5a1d5f', width: 350 },
  [NodeTypeEnum.RAW_INSTRUCTION]: { color: '#5a1d5f', width: 400 },
  [NodeTypeEnum.TX_TRACE]: { color: '#2a5f2b', width: 380 },

  [NodeTypeEnum.WALLET]: { color: '#1f3d6b', width: 200 },

  [NodeTypeEnum.COMMENT]: { color: '#531d2b', width: 280 },
  [NodeTypeEnum.INSTRUCTIONS]: { color: '#5a1d5f', width: 300 },
  [NodeTypeEnum.PDA]: { color: '#5a1d5f', width: 140 },

  [NodeTypeEnum.HASH]: { color: '#265c75', width: 150 },
  [NodeTypeEnum.KEYPAIR]: { color: '#265c75', width: 150 },
  [NodeTypeEnum.SIGN]: { color: '#265c75', width: 150 },
  [NodeTypeEnum.VERIFY_SIGNATURE]: { color: '#265c75', width: 150 },
  [NodeTypeEnum.PRIVATE_KEY]: { color: '#265c75', width: 300 },
  [NodeTypeEnum.MNEMONIC]: { color: '#265c75', width: 160 },

  [NodeTypeEnum.STRING_COMBINE]: { color: '#7a3f24', width: 240 },
  [NodeTypeEnum.STRING_LENGTH]: { color: '#7a3f24', width: 180 },
  [NodeTypeEnum.STRING_SUBSTRING]: { color: '#7a3f24', width: 240 },
  [NodeTypeEnum.STRING_SPLIT]: { color: '#7a3f24', width: 240 },
  [NodeTypeEnum.STRING_SEARCH]: { color: '#7a3f24', width: 190 },
  [NodeTypeEnum.STRING_REPLACE]: { color: '#7a3f24', width: 240 },
}

export const getNodeStyles = (nodeType?: NodeType) => {
  if (!nodeType) return nodeStyles[NodeTypeEnum.TEXT]
  return nodeStyles[nodeType]
}
