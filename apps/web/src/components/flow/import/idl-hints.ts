export interface IdlHint {
  name: string
  url: string
  note: string
}

// Where to look for the IDL of well-known programs that publish none on chain. Static: nothing is fetched.
export const IDL_HINTS: Record<string, IdlHint> = {
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': {
    name: 'Raydium AMM v4',
    url: 'https://github.com/raydium-io/raydium-sdk-V2',
    note: 'No official IDL is published: AMM v4 is not an Anchor program, its instruction layouts live in the Raydium SDK',
  },
  PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY: {
    name: 'Phoenix v1',
    url: 'https://github.com/Ellipsis-Labs/phoenix-v1',
    note: 'A Shank IDL is in the repository’s idl folder',
  },
}
