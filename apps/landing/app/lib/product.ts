export type ProductPointIcon = 'blocks' | 'live' | 'idl' | 'link'

export type ProductPoint = {
  id: string
  title: string
  description: string
  icon: ProductPointIcon
}

export type HowItWorksStep = {
  id: string
  title: string
  description: string
}

export type NodeCategory = {
  id: string
  name: string
  color: string
  nodes: string[]
}

export const PRODUCT_LEAD =
  'Instead of writing a script to derive an ATA, build an instruction and send a transaction, you wire nodes together on a canvas.'

export const PRODUCT_POINTS: ProductPoint[] = [
  {
    id: 'tested-blocks',
    title: 'Ready, tested blocks',
    description: 'Each node is a ready, tested block of code with typed inputs and outputs.',
    icon: 'blocks',
  },
  {
    id: 'live-values',
    title: 'Live values',
    description:
      'Values flow along the edges and evaluate live, so you see the actual public key, lamport amount and transaction at every step.',
    icon: 'live',
  },
  {
    id: 'idl-import',
    title: 'IDL in, nodes out',
    description: "Import a program's IDL and its instructions become nodes you can call.",
    icon: 'idl',
  },
  {
    id: 'flow-url',
    title: 'A flow is a link',
    description: 'Every flow encodes into its own URL: the whole graph is compressed into the hash.',
    icon: 'link',
  },
]

export const HOW_IT_WORKS: HowItWorksStep[] = [
  {
    id: 'drop',
    title: 'Drop nodes',
    description: 'Pick nodes from the menu and drop them on the canvas.',
  },
  {
    id: 'wire',
    title: 'Wire handles',
    description: 'Connect handles. The graph re-evaluates on every change, so downstream nodes update as you type.',
  },
  {
    id: 'send',
    title: 'Send it',
    description:
      'Feed the result into a transaction builder, connect a wallet and send it to the cluster of your choice.',
  },
  {
    id: 'share',
    title: 'Share it',
    description:
      'Hit share and hand someone the link, or use Share → Embed to generate a themed interactive widget for any page.',
  },
]

export const NODE_CATEGORIES: NodeCategory[] = [
  {
    id: 'input',
    name: 'Input',
    color: '#531d2b',
    nodes: ['Text', 'Number', 'Display', 'Comment'],
  },
  {
    id: 'math-string-logic',
    name: 'Math / String / Logic',
    color: '#3d4f91',
    nodes: [
      'Arithmetic',
      'Combine',
      'Split',
      'Substring',
      'Search',
      'Replace',
      'Length',
      'Compare',
      'Equality',
      'if',
      'Booleans',
    ],
  },
  {
    id: 'crypto',
    name: 'Crypto',
    color: '#265c75',
    nodes: ['Keypair', 'Mnemonic', 'Private key', 'Hash', 'Sign', 'Verify signature'],
  },
  {
    id: 'wallet-network',
    name: 'Wallet / Network',
    color: '#75511e',
    nodes: ['Connected wallet', 'Cluster selection', 'Balance'],
  },
  {
    id: 'utils',
    name: 'Utils',
    color: '#2f6f6a',
    nodes: [
      'SOL ↔ lamports',
      'Token amounts',
      'ATA derivation',
      'Rent exemption',
      'Public key validation',
      'String encode/decode',
    ],
  },
  {
    id: 'programs',
    name: 'Programs',
    color: '#5a1d5f',
    nodes: ['IDL import', 'Program instructions', 'Program accounts', 'PDA derivation'],
  },
  {
    id: 'transactions',
    name: 'Transactions',
    color: '#2a5f2b',
    nodes: ['Transaction builder', 'Transaction', 'Transaction view'],
  },
]

export const EXAMPLE_FLOWS =
  'Built-in example flows cover hashing, signature verification, balance checking, a SOL transfer and a program call. Each one loads straight onto the canvas.'
