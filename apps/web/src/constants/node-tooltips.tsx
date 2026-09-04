import React from 'react'
import type { NodeType } from '@/types/node'
import { getNodeStyles } from '@/utils/node/node-style.utils'
import { ArrowUpRight } from 'lucide-react'
import { BoldText } from '@/components/text/bold-text'
import { HighlightedText } from '@/components/text/highlighted-text'

const NODE_TOOLTIP_LINKS: Partial<Record<NodeType, string>> = {
  NETWORK: 'https://docs.solana.com/clusters',
  KEYPAIR: 'https://solana.com/ru/developers/courses/intro-to-solana/intro-to-cryptography',
  PRIVATE_KEY: 'https://solana.com/docs/intro/dev#keypairs',
  MNEMONIC: 'https://en.bitcoin.it/wiki/Seed_phrase',
  PDA: 'https://docs.solana.com/developing/programming-model/program-derived-addresses',
  BALANCE: 'https://docs.solana.com/lamports-and-sol',
  HASH: 'https://en.wikipedia.org/wiki/Cryptographic_hash_function',
  SIGN: 'https://docs.solana.com/terminology#signature',
  VERIFY_SIGNATURE: 'https://docs.solana.com/developing/runtime-facilities/programs#ed25519-program',
  TRANSACTION_VIEW: 'https://docs.solana.com/developing/programming-model/transactions',
  TRANSACTION_BUILDER: 'https://solana.com/docs/core/transactions',
  INSTRUCTIONS: 'https://solana.com/docs/core/transactions#instructions',
  TRANSACTION: 'https://solana.com/docs/core/transactions#sending-transactions',
  IDL: 'https://solana.com/docs/programs/anchor/idl',
  PROGRAM_INSTRUCTIONS: 'https://solana.com/docs/core/cpi',
  PROGRAM_ACCOUNT: 'https://solana.com/docs/programs/anchor/idl#accounts',
  WALLET: 'https://docs.solana.com/wallet-guide',
  TOKEN_AMOUNT_TO_RAW: 'https://solana.com/docs/tokens/basics',
  RAW_TO_TOKEN_AMOUNT: 'https://solana.com/docs/tokens/basics',
  RENT_EXEMPT: 'https://solana.com/docs/core/accounts#rent',
}

export const NODE_TOOLTIPS: Partial<Record<NodeType, React.ReactNode>> = {
  NETWORK: (
    <div>
      <p>Select the RPC cluster (Devnet, Testnet, Mainnet) and commitment level.</p>
      <p>
        Cluster controls where requests go; commitment (processed/confirmed/finalized) controls how sure a result is.
      </p>
    </div>
  ),
  KEYPAIR: (
    <>
      <p>
        A <span className="font-semibold">keypair</span> is a matching pair of{' '}
        <span className="font-semibold">public key</span> and <span className="font-semibold">secret key</span>.
      </p>
      <p>People participating in the Solana network have at least one keypair. In Solana:</p>
      <ul className="list-disc pl-4">
        <li>
          The <BoldText>public key</BoldText> is used as an “address” that points to an account on the Solana network.
          Even friendly names - like <HighlightedText>example.sol</HighlightedText> - point to addresses like{' '}
          <HighlightedText>dDCQNnDmNbFVi8cQhKAgXhyhXeJ625tvwsunRyRc7c8</HighlightedText>
        </li>
        <li>
          The <BoldText>secret key</BoldText> is used to verify authority over that keypair. If you have the secret key
          for an address, you control the tokens inside that address. For this reason, as the name suggests, you should
          always <BoldText>keep secret keys secret</BoldText>.
        </li>
      </ul>
      <p>Public key can be derived from the secret key, but not the other way around.</p>
      <p>
        Leave the input empty and press <BoldText>Generate</BoldText> for a random keypair, or connect a secret key to
        the input. The input is auto-detected: a base58 secret key/seed, or a 32-byte hex hash used as a seed.
      </p>
    </>
  ),
  PRIVATE_KEY: (
    <>
      <p>
        Input a <BoldText>Private Key</BoldText> (base58 string) to control a specific account.
      </p>
      <p>This node allows you to sign transactions with a specific wallet/account.</p>
      <p className="text-destructive font-bold mt-2">
        WARNING: Never paste your mainnet private keys into untrusted applications.
      </p>
    </>
  ),
  MNEMONIC: (
    <>
      <p>
        A <BoldText>mnemonic</BoldText> (seed phrase) is a human-readable list of BIP39 words that encodes a wallet's
        seed.
      </p>
      <p>
        <BoldText>Generate</BoldText> creates a fresh phrase, or connect a mnemonic to the input. The matching{' '}
        <BoldText>private key</BoldText> is derived along the standard Solana path{' '}
        <HighlightedText>m/44'/501'/0'/0'</HighlightedText>.
      </p>
      <p className="text-destructive font-bold mt-2">
        WARNING: Anyone with the seed phrase controls the wallet. Never paste a mainnet phrase into untrusted apps.
      </p>
    </>
  ),
  PDA: (
    <>
      <p>
        A <BoldText>Program Derived Address</BoldText> (PDA) is an address generated from a program id and developer
        chosen <BoldText>seeds</BoldText>. It's deterministic and has <BoldText>no private key</BoldText>.
      </p>
    </>
  ),
  BALANCE: (
    <>
      <p>
        Fetch SOL balance for a provided <BoldText>public key</BoldText>.
      </p>
      <p>
        Balances are in <BoldText>lamports</BoldText> (1 SOL = 1,000,000,000 lamports).
      </p>
    </>
  ),
  HASH: (
    <>
      <p>A one-way cryptographic function that converts any input into a fixed-size unique "fingerprint".</p>
      <ul className="list-disc pl-4">
        <li>Same input → same result, every time</li>
        <li>Small change in input → a totally different result</li>
        <li>You can verify a result, but you can't "unhash" it</li>
      </ul>
      <p>Where you'll see it in Solana:</p>
      <ul className="list-disc pl-4">
        <li>Every transaction includes a recent blockhash so it's fresh and can't be replayed later.</li>
        <li>
          Program Derived Addresses - the program hashes its seeds with the program id to get a stable, program-owned
          address don't have a private key.
        </li>
      </ul>
    </>
  ),
  NUMBER: <p>Type any number you want!</p>,
  BOOLEAN: <p>Emit a true or false value for testing branches or forcing a condition.</p>,
  ADD: <p>Add two numeric inputs.</p>,
  SUBTRACT: <p>Subtract the second numeric input from the first.</p>,
  MULTIPLY: <p>Multiply two numeric inputs.</p>,
  DIVIDE: <p>Divide the first numeric input by the second.</p>,
  MODULO: <p>Output the remainder after dividing the first numeric input by the second.</p>,
  EXPONENT: <p>Raise the first numeric input to the power of the second.</p>,
  ROUND: <p>Round the numeric input to the nearest integer.</p>,
  MIN: <p>Output the smaller of two numeric inputs.</p>,
  MAX: <p>Output the larger of two numeric inputs.</p>,
  AND: <p>Output true only when both upstream checks are true.</p>,
  OR: <p>Output true when at least one upstream check is true.</p>,
  NOT: <p>Invert a boolean check.</p>,
  EQUAL: <p>Compare two values after stable normalization. Useful for public keys, signatures, hashes, and text.</p>,
  COMPARE: <p>Run a numeric comparison, for example balance greater than a threshold or slot after a known value.</p>,
  HAS_VALUE: (
    <p>Check whether an upstream value is present, such as a transaction signature or fetched account data.</p>
  ),
  IF: <p>Select between two values using a boolean condition. The selected value can feed the next node.</p>,
  SOL_TO_LAMPORTS: (
    <p>
      Convert a SOL amount into <BoldText>lamports</BoldText>. Useful for comparing wallet balances against SOL
      thresholds.
    </p>
  ),
  LAMPORTS_TO_SOL: (
    <p>
      Convert <BoldText>lamports</BoldText> into a human-readable SOL amount.
    </p>
  ),
  VALID_PUBLIC_KEY: (
    <p>Validate and normalize a Solana public key. Outputs both the normalized address and a boolean validity check.</p>
  ),
  ATA: (
    <p>
      Derive an <BoldText>Associated Token Account</BoldText> address from an owner wallet and token mint, for the SPL
      Token or Token-2022 program.
    </p>
  ),
  TOKEN_AMOUNT_TO_RAW: (
    <p>
      Convert a human token amount using mint <BoldText>decimals</BoldText> into the raw integer amount used by token
      instructions and IDL args.
    </p>
  ),
  RAW_TO_TOKEN_AMOUNT: (
    <p>
      Convert a raw token integer amount back into a human-readable amount using mint <BoldText>decimals</BoldText>.
    </p>
  ),
  RENT_EXEMPT: (
    <p>
      Fetch the minimum <BoldText>lamports</BoldText> needed to make an account of a given byte size rent-exempt.
    </p>
  ),
  STRING_ENCODE: <p>Encode text into base64, base58, or hex.</p>,
  STRING_DECODE: <p>Decode base64, base58, or hex back into text.</p>,
  SIGN: (
    <div>
      <p>Sign bytes or transactions with a provided keypair.</p>
      <p>Signatures prove key ownership without revealing the private key; output can be verified downstream.</p>
    </div>
  ),
  VERIFY_SIGNATURE: (
    <div>
      <p>Verify a signature against a message and public key.</p>
      <p>
        Checks that a message was signed by the holder of the corresponding private key and outputs a boolean result.
      </p>
    </div>
  ),
  TRANSACTION_VIEW: (
    <div>
      <p>Inspect a transaction: message, accounts, instructions, and signatures.</p>
      <p>Great for learning account metas, program ids, and instruction composition.</p>
    </div>
  ),
  TRANSACTION_BUILDER: (
    <>
      <p>
        Creates a new, empty <BoldText>Transaction</BoldText> object.
      </p>
      <p>
        Think of this as a shopping cart. You start with an empty cart, then use <BoldText>Instruction</BoldText> nodes
        to add items to it.
      </p>
    </>
  ),
  INSTRUCTIONS: (
    <>
      <p>
        Adds an <BoldText>Instruction</BoldText> to a transaction.
      </p>
      <p>An instruction is a single directive to a program, like "Transfer SOL" or "Create Account".</p>
      <p>
        Connect the transaction from a builder or another instruction node, configure the action, and pass it along.
      </p>
    </>
  ),
  TRANSACTION: (
    <>
      <p>
        The <BoldText>Sender</BoldText> node. Takes a fully built transaction and submits it to the Solana network.
      </p>
      <p>It handles the actual execution. You'll see the status directly on the node.</p>
    </>
  ),
  IDL: (
    <>
      <p>
        Loads a Solana Program's <BoldText>Interface Description Language</BoldText> (IDL).
      </p>
      <p>
        The IDL is like a menu for a program—it tells the editor what instructions (actions) are available and what
        arguments they need.
      </p>
    </>
  ),
  PROGRAM_INSTRUCTIONS: (
    <>
      <p>Interact with custom programs using their IDL.</p>
      <p>
        Once an IDL is connected, this node dynamically generates inputs for any instruction defined in that program.
      </p>
    </>
  ),
  PROGRAM_ACCOUNT: (
    <>
      <p>
        Read and decode an <BoldText>on-chain account</BoldText> using its IDL definition.
      </p>
      <p>
        Connect an IDL, network, and account address. Pick which account type to decode and each field is exposed as a
        separate output.
      </p>
    </>
  ),
  WALLET: (
    <>
      <p>
        Connect a browser wallet (Phantom, Solflare, etc.) and use it to sign transactions instead of pasting a private
        key.
      </p>
      <p>
        Plug the <BoldText>Wallet</BoldText> output into the Transaction node — the wallet will be prompted to sign when
        you press Send.
      </p>
    </>
  ),
  COMMENT: (
    <>
      <p>
        A free-form note for annotating your flow. It has no inputs or outputs and does not affect execution.
      </p>
      <p>Use it to leave context for yourself or anyone you share the flow with.</p>
    </>
  ),
  STRING_COMBINE: (
    <>
      <p>
        Concatenate two or more strings into one. The order matches the order of inputs.
      </p>
    </>
  ),
  STRING_LENGTH: (
    <>
      <p>Returns the number of characters in the input string.</p>
    </>
  ),
  STRING_SUBSTRING: (
    <>
      <p>
        Extract a portion of a string between a <BoldText>start</BoldText> and <BoldText>end</BoldText> index (zero-based).
      </p>
    </>
  ),
  STRING_SPLIT: (
    <>
      <p>
        Break a string into pieces around a separator (e.g. <HighlightedText>,</HighlightedText> or{' '}
        <HighlightedText> </HighlightedText>) and pick one of the resulting parts by index.
      </p>
    </>
  ),
  STRING_SEARCH: (
    <>
      <p>Find the position of a substring inside a string.</p>
      <p>Returns the zero-based index of the first match, or -1 if not found.</p>
    </>
  ),
  STRING_REPLACE: (
    <>
      <p>
        Replace occurrences of a <BoldText>search</BoldText> substring with a <BoldText>replacement</BoldText> in the
        input string.
      </p>
    </>
  ),
  TEXT: <div>Type anything you want!</div>,
  DISPLAY: (
    <>
      <p>
        Render any <BoldText>upstream value</BoldText> for quick inspection.
      </p>
      <p>
        You can double click an <BoldText>output handle</BoldText> to add a <BoldText>display node</BoldText>.
      </p>
      <p>Click on text to copy it to the clipboard.</p>
      <p>Objects, bytes, and transactions are formatted into readable JSON.</p>
    </>
  ),
}

export function getNodeTooltip(type: NodeType): React.ReactNode {
  const content = NODE_TOOLTIPS[type] ?? (
    <div>
      <p>No tooltip yet for this node.</p>
    </div>
  )

  const url = NODE_TOOLTIP_LINKS[type]
  if (!url) return content

  const { color } = getNodeStyles(type)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">{content}</div>
      <div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 underline font-medium"
          style={{ color }}
        >
          Learn more <ArrowUpRight className="size-4" />
        </a>
      </div>
    </div>
  )
}
