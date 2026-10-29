// Vendored Codama IDLs of the native programs (src/constants/programs/native, from the Solana Foundation's Program
// Metadata copies). Each one is its own lazy chunk; older Memo deployments share the Memo IDL.
const MEMO = () => import('@/constants/programs/native/memo.json')

const NATIVE_IDLS: Record<string, () => Promise<{ default: unknown }>> = {
  '11111111111111111111111111111111': () => import('@/constants/programs/native/system.json'),
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: () => import('@/constants/programs/native/token.json'),
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: () => import('@/constants/programs/native/token-2022.json'),
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: () => import('@/constants/programs/native/associated-token.json'),
  ComputeBudget111111111111111111111111111111: () => import('@/constants/programs/native/compute-budget.json'),
  MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr: MEMO,
  Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo: MEMO,
}

/** The vendored IDL of a native program, or null. The caller normalizes it with the actual program id. */
export async function loadNativeIdl(programId: string): Promise<unknown | null> {
  const load = NATIVE_IDLS[programId]
  return load ? (await load()).default : null
}
