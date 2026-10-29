import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import type { AtaNodeData, AtaTokenProgram } from '@/types/nodes/utils/ata-node'
import { toText } from '@/utils/string/string-node.utils'
import type { NodeData, NodeInputs } from './types'

export const computeAta = (data: NodeData, inputs: NodeInputs): AtaNodeData => {
  const tokenProgram = (data.tokenProgram as AtaTokenProgram | undefined) ?? 'token'
  const owner = toText(inputs.owner).trim()
  const mint = toText(inputs.mint).trim()

  let ata = ''
  try {
    if (owner && mint) {
      const programId = tokenProgram === 'token-2022' ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
      ata = getAssociatedTokenAddressSync(new PublicKey(mint), new PublicKey(owner), true, programId).toBase58()
    }
  } catch {
    // A half-typed or invalid owner or mint has no ATA yet.
  }
  return { ata, tokenProgram }
}
