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
**Disconnect** in the Wallet menu disconnects and forgets the selection, so
reloading does not reconnect until you choose a wallet again. No private keys,
signatures or transaction approvals are persisted by the app. Proof history is not persisted.
The wallet approves each transaction; fund it on the selected network first.
Wallet controls, network changes and duplicate submissions
are blocked while a transaction is pending. A confirmation timeout is ambiguous:
check the wallet/explorer before retrying. Read failures are not shown as absent
records.

## Screens and identifiers

The workspace has two navigation levels: choose a section, then one of its tools.

| Section | Tools                                   |
| ------- | --------------------------------------- |
| Verify  | Inspect, Proof check                    |
| Create  | Timestamp, Branch, Batch / Pack, Account |
| History | Merge proofs, Proof inspector, Restore  |

**Verify → Inspect** opens by default, including record links and the home link.
Selecting a different section opens its first tool; clicking the current section
keeps its selected tool. Inspect actions from other tools also select Verify.
Both navigation levels are disabled while a transaction is pending. Changing
tools, within or between sections, keeps the existing form reset/cancellation
behavior; Merge proofs keeps its file selection and merged result across these changes.
The group definitions and tool type live in `src/features/workspace/navigation.ts`;
`WorkspaceNavigation.tsx` handles presentation, while `Workspace.tsx` owns the
active tool and operation state. Navigation does not call the contract.

**Docs & guides**, in the top header alongside the brand and connection controls,
opens `/docs/getting-started`. On small screens the button reads **Docs**, with
network and wallet controls on a separate header row.
Documentation has a left-hand topic menu on desktop and a topic dropdown on
mobile, with one article shown at a time. Topics
have their own `/docs/:section` links and support reload and browser back/forward.
The guide covers a quick start, use cases, identifiers, Branch, Restore, proof files,
votes, wallet behavior and developer resources. Unknown topic links show a
not-found message with a link back to Getting started.
In-app articles explain user actions and outcomes, with short steps and clearly
marked cautions rather than SDK internals or JSON schemas. Developer resources
contains a labeled GitHub link to the original smart contract and SDK. Technical
integration details remain in this guide and the contract documentation.
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
| Batch / Pack | Import proof files and select/reorder members, or enter IDs and PDAs manually. Check live records before creating the group. Batch stores IDs; Pack needs retained history. |
| Account      | Commit the current metadata and data of a Solana account. Save the captured snapshot for historical proof use.                                                                                                                          |
| Restore      | Open an original or combined proof file, select records in the shared graph viewer, check live anchors and required paths, then restore the explicitly selected records. |
| Merge proofs | Select several JSON archives or legacy proof files, merge matching nodes locally, review missing history, and download one SDK archive. No wallet or RPC required. |
| Proof inspector | Draw one original or combined proof as a graph of connected records and independent histories. Hover/focus circles for IDs and timestamps; click/tap for full details. Pan, zoom and search locally; no wallet, RPC or transaction required. |
| Proof check  | Choose proof JSON and a resource file, find saved file timestamps across versions/groups, then optionally check a matching live record or complete historical path. No wallet or transaction required. |

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

Batch / Pack opens in **Proof files** mode. Choose one or more proof exports or
SDK archives together: all imported records are selected by default, including
older linked records. Uncheck unwanted members and reorder the rest with the arrow
buttons. Deselected records are still retained as history. If more than 32 records
are selected, checking and creation are disabled until the selection is reduced;
no records are silently excluded. **Clear selection** deselects everything.
Choosing files again replaces the selection and invalidates its preview;
failed or superseded reads cannot reuse the old members. Import is local and uses
the same file/count limits as Merge proofs. Large record lists are paginated; the order
preview shows up to 32 selected records and reordering is disabled above that limit.
Legacy exports must match the selected program/RPC; archives and plain arrays do
not identify a network, so choose their original network yourself. Selected file
records must match current timestamps and sources, checked both in the preview
and the snapshot used to build the transaction. Imported Account snapshots and
available Pack/member fingerprints are retained for proof collection; incomplete
history is flagged and may produce a partial proof. Keep the source files.
**Enter IDs manually** remains available and performs the existing live checks.
Switching input modes or operation tabs clears the imported selection.

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
assembled with [Merge proofs](#merge-proof-files) or the SDK.

Confirmed transaction receipts survive auxiliary proof-collection failures. When
possible, a partial history export retains captured parent/member fingerprints;
the warning identifies it as incomplete. **A partial export is not a complete
restore proof.** If the new record cannot be read, it may contain only predecessor
entries and lacks the new anchor's timestamp. Complete the history before use.

Retained-history exports use `format: "hash-timestamp-proof-v1"`, program/RPC metadata,
and a `proof` array. Archive Restore receipts download the SDK archive instead.
File imports accept SDK archives, the legacy envelope or a normalized SDK-shaped
array. Fixed32 hashes accept byte arrays, hex or Base58; arbitrary payload/data
strings remain hex-only (including Restore Hash `params.payload`). Public keys
accept Base58, hex or byte arrays. Use decimal strings for large `i64`/`u64` values. Fingerprint
`sourceKind` is numeric (`0` Hash, `1` Account, `2` Branch, `3` Batch, `4` Pack).
Exported network metadata must match the selected endpoint; plain arrays have no
network guard, so verify their origin yourself. Equivalent RPC aliases can be
used by reviewing the JSON and explicitly selecting/importing the intended array.

### Graphical Restore

Restore accepts files only; there is no JSON text editor. Import uses the same
archive reader as Merge proofs, including legacy program/RPC checks. Opening a
file parses its history locally and displays the shared proof graph, then checks
saved addresses on the selected network without signing. A conflict with session history shows a warning
but does not prevent working with an otherwise valid imported archive.

Hover a circle for an interactive preview or click/tap for full details, then
tick **Restore this record**. Selected circles have a pink outline and check
badge. Existing records, conflicting occupied addresses and missing-reference
placeholders cannot be selected. Refreshed live status removes newly existing
records from the selection. One shortest verified path per selected record is
bright immediately, independently of transaction planning. Shortest means fewest
edges from a complete, matching live anchor. Equal-length alternatives are resolved
deterministically by sorted anchor addresses and stored member order; only one
route per target is highlighted, with shared edges shown once. Incomplete dependencies
do not establish a trusted path. **Check selected
records — no fee** invokes the SDK archive planner without signing: it finds
historically matching live anchors, verifies the needed dependency closure and
checks unsigned transaction size. An occupied PDA with different history is not
a valid anchor. The independent live scan marks matching records green even
when the full proof is incomplete or too large for a transaction. It uses the
SDK planner's owner, discriminator, PDA/bump, voters and historical-state checks;
failed reads remain unknown, not missing. **Refresh live records** repeats this
scan and invalidates the route plan. After planning, each step highlights only
the shortest routes from its chosen anchor to its targets, within that step's
proof. A target shared by several steps is shown through the first step that
covers it, without adding duplicate routes for later revalidation. The planner
ranks feasible anchors by coverage, required creations and
transaction size, not hop count, so a checked route can differ from the preview.
Alternative routes and Batch/Pack side branches remain dim, but required sibling
dependencies are still included in the submitted proof. Supporting nodes are not
automatically selected.

The plan lists transactions and any additional intermediate records that the
contract would need to recreate. Submission remains blocked until the user
explicitly selects those records and checks again. Already matching selected
records need no recreation. A valid plan may contain multiple transactions for
separate anchors; an oversized individual proof is still rejected, not split
arbitrarily. See the [SDK archive planner](../hash-timestamp/docs/archive.md) and
[contract Restore rules](../hash-timestamp/docs/instructions.md#restore).

Changing the file, selection, network or wallet invalidates the plan and its
planned-route highlighting; shortest history paths are recalculated for the new
selection. Selecting another node does not erase the live-record
snapshot. Clearing/replacing the file immediately removes the old
graph; failed or superseded reads cannot reuse it. Only one planning scan runs
at a time. Signing requires a checked plan with no unselected creations; the app
replans immediately before execution and rejects changes in its effects. This
is not a simulation or a guarantee of success: state, fees and rent may change.
If a later transaction fails, the receipt preserves the signatures and archive
from earlier confirmed steps, with a warning to recheck before retrying.

The collector limits traversal to 32 records. Archive files allow 16 MiB and
10,000 nodes; legacy inputs retain the 2 MB / 64-entry parser limit. These limits
are **not transaction-size guarantees**. No missing history is fabricated.

## Check a file against a proof

Open **Verify → Proof check**, choose one original/combined proof JSON and one resource
file, then click **Find file in proof**. Import reuses the same parser and file
limits as Batch / Pack (including program/RPC checks); resource SHA-256 is computed
incrementally on-device. Nothing is uploaded.

The search scans all supplied nodes, matching only Hash `hash` or Branch
`source.payload`. Derived branch/group digests and Account metadata are not file
digests. Batch/Pack membership leads to the stored member nodes; missing nodes
cannot be searched. Matches show their own `createdAt`, ordered using exact
integers and displayed 20 per page, never an enclosing group’s timestamp.

Saved timestamps are explicitly unconfirmed. **Check on network — no fee** reads
the selected record, then later connected candidate anchors, up to 32 per check.
A direct live Hash/Branch must match its saved hash, full source and timestamp,
and have votes. A later anchor must also have a complete dependency closure,
validated by the SDK, containing the target. Missing siblings or witnesses never
confer confirmation. Unrelated partial history does not invalidate a complete
path. A recreated target can still be checked through a later matching anchor.

This is a read-only RPC comparison plus local commitment validation, not a
simulation, on-chain verification transaction, restoration, or guarantee about
future chain state. It has no transaction-size limit. Missing state, incomplete
history, read errors and the candidate cap remain **Not confirmed**, not evidence
that the file never existed. Switch to the original network explicitly. These
are historical commitment timestamps, not filesystem creation dates.

Changing either file cancels or invalidates pending work and previous results;
leaving the operation tab or switching networks clears this screen. Opening
Docs preserves the mounted workspace. A search requires both valid files.

## Inspect proof histories

Open **History → Proof inspector** and choose one JSON proof. Imports reuse
`readArchiveFiles`: SDK archives and convertible legacy proofs are supported,
with the existing 16 MiB / 10,000-node archive limits (legacy: 2 MB / 64 entries).
This is an offline viewer: archives from another program can be read, while plain
legacy arrays use the configured program ID. No RPC lookup, signing or transaction
is performed by the inspector. The workspace availability check is independent.

The public SDK validates known commitments, identities and cycles. The UI builds
weakly connected components of the saved dependency graph, including missing-node
placeholders. Two branches referencing the same absent parent stay connected.
Unknown Pack membership does not invent edges; missing Account snapshots are
reported as missing supporting data, not as a link to the recorded Solana account.
Components describe known connectivity only: missing data may connect them later.

Within each history, dependencies appear below the records referencing them.
Branch links to its previous
record; Batch canonical member IDs are resolved to PDAs; Pack uses its saved PDA
membership. Protocol member order is shown on numbered edges. Each PDA has one
circle, with multiple incoming edges for shared records. Disconnected components
are laid out separately on the same canvas, each labelled **History N**.

Graph construction is iterative. Layout runs in a cancellable Web Worker, with a
15-second timeout. Components up to 200 nodes / 400 edges use Dagre; larger ones
use iterative longest-path ranks and linear placement, preserving all nodes and
edges. Connections use cubic Bézier paths with bright strokes and arrowheads toward
dependencies. Lines scale normally from a 2px width at 100% zoom, with a 0.75px
minimum on screen: `screen width = max(2 × zoom, 0.75)`. A canvas CSS variable
compensates for the HTML viewport's zoom only below that minimum. Arrowheads use
graph-space dimensions and continue to scale independently of the line-width floor.
React Flow supplies pan, pinch/touch gestures and
fit-to-view. Wheel zoom is cursor-anchored, uses 2.5× the library's default wheel
sensitivity and caps each event at a factor of two. A graph-local non-passive
listener calls the public viewport API; Ctrl/pinch events remain native.
The wheel stays inside the graph instead of also scrolling the page. Dragging
the background with the left button or dragging anywhere with the middle button
pans the view, including when the gesture starts on a node. Only visible
elements render above 250 nodes. The minimum zoom is calculated from the bounds of
all layout nodes (including history labels), the canvas size and 20% fit padding.
It equals the full-graph overview scale, capped at 1.05, rather than a fixed
percentage. Initial view and **Fit graph** show that overview; wheel/pinch, zoom
buttons and search cannot zoom out beyond it. Resize recalculates the limit and
refits an overview, while preserving a zoomed-in view unless the new minimum
requires a closer scale. Animated fit/search uses linear interpolation to avoid
temporarily dipping below the limit. Large forests show all nodes in the overview;
zooming in reduces mounted cards through viewport virtualization.
The graph is read-only (no dragging individual
nodes, connecting, reconnecting or deleting). A search focuses an exact PDA or
canonical hex ID; it does not query the network. Hover/focus opens a compact tooltip
with shortened identifiers. Click/tap opens a centred dialog with full values.
Both render through portals, without internal scrolling or shifting page layout.
The card highlights record kind and its saved date/time in UTC, followed by the
canonical record ID and proof account PDA.
It does not display raw epoch seconds or graph-reference counters. Dates outside
the browser's supported calendar range are labelled unavailable; the original
timestamp stays unchanged in the archive. Missing records never receive a guessed
timestamp or canonical ID. Details retain normalized hex hashes/IDs and Base58
addresses: Hash payload, Branch payload/previous ID and generation, group hash and
known member count, or recorded Account target and snapshot availability. Unknown
Pack membership is not shown as zero members. Branch's derived stored hash is
omitted from this summary; it remains in the archive.
This is a local visualization, not a statement of on-chain existence or readiness
for Restore. Use **Verify → Proof check** to check a resource file against history.

Changing or clearing the file immediately invalidates prior trees and cancels
pending reads; an import identity resets the viewport, search and details even when
the replacement contains the same PDAs. Switching tools/networks clears the
inspector; opening Docs keeps it mounted. Source files remain unchanged.

`archive-links.ts` reads dependency addresses for both this view and file-proof
candidate discovery. `proof-graph.ts` owns the presentation graph and components;
`graph-layout.ts` owns placement via `proof-layout.worker.ts`; the lazy-loaded
`ProofGraphViewer.tsx` owns canvas interactions, and `ProofNodeDetails.tsx` formats
record information with `proof-node-display.ts` (shared icons and UTC date display).
`ProofInspectorPanel.tsx` owns file loading and the screen.
Restore reuses this viewer through `RestoreGraphContext.tsx`, with selection and
checked-plan highlighting kept separate from graph identity and layout.
`RestoreNodePreview.tsx` provides a non-modal interactive hover preview and the
shared checkbox used in the details dialog. `RestorePanel.tsx` owns file import,
selection and stale-check invalidation. `restore-anchors.ts` uses the SDK's strict
record reader, and `use-restore-anchors.ts` owns the cancellable file/network-scoped
snapshot. `restore-paths.ts` finds shortest paths with a multi-source breadth-first
search using the SDK-validated graph and its completeness diagnostics, without
compiling transactions. For a checked step, it restricts traversal to that
SDK-validated proof and trusts the planner's witness checks, including live Account
records whose snapshots are not included in the archive.
`restore-graph.ts` adapts SDK planning,
per-step proof highlighting and execution receipts. Plain Proof inspector stays
local and does not acquire Restore controls or network calls.
Protocol validation remains in the synchronized SDK. Library integration follows
the [React Flow custom-node documentation](https://reactflow.dev/learn/customization/custom-nodes)
and [Dagre layout example](https://reactflow.dev/examples/layout/dagre).

## Merge proof files

Open **History → Merge proofs**, select two or more JSON files, and click **Merge files**. Further
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
not a ready-to-submit proof chain. Open it in **Restore**, select records and
check their paths; the SDK planner chooses the necessary proofs from the archive.
Verify the original network before performing any on-chain operation.

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
not reimplement protocol formulas. Archive planning needs a payer to estimate
transaction size: its read-only adapter uses the connected public key, or a
placeholder while disconnected, with signing methods that always reject. A
wallet change invalidates that preview; submission uses the real signing client.

Creation receipts also retain the SDK's one-node `archive`; register/branch now
return `{ signature, archive }`. The SDK's versioned node graph and automatic
restore planner are documented in the [archive guide](../hash-timestamp/docs/archive.md).
Retained-history and creation receipts export collected legacy proofs; a creation's
one-node SDK archive must not replace that full history. Archive Restore receipts
download the complete SDK archive from the confirmed steps. Merge proofs and
Restore accept both file formats. A confirmed `ArchiveCaptureError` keeps
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
