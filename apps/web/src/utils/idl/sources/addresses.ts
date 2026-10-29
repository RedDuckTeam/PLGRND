import { Buffer } from 'buffer'
import { PublicKey } from '@solana/web3.js'

export const PROGRAM_METADATA_PROGRAM_ID = new PublicKey('ProgM6JCCvbYkfKqJYHePx4xxSUSqJp7rh8Lyv7nk7S')
/** Authority under which the Solana Foundation publishes the native programs' Codama IDLs (non-canonical PMP). */
export const FOUNDATION_IDL_AUTHORITY = new PublicKey('fndnu15PLXELbLsTqrfbiweBvsBj2o12RoVfkeCCbX2')

const IDL_SEED = (() => {
  const seed = Buffer.alloc(16)
  seed.write('idl')
  return seed
})()

/** Canonical Program Metadata account: written by the program's upgrade authority. */
export const pmpCanonicalAddress = (programId: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync([programId.toBuffer(), IDL_SEED], PROGRAM_METADATA_PROGRAM_ID)[0]

export const pmpAuthorityAddress = (programId: PublicKey, authority: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync(
    [programId.toBuffer(), authority.toBuffer(), IDL_SEED],
    PROGRAM_METADATA_PROGRAM_ID
  )[0]

/** Account where `anchor idl init` stores the zlib-compressed IDL. */
export const anchorIdlAddress = (programId: PublicKey): Promise<PublicKey> =>
  PublicKey.createWithSeed(PublicKey.findProgramAddressSync([], programId)[0], 'anchor:idl', programId)
