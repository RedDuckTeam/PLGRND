export interface BaselineInstruction {
  programId: string
  keys: { pubkey: string; isSigner: boolean; isWritable: boolean }[]
  /** Instruction data, hex. */
  data: string
}
