# HashProof Chronicle

A browser workspace for [Hash Timestamp](hash-timestamp/README.md): hash files
locally, register commitments on Solana, manage votes, create branches and
batch/pack aggregates, commit account snapshots, merge proof files locally, and
restore retained history.

The frontend uses the SDK from the contract submodule, with a small browser
compatibility layer and synchronized IDL. There is no backend and no file upload.
A timestamp records a historical commitment; it does not establish file creation
time, authorship or ownership.

## Development

Requires Node.js 22+ and npm. Run from this repository:

```bash
git submodule update --init --recursive
npm ci
npm run check:contract
npm run dev
```

Open the URL printed by Vite. Localnet is selected by default. File hashing and
proof import work without a wallet; chain operations need a reachable RPC and the
current program deployed there. Devnet/testnet are selectable explicitly.
The app opens on Inspect. **Docs & guides** opens a separate documentation page
with topic navigation. Returning to the workspace preserves your current form
and in-memory history within the same session.

See the [frontend guide](docs/frontend.md) for screen usage, network configuration,
SDK/IDL updates, proof retention and testing.

## Build and preview

```bash
npm run build
npm run preview
```

The build outputs `dist/`. Static hosting requires an SPA fallback to `index.html`.

## Local infrastructure

This repository owns Docker Compose and all container configuration. The contract
is linked as a Git submodule; its source does not contain this deployment setup.

```sh
git submodule update --init --recursive
sh scripts/deploy.sh up
```

Compose builds the contract and frontend, starts the local validator, then serves
the UI at `http://localhost:8080`. No host Anchor installation is needed for this
workflow. See [local infrastructure](docs/localnet.md) for prerequisites, artifact
export, logs and ledger persistence.

- `src/features/`: record screens, history collection/import and transaction flow;
- `src/contract/`: browser adapter, client/provider setup and network selection;
- `src/generated/`: managed SDK copy, IDL and generated types;
- `hash-timestamp/`: contract, original SDK and contract tests (submodule);
- `infra/localnet/`: contract build, validator image and entrypoint;
- `infra/frontend/`: frontend image and static hosting configuration;
- `scripts/`: contract synchronization, build, artifact export and localnet commands;
- `accounts/`: ignored local files and exported build artifacts.

## Update the integration

After explicitly updating the contract checkout:

```sh
npm run sync:contract
npm test
npm run build
```

Sync does not pull Git changes or modify the submodule. Builds reject SDK/IDL
drift. For separate updates and an IDL exported by a fresh build, see
[SDK and IDL synchronization](docs/frontend.md#sdk-and-idl-synchronization).
