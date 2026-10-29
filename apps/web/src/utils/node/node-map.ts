import { SignNode } from '@/components/nodes/crypto/sign-node'
import { HashNode } from '@/components/nodes/crypto/hash-node'
import { KeypairNode } from '@/components/nodes/crypto/keypair-node'
import { PrivateKeyNode } from '@/components/nodes/crypto/private-key-node'
import { MnemonicNode } from '@/components/nodes/crypto/mnemonic-node'
import { TextNode } from '@/components/nodes/input/text-node'
import { NodeTypeEnum, type NodeType } from '@/types/node'
import { DisplayNode } from '@/components/nodes/input/display-node'
import { NumberNode } from '@/components/nodes/input/number-node'
import { BooleanNode } from '@/components/nodes/logic/boolean-node'
import { MathNode } from '@/components/nodes/math/math-node'
import { LogicNode } from '@/components/nodes/logic/logic-node'
import { EqualNode } from '@/components/nodes/logic/equal-node'
import { CompareNode } from '@/components/nodes/logic/compare-node'
import { HasValueNode } from '@/components/nodes/logic/has-value-node'
import { IfNode } from '@/components/nodes/logic/if-node'
import { SolToLamportsNode } from '@/components/nodes/utils/sol-to-lamports-node'
import { LamportsToSolNode } from '@/components/nodes/utils/lamports-to-sol-node'
import { ValidPublicKeyNode } from '@/components/nodes/utils/valid-public-key-node'
import { AtaNode } from '@/components/nodes/utils/ata-node'
import { RawToTokenAmountNode, TokenAmountToRawNode } from '@/components/nodes/utils/token-amount-node'
import { RentExemptNode } from '@/components/nodes/utils/rent-exempt-node'
import { VerifySignatureNode } from '@/components/nodes/crypto/verify-signature-node'
import { NetworkNode } from '@/components/nodes/network/network-node'
import { BalanceNode } from '@/components/nodes/network/balance-node'
import { TransactionViewNode } from '@/components/nodes/transactions/transaction-view-node'
import { PdaNode } from '@/components/nodes/programs/pda-node'
import { TransactionBuilderNode } from '@/components/nodes/transactions/transaction-builder-node'
import { InstructionsNode } from '@/components/nodes/programs/instructions-node'
import { TransactionNode } from '@/components/nodes/transactions/transaction-node'
import { IdlNode } from '@/components/nodes/programs/idl-node'
import { ProgramInstructionsNode } from '@/components/nodes/programs/program-instructions-node'
import { ProgramAccountNode } from '@/components/nodes/programs/program-account-node'
import { RawInstructionNode } from '@/components/nodes/programs/raw-instruction-node'
import { WalletNode } from '@/components/nodes/wallet/wallet-node'
import { CommentNode } from '@/components/nodes/input/comment-node'
import { StringCombineNode } from '@/components/nodes/string/string-combine-node'
import { StringLengthNode } from '@/components/nodes/string/string-length-node'
import { StringSubstringNode } from '@/components/nodes/string/string-substring-node'
import { StringSplitNode } from '@/components/nodes/string/string-split-node'
import { StringSearchNode } from '@/components/nodes/string/string-search-node'
import { StringReplaceNode } from '@/components/nodes/string/string-replace-node'
import { StringEncodeNode } from '@/components/nodes/utils/string-encode-node'
import { StringDecodeNode } from '@/components/nodes/utils/string-decode-node'
import { TxTraceNode } from '@/components/nodes/transactions/tx-trace-node'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const nodeMap: Record<NodeType, React.ComponentType<any>> = {
  [NodeTypeEnum.TEXT]: TextNode,
  [NodeTypeEnum.HASH]: HashNode,
  [NodeTypeEnum.KEYPAIR]: KeypairNode,
  [NodeTypeEnum.PRIVATE_KEY]: PrivateKeyNode,
  [NodeTypeEnum.MNEMONIC]: MnemonicNode,
  [NodeTypeEnum.SIGN]: SignNode,
  [NodeTypeEnum.DISPLAY]: DisplayNode,
  [NodeTypeEnum.NUMBER]: NumberNode,
  [NodeTypeEnum.BOOLEAN]: BooleanNode,
  [NodeTypeEnum.ADD]: MathNode,
  [NodeTypeEnum.SUBTRACT]: MathNode,
  [NodeTypeEnum.MULTIPLY]: MathNode,
  [NodeTypeEnum.DIVIDE]: MathNode,
  [NodeTypeEnum.MODULO]: MathNode,
  [NodeTypeEnum.EXPONENT]: MathNode,
  [NodeTypeEnum.ROUND]: MathNode,
  [NodeTypeEnum.MIN]: MathNode,
  [NodeTypeEnum.MAX]: MathNode,
  [NodeTypeEnum.AND]: LogicNode,
  [NodeTypeEnum.OR]: LogicNode,
  [NodeTypeEnum.NOT]: LogicNode,
  [NodeTypeEnum.EQUAL]: EqualNode,
  [NodeTypeEnum.COMPARE]: CompareNode,
  [NodeTypeEnum.HAS_VALUE]: HasValueNode,
  [NodeTypeEnum.IF]: IfNode,
  [NodeTypeEnum.SOL_TO_LAMPORTS]: SolToLamportsNode,
  [NodeTypeEnum.LAMPORTS_TO_SOL]: LamportsToSolNode,
  [NodeTypeEnum.VALID_PUBLIC_KEY]: ValidPublicKeyNode,
  [NodeTypeEnum.ATA]: AtaNode,
  [NodeTypeEnum.TOKEN_AMOUNT_TO_RAW]: TokenAmountToRawNode,
  [NodeTypeEnum.RAW_TO_TOKEN_AMOUNT]: RawToTokenAmountNode,
  [NodeTypeEnum.RENT_EXEMPT]: RentExemptNode,
  [NodeTypeEnum.VERIFY_SIGNATURE]: VerifySignatureNode,
  [NodeTypeEnum.NETWORK]: NetworkNode,
  [NodeTypeEnum.BALANCE]: BalanceNode,
  [NodeTypeEnum.TRANSACTION_VIEW]: TransactionViewNode,
  [NodeTypeEnum.PDA]: PdaNode,
  [NodeTypeEnum.TRANSACTION_BUILDER]: TransactionBuilderNode,
  [NodeTypeEnum.INSTRUCTIONS]: InstructionsNode,
  [NodeTypeEnum.TRANSACTION]: TransactionNode,
  [NodeTypeEnum.IDL]: IdlNode,
  [NodeTypeEnum.PROGRAM_INSTRUCTIONS]: ProgramInstructionsNode,
  [NodeTypeEnum.PROGRAM_ACCOUNT]: ProgramAccountNode,
  [NodeTypeEnum.WALLET]: WalletNode,
  [NodeTypeEnum.COMMENT]: CommentNode,
  [NodeTypeEnum.STRING_COMBINE]: StringCombineNode,
  [NodeTypeEnum.STRING_LENGTH]: StringLengthNode,
  [NodeTypeEnum.STRING_SUBSTRING]: StringSubstringNode,
  [NodeTypeEnum.STRING_SPLIT]: StringSplitNode,
  [NodeTypeEnum.STRING_SEARCH]: StringSearchNode,
  [NodeTypeEnum.STRING_REPLACE]: StringReplaceNode,
  [NodeTypeEnum.STRING_ENCODE]: StringEncodeNode,
  [NodeTypeEnum.STRING_DECODE]: StringDecodeNode,
  [NodeTypeEnum.RAW_INSTRUCTION]: RawInstructionNode,
  [NodeTypeEnum.TX_TRACE]: TxTraceNode,
}
