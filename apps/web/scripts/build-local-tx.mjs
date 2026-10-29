// Dev-only: prints deterministic, locally built serialized transactions (base64) for capture-fixture.mjs.
//
//   node apps/web/scripts/capture-fixture.mjs "$(node apps/web/scripts/build-local-tx.mjs partially-signed)" \
//     --cluster mainnet --name partially-signed
import { createHash } from 'node:crypto'
import { Keypair, SystemProgram, Transaction } from '@solana/web3.js'
import { MINT_SIZE, TOKEN_PROGRAM_ID, createInitializeMintInstruction } from '@solana/spl-token'

const keypair = (label) => Keypair.fromSeed(createHash('sha256').update(`plgrnd-fixture:${label}`).digest())
// Any 32 bytes; simulation replaces it.
const BLOCKHASH = 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi'

const builders = {
  // Create-mint tx: the new mint keypair signs, the fee payer (never funded) does not.
  'partially-signed': () => {
    const payer = keypair('payer').publicKey
    const mint = keypair('mint')
    const tx = new Transaction({ feePayer: payer, recentBlockhash: BLOCKHASH }).add(
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: mint.publicKey,
        lamports: 1461600,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(mint.publicKey, 6, payer, payer)
    )
    tx.partialSign(mint)
    return tx.serialize({ requireAllSignatures: false, verifySignatures: false })
  },
}

const name = process.argv[2]
if (!builders[name]) {
  console.error(`Usage: build-local-tx.mjs <${Object.keys(builders).join('|')}>`)
  process.exit(1)
}
console.log(Buffer.from(builders[name]()).toString('base64'))
