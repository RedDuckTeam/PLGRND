# Test fixtures

Offline data for the transaction importer and the IDL layer. Tests never hit the network.

- `tx/*.json`: one transaction each, written by `scripts/capture-fixture.mjs`.
- `accounts/<address>.b64`: raw on-chain bytes (base64) of the IDL accounts that the fixtures reference. Shared between fixtures.
- `idl/all-types.*.json`: self-authored IDLs, one per format.
- `fixtures.test.ts`: checks the shape and size of all of the above.

## Capturing

```sh
node apps/web/scripts/capture-fixture.mjs <signature|base64|base58> --cluster mainnet|devnet [--name <name>]
```

`RPC_URL` overrides the public endpoint. Requests run one at a time, at least 300 ms apart, and back off on 429 / 5xx.

- **Signature input**: raw `getTransaction` (`encoding: base64`, `maxSupportedTransactionVersion: 0`, `commitment: confirmed`) → `meta`.
- **Serialized input** (base64 or base58, possibly unsigned): `simulateTransaction` (`sigVerify: false`, `replaceRecentBlockhash: true`, `innerInstructions: true`) → `simulation`. If the RPC rejects the transaction, the result is stored as `simulation.rpcError`.

Fixture fields:

| Field                             | Content                                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `name`, `network`                 | file name, `mainnet` / `devnet`                                                                                              |
| `input`                           | `{ kind: 'signature' \| 'serialized', value, encoding? }`. `value` is the exact input string                                 |
| `version`                         | `'legacy'` or `0`                                                                                                            |
| `slot`, `blockTime`, `capturedAt` | capture context                                                                                                              |
| `wire`                            | base64 of the original message bytes (sliced from the wire, not re-serialized)                                               |
| `signatures`                      | base58. All `1`s for an empty signature slot                                                                                 |
| `meta` \| `simulation`            | RPC result, unmodified. A simulation also has `loadedAddresses`                                                              |
| `altAccounts`                     | `{ [lookupTable]: string[] }`: the full table at capture time (indices are stable)                                           |
| `programs`                        | every program that ran: top-level, inner and from `Program … invoke [n]` log lines                                           |
| `accounts`                        | `{ [address]: '<address>.b64' }`: existing IDL accounts of `programs`                                                        |
| `accountMeta`                     | `{ [address]: { program, kind, owner, lamports, size } }`, where `kind` is `pmp-canonical`, `pmp-foundation` or `anchor-idl` |
| `skippedAccounts`, `notes`        | present only when something was skipped or looked off                                                                        |

The script checks three IDL locations for each program in one `getMultipleAccounts` call:

- PMP canonical `[program, "idl"]`
- PMP under the Solana Foundation authority `[program, fndnu15P…, "idl"]` (Program Metadata program `ProgM6JC…`, seed zero-padded to 16 bytes)
- the Anchor IDL account `createWithSeed(findProgramAddress([], program), "anchor:idl", program)`

An address with nothing on it is left out of `accounts`. A resolver mock therefore returns `null` for any derived address that is not listed.

Limits:

- A `.b64` file can be at most 280 kB. Larger accounts are listed in `skippedAccounts`. None hit this limit: the largest is the Token-2022 Foundation PMP, at 34 kB raw.
- A fixture file can be at most 300 kB.
- A shared `.b64` file is never overwritten with different bytes. On a mismatch the script writes `<address>.<sha8>.b64` and adds a note.

`scripts/build-local-tx.mjs <name>` prints deterministic, locally built transactions (keys derived from `sha256("plgrnd-fixture:<label>")`).

## Transaction corpus

Licence decision for every row: **public on-chain data**, committed. A row is either a mainnet/devnet transaction and the raw accounts it references, or a locally built transaction made from public program interfaces.

| File                           | Source                                                                                                                   | Exercises                                                                                                                                                                                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `jupiter-swap.json`            | mainnet `2abZAN1BS4nHQnjHCq928rVQcvfpSYVYzfYphjKwyPABzFh3XoWU1nwZvQoHtUwEdR8ougDQoHxLn5dft1FYgjg8`                       | v0 + 3 ALTs, Jupiter v6 route, deep CPIs, Anchor IDL accounts (Jupiter, `DF1ow4…`), Foundation PMP (System, Token, Compute Budget), programs with no IDL                                                                                                                                                                 |
| `raydium-clmm-swap.json`       | mainnet `3CzxrSuAWrq8fy5MdkoA3NL9kNAhkvfWEfzki4GiWJM7HTpq9y2hLBCUEu95j6AB6EP6iKEfBsroT8hhqJZmFFXU`                       | top-level CLMM `swap_v2`, canonical PMP (format byte 0, Anchor v01 JSON), Token + Token-2022 CPIs, v0 + 1 ALT                                                                                                                                                                                                            |
| `whirlpool-swap.json`          | mainnet `29LXMkfgidgxPhhjFjqeS9F4Rjyzjtc1imEpsMP7ng4bp7JzCuuHQwN7FNCdy1KFk5a1Bar8em4DT8eDsb39kXfu`                       | top-level Whirlpool `swap`, legacy message, Anchor IDL account **and** canonical PMP both present (precedence)                                                                                                                                                                                                           |
| `pumpfun-buy.json`             | mainnet `x4soTzcjdAgMw52yrVMWZVRCR6RSBTiNZX2p4c2bFpidmBbYgBsbpjVZ2Tw79XXWbHScUdaeoTheACzE4Fn4ChY`                        | Pump.fun `buy_exact_sol_in` (same accounts as `buy`), 18 metas against 16 in the IDL (remaining accounts), Anchor v01 with PDA seeds, ATA `create_idempotent`, fee program `pfeeUx…` CPI with its own Anchor IDL                                                                                                         |
| `token-metadata.json`          | **devnet** `4J1n4DWgJL7p8t2VqAnLtDmDAN558iVgwwBRULpkGADoZCMqyyc5NyrAUtVi4qQmcLDhWFUGjFxD5am9PFmNUcof`                    | `CreateMetadataAccountV3` with **6 of 7** accounts (optional `rent` omitted, `legacyOptionalAccountsStrategy`), plus create mint, ATA `create` with **empty data**, `MintTo`, `SetAuthority`. Token Metadata has no on-chain IDL (see below). Devnet's ATA Anchor-IDL address holds a system-owned empty account (decoy) |
| `pmp-write.json`               | mainnet `4ZZRomQhLmXXLGcPk5YojPsvYJ2wQuwhgaXdFtmP463oLaRne4Z1d9iMw3nPsNK5UKiDMj88pR4E2EAXBj1jA2V2`                       | PMP `write` + `initialize` in one transaction, PMP's own canonical PMP (Codama root)                                                                                                                                                                                                                                     |
| `memo-v1.json`                 | mainnet `5oefwRS6naSzx1nsv44bV4fWWye8vPs1WNdZeVzMSrU2jhP3Dk6yV4AqLdw7bSM972HqG7fbVfNmrGERq4BQ2E8E`                       | Memo v1 (`Memo1Uhk…`), no IDL anywhere, no discriminator                                                                                                                                                                                                                                                                 |
| `memo-v2.json`                 | mainnet `5MbKBh4ri5RycZQoydhQPhg5foymfwA3WCiW1Vwzjtzd5zpeE4aw6xskB4LpRjK78FkUh1MUEf2VNMZgriWwRJRu`                       | System transfer + Memo v2, Foundation PMP for Memo; the Memo Anchor-IDL address holds a system-owned empty account (decoy)                                                                                                                                                                                               |
| `token2022-transfer-fee.json`  | mainnet `2dZgrJBXZKmkj81bvDQFYo5wzQEg2r69iATFKCzWiqAG9ab2JbCjRK9DBdfiKcvfxucfjLGpQxTk3Ro4fuWVoujV`                       | Token-2022 `TransferChecked` on BERN (`CKfats…`, TransferFeeConfig 2.69 %), ATA `create_idempotent`, Foundation PMP for Token-2022                                                                                                                                                                                       |
| `failed-tx.json`               | mainnet `5CrFnwz1uw4ktwBzWAaNzFN7QAQdYvKaqVg6JvJz6Wbt5bj7zyu5UnEMb3ZCFR997kf2HfymA2SNnpg3f1TDbs8a`                       | `meta.err = InstructionError[4, Custom 6001]` (Jupiter `SlippageToleranceExceeded`), v0 + 4 ALTs, partial inner trace                                                                                                                                                                                                    |
| `spl-transfer-ata-create.json` | mainnet `kKF8pJTt2NHhGCGrHaaadXHN6vTYD6T14nxAxbLsLRMibHKyrKZ7dEbhW2yD6hQBPi9JcMN1wwnjMVGDm1pDZMx`                        | ATA `create` with **empty data** (7 accounts, incl. rent sysvar), 2× SPL `TransferChecked`, `CloseAccount`                                                                                                                                                                                                               |
| `jupiter-unsigned.json`        | `lite-api.jup.ag/swap/v1/quote` + `/swap`, 0.01 SOL → USDC, `userPublicKey Hasda78TSaT9bjiPxDBvP4GpohFpP3TDTaJEcCYK5kyN` | serialized unsigned v0 + ALT (zero signature), successful simulation (`replacementBlockhash`, parsed inner instructions), AC-IN-5                                                                                                                                                                                        |
| `partially-signed.json`        | `capture-fixture.mjs "$(node apps/web/scripts/build-local-tx.mjs partially-signed)" --name partially-signed`             | `createAccount` + `InitializeMint`: mint keypair signed, fee payer slot empty; simulation `AccountNotFound` (unfunded payer), AC-IN-6                                                                                                                                                                                    |
| `legacy-anchor.json`           | mainnet `DkeeJiRbNHwK5ADfz26zVPgvU59X38BN3WqzFsUj4QSvyXHsaaDyUzpauumYHTFuQ9BYsapGKrHfbMPR3qMS6Rx`                        | Marinade `liquidUnstake`: pre-0.30 Anchor IDL account (`isMut`/`isSigner`, camelCase name; discriminator = `sha256("global:liquid_unstake")`)                                                                                                                                                                            |

Programs in the corpus with no IDL at any of the three locations: Memo v1, Token Metadata, `BiSoNHV…`, `TessVdM…`, `EcKNBR…`, `9VFiim…`, `ECziet…`, `ZERor4…`, `3TK9D8…` (Kipseli).

## Self-authored IDLs (`idl/`)

These were written for this repo from the format specs and are MIT, like the repo. They describe made-up programs, not deployed ones. Each was checked by converting it with `@codama/nodes-from-anchor` 1.5.6 (Codama root used as is), encoding one sample per instruction with `@codama/dynamic-codecs` 1.3.0, and identifying and parsing it back with `@codama/dynamic-parsers` 1.4.2.

| File                           | Program address                                | Markers                                                           | Covers                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `all-types.codama.json`        | `72rskj7regeaUYpx6bm9qZAktTLjPVMDdvPWdzuiwEgE` | `kind: rootNode`, `standard: codama`                              | u8–u128, i8–i128, f32/f64, bool, u32-prefixed string/bytes, **u8- and u16-prefixed strings**, fixed-size string, pubkey, fixed array, vec, option, **COption** (u32 prefix, fixed), option<vec<struct>>, tuple type, scalar + data enums (struct and tuple variants), account with a field discriminator, PDA, **constant 4-byte discriminator** (`c0ffee01`) |
| `all-types.anchor-v01.json`    | `HsRnuVDtp1mgUH1HPvgUch7wTSFez8xjus9y5sETQX4F` | `metadata.spec: "0.1.0"`, `address`                               | every scalar incl. u128/i128, string, bytes, pubkey, nested fixed arrays (`[[u8;2];2]`, which Codama turns into bytes), vec, option, option<vec<struct>>, tuple struct, scalar + data enums, PDA seeds (const / account / **nested path** `state.authority`), optional account, fixed address, 1-byte custom discriminator (`ping`), account, event, error    |
| `all-types.anchor-legacy.json` | `79jDEA2BdHou4dcWuXAVEbnw9eSU7S1Li3PcuzU547Va` | `metadata.address`, `isMut`/`isSigner`, no `spec`                 | the same scalars, `publicKey`, fixed array, vec, option, option<vec<struct>>, scalar + data enums (tuple variant), `isOptional`, **composite accounts group**, multi-word names `setAuthority` / `closeStateAccount` (snake_case discriminators)                                                                                                              |
| `all-types.shank.json`         | `HmUS9QssqLrBF3uyZY76Dzx2EeC5ZRXTFmjN2YM8tFRV` | `metadata.origin: "shank"`, `discriminant: { type: "u8", value }` | all scalars in a single `defined` args struct (Codama's default visitor flattens it), **COption**, tuple, hashMap, option<vec<struct>>, enums, non-sequential discriminant (7), `isOptionalSigner`, `legacyOptionalAccountsStrategy`                                                                                                                          |

## Third-party IDLs: not committed

| Program                         | Source                                                                                                                                                                                                 | sha256                                                             | Licence                              | Decision                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------ | ---------------------------------------------------------------------------- |
| Metaplex Token Metadata (Shank) | `https://raw.githubusercontent.com/metaplex-foundation/mpl-token-metadata/7c95f9948d7fed8db9947188b8040f0d560ac2d3/idls/token_metadata.json` (last commit to the file, 2024-10-23; 178 015 B; v1.14.0) | `58f1a1397a1e4f6c671d2a3bf8f6e9465eedd8abb0025c943d42030180ff411f` | Metaplex NFT Open Source License 1.0 | download into gitignored `__fixtures__/.cache/`; tests `skipIf` it is absent |

Native Codama IDLs (System, Token, Token-2022, ATA, Compute Budget, Memo) are on chain as Foundation PMP accounts, so their raw bytes are already in `accounts/`. The GitHub copies under `solana-program/*` are Apache-2.0; vendoring them needs a NOTICE entry, which belongs to a later step.

## Gaps and surprises

- **Pump.fun `buy`**: none in about 150 recent successful v0/legacy transactions. Direct traffic is `buy_exact_sol_in`, `buy_v2`, `buy_exact_quote_in_v2`, `sell*` and discriminators that are not in the on-chain IDL. The fixture uses `buy_exact_sol_in`.
- **Token Metadata**: on mainnet, top-level traffic is almost all `Transfer`/`Unlock` with every account present (`programId` placeholders). The omitted-optional-account case was taken from devnet.
- **v1 transactions**: mainnet now carries transactions with message version 1. `getTransaction` with `maxSupportedTransactionVersion: 0` fails on them (`-32015`), and web3.js 1.98 cannot deserialize them. The capture script and corpus are v0/legacy only.
- **Devnet** has the Foundation PMP accounts for System, Token and ATA, byte-identical to mainnet.
- **Legacy Anchor**: the IDL accounts of Marinade, Drift, Mango v4, Squads v3, Candy Machine v3, Kamino Lending, OpenBook v2 and Meteora DAMM v1 are all pre-0.30. Marginfi and Meteora DLMM are v0.1.0.
