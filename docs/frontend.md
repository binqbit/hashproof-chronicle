# Frontend guide

## Run and connect

Use Node.js 22+, initialize `hash-timestamp/`, then run `npm ci` and `npm run dev`.
For a complete local chain and UI, use the [Compose workflow](localnet.md).
`npm run build` produces `dist/`; `npm run preview` serves that build. Static
hosting must rewrite application routes to `index.html`.

The network selector offers localnet, devnet and testnet. Localnet is the default.
The program address comes from the synchronized IDL; it is not maintained in a
second frontend constant. The availability indicator checks for an executable
program, not the deployed binary's version. Deploy the matching contract before
using a network. Public RPCs can be unavailable or rate-limited.

Optional `.env.local` values, or Compose build arguments:

| Variable              | Meaning                                                         |
| --------------------- | --------------------------------------------------------------- |
| `VITE_SOLANA_NETWORK` | Initial built-in network; defaults to `localnet`                |
| `VITE_SOLANA_RPC_URL` | HTTP(S) endpoint; overrides the initial network with Custom RPC |

Vite embeds these values in public JavaScript. Never put private keys or secret
RPC credentials there. Rebuild after changes. RPC URLs must be reachable from the
browser; an HTTPS-hosted UI generally needs an HTTPS RPC. A phone's `127.0.0.1`
refers to that phone, not your development machine. The local Compose setup binds
only to host loopback and is intended for use on that host.

Wallet Adapter remembers the selected wallet in this browser's `walletName`
localStorage entry and attempts reconnection on reload when that wallet is
available. The wallet still controls authorization and may ask for approval.
**Disconnect wallet** disconnects and forgets the selection, so reloading does
not reconnect until you choose a wallet again. No private keys, signatures or
transaction approvals are persisted by the app. Proof history is not persisted.
The wallet approves each transaction; fund it on the selected network first.
Wallet controls, network changes and duplicate submissions
are blocked while a transaction is pending. A confirmation timeout is ambiguous:
check the wallet/explorer before retrying. Read failures are not shown as absent
records.

## Screens and identifiers

Inspect is the first screen and opens by default, including from the home link.
Creation and history operations follow it. **Docs & guides**, above the operation
tabs, opens `/docs/getting-started`. Documentation has a left-hand topic menu on
desktop and a topic dropdown on mobile, with one article shown at a time. Topics
have their own `/docs/:section` links and support reload and browser back/forward.
The guide covers a quick start, use cases, identifiers, Branch, Restore, proof files,
votes, wallet behavior and developer resources. Unknown topic links show a
not-found message with a link back to Getting started.
The UI retains the original dark, purple/cyan theme and background artwork across
the updated operation tabs, help and wallet controls. Shared colors live in
`src/styles/theme.css`; help layout styles stay within `src/features/guide/`.
Returning via **Back to workspace** preserves the open form, selected record,
retained history and workspace scroll position. This is same-session UI state,
not persistence across reload: proof history must still be downloaded. The
workspace is kept mounted with its last route while Docs is visible; a direct
visit to Docs does not initialize the workspace or need a wallet/RPC connection.
Navigation to Docs is disabled while a workspace transaction is pending.

File pickers, checkboxes and network/operation dropdowns share the dark theme and
remain keyboard-operable. The Branch checkbox withdraws your parent vote; it does
not unconditionally delete the parent. The root reserves scrollbar space, and
Radix's additional scrollbar compensation is suppressed only while it owns the
scroll lock, keeping page width stable for wallet, select and confirmation popups.
Switching networks with retained history and clearing that history require a
themed confirmation dialog. Cancel is focused by default and returns focus to the
initiating control without changing the current network or history.

| Screen       | Input and behavior                                                                                                                                                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inspect      | Look up a **canonical ID or record PDA**, read source/timestamp/votes, navigate to a parent or batch member, export history, or send vote/withdraw/fee-paying `verify` instructions.                                                    |
| Timestamp    | Hash a file incrementally in the browser, or paste a raw 32-byte value. Preview its Hash-source canonical ID and PDA; register it with a first vote, or inspect it without signing.                                                     |
| Branch       | Provide a parent ID or PDA and choose a new file version, or paste its 32-byte digest. Check the live parent and preview the child ID/PDA without signing. Optional parent-vote withdrawal requires your vote and can close the parent. |
| Batch / Pack | Mix ordered IDs and PDAs of live records; check members and preview the result without signing. Aliases of the same record are duplicates. Batch stores IDs; Pack stores a digest, so retain its proof.                                 |
| Account      | Commit the current metadata and data of a Solana account. Save the captured snapshot for historical proof use.                                                                                                                          |
| Restore      | Import proof JSON, load retained history, then check commitments, dependencies, live state and transaction size before submitting proof-only validation or account recreation.                                                          |
| Proofs       | Select several JSON archives or legacy proof files, merge matching nodes locally, review missing history, and download one SDK archive. No wallet or RPC required. |

A raw file hash, a canonical record ID and a Solana PDA are different values.
Operation buttons require their mandatory inputs; empty or whitespace-only
fields do not enable checks or submissions. Batch / Pack also treats a list of
only commas/whitespace as empty. Clearing an input disables its actions again.
Form handlers enforce the same conditions, including submission through Enter.
These presence checks do not replace format validation or assert on-chain
availability.

Timestamp and Branch share incremental, local SHA-256 hashing with progress and
cancellation. File contents are not uploaded. While hashing, dependent actions
are disabled; switching operation tabs cancels the hash job. Opening Docs keeps
the workspace and its hash job mounted. Manually editing the digest
clears the filename association. Branch creates a linked child, not an in-place
replacement of its parent; parent-vote withdrawal is off by default.

Displayed/exported hashes and canonical IDs use lowercase hex; public keys and
PDAs use Base58. Hash inputs accept 64 hexadecimal characters (no `0x`, either
case) or Base58, decoding to exactly 32 bytes. In record lookups bare hex means
a canonical ID; bare Base58 checks both the ID and PDA interpretations. If both
identify live records, specify `id:<value>` or `pda:<value>` instead. These prefixes
accept either encoding, including hex PDAs. A missing Base58 ID needs `id:`.
A PDA lookup checks
program ownership, account type and the SDK-derived address before recovering
its ID. A closed PDA cannot reveal its former ID: use retained history instead.
Branch and aggregate inputs and their read-only checks work without a wallet;
withdrawal checks and all transactions require a connected wallet. Creation
checks reject already occupied result records and repeat before submission.
The UI limits an aggregate to 32 members; this does not guarantee it fits a transaction.
All protocol identities are computed by the SDK. `/records/:id` opens a canonical
record; old `/hash/:hash` links are interpreted as raw Hash-source digests on the
currently selected network. Links do not select a network automatically.

Registration and derived-record creation fund the first vote and account rent.
Votes are on-chain claims, not authorship certificates. Removing the final vote
closes the record; the UI requires acknowledgement before withdrawal. A later
registration at the same identity can have a different historical timestamp.

## Retain and restore history

History is held only in page memory. Download proof JSON from a record or the last
confirmed receipt before closing the page, switching networks, or removing votes.
Do not rely on this frontend as a backup service. Clearing retained history only
clears that memory; it does not remove saved files or change on-chain accounts.

Collection follows live ancestors or imported historical entries. It validates
derived commitments with SDK helpers and stops if history is unavailable. A Pack
cannot reveal its missing member list. An account's present state cannot replace
a changed historical snapshot. Large or incomplete histories may need to be
assembled with the [Proofs tab](#merge-proof-files) or the SDK.

Confirmed transaction receipts survive auxiliary proof-collection failures. When
possible, a partial history export retains captured parent/member fingerprints;
the warning identifies it as incomplete. **A partial export is not a complete
restore proof.** If the new record cannot be read, it may contain only predecessor
entries and lacks the new anchor's timestamp. Complete the history before use.

Proof exports contain `format: "hash-timestamp-proof-v1"`, program/RPC metadata,
and a `proof` array. Imports accept this envelope or a normalized SDK-shaped
array. Fixed32 hashes accept byte arrays, hex or Base58; arbitrary payload/data
strings remain hex-only (including Restore Hash `params.payload`). Public keys
accept Base58, hex or byte arrays. Use decimal strings for large `i64`/`u64` values. Fingerprint
`sourceKind` is numeric (`0` Hash, `1` Account, `2` Branch, `3` Batch, `4` Pack).
Exported network metadata must match the selected endpoint; plain arrays have no
network guard, so verify their origin yourself. Equivalent RPC aliases can be
used by reviewing the JSON and explicitly selecting/importing the intended array.

The live anchor must be entry zero. Remaining entries need not be topologically
ordered: the SDK and contract resolve their identities. See the
[contract instruction reference](../hash-timestamp/docs/instructions.md#restore) for proof
rules. **Check format & load history** only parses and retains entries; it also
accepts partial history for later proof collection. **Check proof & live state**
then checks source/parameter agreement, duplicate IDs, connected dependencies,
fingerprints, generations, hash commitments, the live anchor and requested
historical incarnations. It also encodes the unsigned transaction to check the
1232-byte limit, without broadcasting or asking for a signature.

Account snapshots use the SDK's RPC-shaped numeric helper only when their u64
values round-trip exactly; otherwise a warning leaves that snapshot digest for
on-chain validation instead of silently rounding. Snapshot-free account links
are accepted only when the matching live record is actually supplied to restore.

Submission requires a successful preflight for the current inputs, mode, network
and wallet, and repeats it immediately before sending. Editing any of these
invalidates the preview. Preflight is not a simulation or proof of transaction
success: RPC state may change, and rent, fees and runtime conditions still apply.
Selecting a replacement Restore file clears the previous JSON and preflight
immediately. Format loading stays disabled during the file read, and failed
imports cannot reuse an earlier proof. Manual edits supersede pending file reads.

Proof-only mode is the default and still pays transaction fees. Materialization
requests every non-anchor entry with parameters; this UI does not select an
arbitrary subset. Existing records must match the proven incarnation. Returned
IDs are requested records, not necessarily newly created records. Conflicting
incarnations on unrequested non-anchor accounts do not invalidate proof-only
history, but block recreation of those occupied records. Conflicting proof
incarnations cannot be merged in one in-memory history; save them separately and
clear the retained history before importing an alternative chain.

The collector limits traversal to 32 records. JSON imports allow at most 64
entries and 2 MB. These are browser limits, **not transaction-size guarantees**.
The SDK submits a single transaction; large chains/snapshots can exceed Solana
limits. No automatic splitting or fabricated history is performed.

## Merge proof files

Open **Proofs**, select two or more JSON files, and click **Merge files**. Further
selections append files to the list; individual files can be removed. Download
the result with **Download merged JSON**. Changing the selection invalidates the
previous result. Clearing the selection cancels an active merge. Switching
operation tabs or opening Docs preserves the selection/result; reloading or
switching networks clears them. Source files are never modified.

The tab accepts SDK `hash-timestamp-archive` v1 files, legacy
`hash-timestamp-proof-v1` exports, and SDK-shaped proof arrays. Legacy exports
retain their program ID during conversion; plain arrays use the app's configured
program ID. Their RPC metadata is intentionally not carried into the archive.
Legacy files must individually contain all nodes referenced by supplied
fingerprints; incomplete legacy exports that cannot be converted are rejected
with the filename, not silently stripped of their proof data.

SDK validation owns merging: identical historical nodes deduplicate, missing
witnesses may be enriched, and member order is preserved. Different program IDs,
conflicting timestamps/incarnations or witnesses, malformed JSON and invalid
commitments reject the entire merge. No conflicting record is overwritten and
no partial-success download is offered. Partial SDK archives are allowed: the UI
reports missing references/witnesses, and the output can be merged with more
history later. Local checks do not verify live anchors or on-chain existence.

Browser limits are 32 files, 16 MiB per file and 32 MiB of inputs total, checked
before reading. Legacy inputs also retain the 2 MB / 64-entry parser limit.
The SDK enforces a 16 MiB / 10,000-node output limit. Files stay in browser memory;
merging needs no wallet, RPC calls or transaction. The workspace's normal network
status check is independent of this local operation.

The downloaded `hash-timestamp-archive.json` uses the
[SDK archive format](../hash-timestamp/docs/archive.md), including lowercase hex
hashes and Base58 public keys/PDAs, without filenames or network metadata. It is
not a ready-to-submit proof chain. Use the SDK archive planner for restoration;
the **Restore** tab still imports the legacy proof format. Verify the original
network before performing any on-chain operation.

## SDK and IDL synchronization

The source of truth is the initialized, explicitly chosen `hash-timestamp/`
checkout. Sync never fetches a branch, changes a Git pin or writes into it.

```sh
npm run sync:sdk       # Copy SDK, apply the documented compatibility guard
npm run sync:idl       # Reviewed IDL baseline + Anchor-compatible TS type/value
npm run sync:contract  # Both
npm run check:contract # Read-only drift, version and program identity checks
```

The default IDL source is `hash-timestamp/tests/fixtures/idl.json`, the contract's
reviewed compatibility baseline. Syncing is not a Rust build. To use IDL from a
fresh artifact export, first build/export the current contract, then run:

```sh
sh scripts/build-contract.sh
npm run sync:idl -- --idl accounts/build/idl.json
```

An explicit IDL must match the reviewed contract baseline semantically (docs are
ignored), the program version and Anchor.toml addresses. Types use the pinned
Anchor converter, not hand-maintained account layouts. `dev`, `build` and `test`
reject drift. After changing contract versions, review the SDK compatibility
boundary and package versions, then sync, test and build.

## Architecture

| Boundary                        | Responsibility                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/generated/hash-timestamp/` | Managed SDK copy, IDL and generated types; no manual edits                               |
| `src/contract/`                 | SDK entry, verified ID/PDA resolution, provider/network setup, browser SHA-256 adapter   |
| `src/features/records/`         | Record forms, reads and user confirmations                                               |
| `src/features/guide/`           | In-app user documentation and practical workflows                                        |
| `src/features/history/`         | Portable JSON/file merging, proof-graph preflight, live restore checks, collection and history screens |
| `src/features/workspace/`       | Screen orchestration, transaction lock/receipts and application operations               |

The SDK owns hashes, PDAs, account decoding, instruction construction and restore
encoding. Application operations retain the same parent/member snapshots used by
the SDK to build instructions and collect exportable history. UI components do
not reimplement protocol formulas or make fake wallet providers for reads.

Creation receipts also retain the SDK's one-node `archive`; register/branch now
return `{ signature, archive }`. The SDK's versioned node graph and automatic
restore planner are documented in the [archive guide](../hash-timestamp/docs/archive.md).
Record/receipt proof exports and Restore import use the separate legacy proof
format. The Proofs tab accepts those exports and SDK archives and writes SDK
archives; it does not change the Restore input format. A confirmed `ArchiveCaptureError` keeps
the transaction receipt visible with a warning; uncertain submissions retain the
signature in the error and must be checked before retrying.

Browser adaptation is deliberately narrow: Buffer support, a synchronous
SHA-256 `crypto` adapter, and a generated missing-`rentEpoch` guard required by
modern web3.js types. The guard rejects incomplete snapshots; it does not invent
a rent epoch or change the commitment formula. These changes are reproducible
through the sync script and tested against independent Node hash vectors.

## Tests

```sh
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` checks drift, test types, infrastructure/sync scripts and unit tests.
Unit tests exercise the browser hashing boundary, verified ID/PDA resolution,
proof graphs and restore preflight, historical collection, stale-preview rejection,
wallet controls/transaction gates, and real SDK/Anchor instruction assembly.
Browser tests use the production build with controlled RPC responses; they cover
desktop/mobile hashing, PDA lookup, creation previews, restore validation,
export/import and error states. A controlled wallet stub also checks remembered
selection, reload and disconnect without public network access, real extension
wallets or signing. Build before running them.
On NixOS, `PLAYWRIGHT_CHROMIUM_EXECUTABLE` may point to a working Chromium binary
if the Playwright download cannot run on the host.

To exercise actual transactions against the current program on an isolated local
validator with an enabled faucet:

```sh
SOLANA_TEST_RPC_URL=http://127.0.0.1:8899 npm run test:localnet
```

This test rejects non-loopback RPCs, uses fresh ephemeral wallets and local SOL,
and leaves test records in that local ledger. It covers registration, votes,
branch closure, proof-only/materializing restore, pack, batch and account
snapshots. It does not test a real browser wallet extension or public deployment.
