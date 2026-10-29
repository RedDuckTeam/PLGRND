import { NodeTypeEnum, type NodeType } from '@/types/node'
import type { NodeConfig } from '@/types/node-config'
import { textNodeConfig } from './data/input/text-node-data'
import { hashNodeConfig } from './data/crypto/hash-node-data'
import { keypairNodeConfig } from './data/crypto/keypair-node-data'
import { privateKeyNodeConfig } from './data/crypto/private-key-node-data'
import { mnemonicNodeConfig } from './data/crypto/mnemonic-node-data'
import { signNodeConfig } from './data/crypto/sign-node-data'
import { displayNodeConfig } from './data/input/display-node-data'
import { numberNodeConfig } from './data/input/number-node-config'
import {
  andNodeConfig,
  booleanNodeConfig,
  compareNodeConfig,
  equalNodeConfig,
  hasValueNodeConfig,
  ifNodeConfig,
  notNodeConfig,
  orNodeConfig,
} from './data/logic/logic-node-data'
import { lamportsToSolNodeConfig, solToLamportsNodeConfig } from './data/utils/solana-units-node-data'
import { validPublicKeyNodeConfig } from './data/utils/valid-public-key-node-data'
import { ataNodeConfig } from './data/utils/ata-node-data'
import { rawToTokenAmountNodeConfig, tokenAmountToRawNodeConfig } from './data/utils/token-amount-node-data'
import { rentExemptNodeConfig } from './data/utils/rent-exempt-node-data'
import {
  addNodeConfig,
  divideNodeConfig,
  exponentNodeConfig,
  maxNodeConfig,
  minNodeConfig,
  moduloNodeConfig,
  multiplyNodeConfig,
  roundNodeConfig,
  subtractNodeConfig,
} from './data/math/math-node-data'
import { verifySignatureNodeConfig } from './data/crypto/verify-signature-node'
import { networkNodeConfig } from './data/network/network-node-data'
import { balanceNodeConfig } from './data/network/balance-node-data'
import { transactionViewNodeConfig } from './data/transactions/transaction-view-node-data'
import { pdaNodeConfig } from './data/programs/pda-node-data'
import { transactionBuilderNodeConfig } from './data/transactions/transaction-builder-node-data'
import { instructionsNodeConfig } from './data/programs/instructions-node-data'
import { transactionNodeConfig } from './data/transactions/transaction-node-data'
import { idlNodeConfig } from './data/programs/idl-node-data'
import { programInstructionsNodeConfig } from './data/programs/program-instructions-node-data'
import { programAccountNodeConfig } from './data/programs/program-account-node-data'
import { rawInstructionNodeConfig } from './data/programs/raw-instruction-node-data'
import { walletNodeConfig } from './data/wallet/wallet-node-data'
import { commentNodeConfig } from './data/input/comment-node-data'
import { stringCombineNodeConfig } from './data/string/string-combine-node-data'
import { stringLengthNodeConfig } from './data/string/string-length-node-data'
import { stringSubstringNodeConfig } from './data/string/string-substring-node-data'
import { stringSplitNodeConfig } from './data/string/string-split-node-data'
import { stringSearchNodeConfig } from './data/string/string-search-node-data'
import { stringReplaceNodeConfig } from './data/string/string-replace-node-data'
import { stringEncodeNodeConfig } from './data/utils/string-encode-node-data'
import { stringDecodeNodeConfig } from './data/utils/string-decode-node-data'
import { txTraceNodeConfig } from './data/transactions/tx-trace-node-data'

export const nodeConfigRegistry = {
  [NodeTypeEnum.TEXT]: textNodeConfig,
  [NodeTypeEnum.HASH]: hashNodeConfig,
  [NodeTypeEnum.KEYPAIR]: keypairNodeConfig,
  [NodeTypeEnum.PRIVATE_KEY]: privateKeyNodeConfig,
  [NodeTypeEnum.MNEMONIC]: mnemonicNodeConfig,
  [NodeTypeEnum.SIGN]: signNodeConfig,
  [NodeTypeEnum.DISPLAY]: displayNodeConfig,
  [NodeTypeEnum.NUMBER]: numberNodeConfig,
  [NodeTypeEnum.BOOLEAN]: booleanNodeConfig,
  [NodeTypeEnum.ADD]: addNodeConfig,
  [NodeTypeEnum.SUBTRACT]: subtractNodeConfig,
  [NodeTypeEnum.MULTIPLY]: multiplyNodeConfig,
  [NodeTypeEnum.DIVIDE]: divideNodeConfig,
  [NodeTypeEnum.MODULO]: moduloNodeConfig,
  [NodeTypeEnum.EXPONENT]: exponentNodeConfig,
  [NodeTypeEnum.ROUND]: roundNodeConfig,
  [NodeTypeEnum.MIN]: minNodeConfig,
  [NodeTypeEnum.MAX]: maxNodeConfig,
  [NodeTypeEnum.AND]: andNodeConfig,
  [NodeTypeEnum.OR]: orNodeConfig,
  [NodeTypeEnum.NOT]: notNodeConfig,
  [NodeTypeEnum.EQUAL]: equalNodeConfig,
  [NodeTypeEnum.COMPARE]: compareNodeConfig,
  [NodeTypeEnum.HAS_VALUE]: hasValueNodeConfig,
  [NodeTypeEnum.IF]: ifNodeConfig,
  [NodeTypeEnum.SOL_TO_LAMPORTS]: solToLamportsNodeConfig,
  [NodeTypeEnum.LAMPORTS_TO_SOL]: lamportsToSolNodeConfig,
  [NodeTypeEnum.VALID_PUBLIC_KEY]: validPublicKeyNodeConfig,
  [NodeTypeEnum.ATA]: ataNodeConfig,
  [NodeTypeEnum.TOKEN_AMOUNT_TO_RAW]: tokenAmountToRawNodeConfig,
  [NodeTypeEnum.RAW_TO_TOKEN_AMOUNT]: rawToTokenAmountNodeConfig,
  [NodeTypeEnum.RENT_EXEMPT]: rentExemptNodeConfig,
  [NodeTypeEnum.VERIFY_SIGNATURE]: verifySignatureNodeConfig,
  [NodeTypeEnum.NETWORK]: networkNodeConfig,
  [NodeTypeEnum.BALANCE]: balanceNodeConfig,
  [NodeTypeEnum.TRANSACTION_VIEW]: transactionViewNodeConfig,
  [NodeTypeEnum.PDA]: pdaNodeConfig,
  [NodeTypeEnum.TRANSACTION_BUILDER]: transactionBuilderNodeConfig,
  [NodeTypeEnum.INSTRUCTIONS]: instructionsNodeConfig,
  [NodeTypeEnum.TRANSACTION]: transactionNodeConfig,
  [NodeTypeEnum.IDL]: idlNodeConfig,
  [NodeTypeEnum.PROGRAM_INSTRUCTIONS]: programInstructionsNodeConfig,
  [NodeTypeEnum.PROGRAM_ACCOUNT]: programAccountNodeConfig,
  [NodeTypeEnum.WALLET]: walletNodeConfig,
  [NodeTypeEnum.COMMENT]: commentNodeConfig,
  [NodeTypeEnum.STRING_COMBINE]: stringCombineNodeConfig,
  [NodeTypeEnum.STRING_LENGTH]: stringLengthNodeConfig,
  [NodeTypeEnum.STRING_SUBSTRING]: stringSubstringNodeConfig,
  [NodeTypeEnum.STRING_SPLIT]: stringSplitNodeConfig,
  [NodeTypeEnum.STRING_SEARCH]: stringSearchNodeConfig,
  [NodeTypeEnum.STRING_REPLACE]: stringReplaceNodeConfig,
  [NodeTypeEnum.STRING_ENCODE]: stringEncodeNodeConfig,
  [NodeTypeEnum.STRING_DECODE]: stringDecodeNodeConfig,
  [NodeTypeEnum.RAW_INSTRUCTION]: rawInstructionNodeConfig,
  [NodeTypeEnum.TX_TRACE]: txTraceNodeConfig,
} as const satisfies Record<NodeType, NodeConfig>

export const getNodeConfig = (nodeType: NodeType) => {
  return nodeConfigRegistry[nodeType] as NodeConfig
}
