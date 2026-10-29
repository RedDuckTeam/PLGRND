import { NodeTypeEnum, type NodeType } from '@/types/node'

export type MenuCategory = {
  id: string
  label: string
  color: string
  nodes: NodeType[]
}

export const menuConfig: MenuCategory[] = [
  {
    id: 'input',
    label: 'Input',
    color: '#531d2b',
    nodes: [NodeTypeEnum.DISPLAY, NodeTypeEnum.TEXT, NodeTypeEnum.NUMBER, NodeTypeEnum.COMMENT],
  },
  {
    id: 'math',
    label: 'Math',
    color: '#3d4f91',
    nodes: [
      NodeTypeEnum.ADD,
      NodeTypeEnum.SUBTRACT,
      NodeTypeEnum.MULTIPLY,
      NodeTypeEnum.DIVIDE,
      NodeTypeEnum.MODULO,
      NodeTypeEnum.EXPONENT,
      NodeTypeEnum.ROUND,
      NodeTypeEnum.MIN,
      NodeTypeEnum.MAX,
    ],
  },
  {
    id: 'logic',
    label: 'Logic',
    color: '#8a641f',
    nodes: [
      NodeTypeEnum.BOOLEAN,
      NodeTypeEnum.AND,
      NodeTypeEnum.OR,
      NodeTypeEnum.NOT,
      NodeTypeEnum.EQUAL,
      NodeTypeEnum.COMPARE,
      NodeTypeEnum.HAS_VALUE,
      NodeTypeEnum.IF,
    ],
  },
  {
    id: 'utils',
    label: 'Utils',
    color: '#2f6f6a',
    nodes: [
      NodeTypeEnum.SOL_TO_LAMPORTS,
      NodeTypeEnum.LAMPORTS_TO_SOL,
      NodeTypeEnum.VALID_PUBLIC_KEY,
      NodeTypeEnum.ATA,
      NodeTypeEnum.TOKEN_AMOUNT_TO_RAW,
      NodeTypeEnum.RAW_TO_TOKEN_AMOUNT,
      NodeTypeEnum.RENT_EXEMPT,
      NodeTypeEnum.STRING_ENCODE,
      NodeTypeEnum.STRING_DECODE,
    ],
  },
  {
    id: 'transactions',
    label: 'Transactions',
    color: '#2a5f2b',
    nodes: [
      NodeTypeEnum.TRANSACTION_BUILDER,
      NodeTypeEnum.TRANSACTION,
      NodeTypeEnum.TRANSACTION_VIEW,
      NodeTypeEnum.TX_TRACE,
    ],
  },
  {
    id: 'network',
    label: 'Network',
    color: '#75511e',
    nodes: [NodeTypeEnum.NETWORK, NodeTypeEnum.BALANCE],
  },
  {
    id: 'programs',
    label: 'Programs',
    color: '#5a1d5f',
    nodes: [
      NodeTypeEnum.IDL,
      NodeTypeEnum.PROGRAM_INSTRUCTIONS,
      NodeTypeEnum.PROGRAM_ACCOUNT,
      NodeTypeEnum.INSTRUCTIONS,
      NodeTypeEnum.RAW_INSTRUCTION,
      NodeTypeEnum.PDA,
    ],
  },
  {
    id: 'wallet',
    label: 'Wallet',
    color: '#1f3d6b',
    nodes: [NodeTypeEnum.WALLET],
  },
  {
    id: 'crypto',
    label: 'Crypto',
    color: '#265c75',
    nodes: [
      NodeTypeEnum.HASH,
      NodeTypeEnum.SIGN,
      NodeTypeEnum.VERIFY_SIGNATURE,
      NodeTypeEnum.KEYPAIR,
      NodeTypeEnum.PRIVATE_KEY,
      NodeTypeEnum.MNEMONIC,
    ],
  },
  {
    id: 'string',
    label: 'String',
    color: '#7a3f24',
    nodes: [
      NodeTypeEnum.STRING_COMBINE,
      NodeTypeEnum.STRING_LENGTH,
      NodeTypeEnum.STRING_SUBSTRING,
      NodeTypeEnum.STRING_SPLIT,
      NodeTypeEnum.STRING_SEARCH,
      NodeTypeEnum.STRING_REPLACE,
    ],
  },
]
