# Local infrastructure

All deployment configuration lives in this repository. `hash-timestamp/` is a Git
submodule whose source remains unchanged. There are two runtime services:
`localnet` (Agave validator with the compiled contract) and `frontend` (Vite build
served by Nginx). There is no backend.

The frontend uses the current contract SDK and selects localnet by default.
Its RPC requests come from the browser, so the default endpoint is the host's
loopback address, not the Compose service name. See the
[frontend guide](frontend.md) for operations, network selection and SDK updates.

## Start the stack

Requirements: Git access to the submodule's SSH remote, Docker Engine with
BuildKit/buildx and Compose v2.20+ (or v5), permission to access the Docker daemon,
and internet access for image/toolchain/dependency downloads. The validator image
targets Linux amd64; other host architectures need Docker's amd64 emulation.
The first build downloads a Rust/Solana toolchain and can take several minutes.

Run from this repository:

```sh
git submodule update --init --recursive
sh scripts/deploy.sh up
```

The script runs `docker compose up -d --build --wait`. Docker builds both images;
the frontend container starts after the validator's RPC health check succeeds.
Builds may run in parallel. `--wait` also waits for the frontend's HTTP health check.
No host Anchor, Rust or npm installation is needed for this workflow.

| Service | Host endpoint |
| --- | --- |
| Frontend | `http://localhost:8080` |
| Solana RPC | `http://127.0.0.1:8899` |
| Solana WebSocket | `ws://127.0.0.1:8900` |

Ports bind only to host loopback. Nginx supports SPA routes and serves
`/health`; it does not proxy RPC or change the application's network.

The validator uses `--bind-address 127.0.0.1` for its local validator/gossip
sockets. Agave 4.0.3 also advertises that address and rejects `0.0.0.0` with
`UnspecifiedIpAddr`. Its test-validator binds RPC and WebSocket listeners to
all container interfaces independently, so Compose port forwarding still works.
See the pinned [Agave startup code](https://github.com/anza-xyz/agave/blob/v4.0.3/test-validator/src/lib.rs#L1119-L1200)
when changing validator versions or network bindings.

```sh
sh scripts/deploy.sh status
sh scripts/deploy.sh logs
sh scripts/deploy.sh down
```

For one service's logs: `docker compose logs -f localnet` or
`docker compose logs -f frontend`. With Solana CLI installed on the host, check RPC
using `solana --url http://127.0.0.1:8899 cluster-version`.

Compose mounts `infra/localnet/entrypoint.sh` read-only from this checkout, so
startup-script fixes do not require rebuilding the contract image. If an older
container exits with `UnspecifiedIpAddr(0.0.0.0)`, recreate it to apply the mount
and corrected entrypoint using the already-built images:

```sh
docker compose up -d --no-build --force-recreate --wait
```

Use `sudo` if required by your Docker installation. Keep the existing ledger
volume: this networking fix does not change the contract binary and requires
neither `down -v` nor `--reset`.

### Required io_uring support

On Linux, Agave 4.0.3 requires `io_uring` when preparing its accounts directories;
`assertion failed: io_uring_supported()` is a separate fatal error from the
gossip-address panic. Docker's default seccomp profile blocks the required calls.
Only `localnet` uses [seccomp.json](../infra/localnet/seccomp.json), a modified
[Moby default profile](https://github.com/moby/profiles/blob/61eaf32614c7c71b60bd8927d3e6a4ffc8ff1f31/seccomp/default.json)
with `io_uring_setup`, `io_uring_enter` and `io_uring_register` added to its
allowlist. All other rules are retained; the profile is distributed under the
adjacent [Apache 2.0 license](../infra/localnet/seccomp.LICENSE).

This is a local-development exception: Docker blocks these calls because of
their history of container-escape vulnerabilities. Keep the host kernel patched.
No privileged mode, extra capabilities or unconfined profile is enabled, and the
frontend keeps Docker's default profile. Recreate containers with the command
above to apply this policy; rebuilding images or resetting the ledger is not needed.

If `io_uring` still fails with `Operation not permitted`, check the host using
`sysctl kernel.io_uring_disabled` and inspect any outer VM/container security
policy. A custom Docker profile cannot override a host-wide ban. Do not change
host security settings automatically. See [Docker's seccomp documentation](https://docs.docker.com/engine/security/seccomp/)
and the pinned [Agave directory implementation](https://github.com/anza-xyz/agave/blob/v4.0.3/fs/src/dirs.rs).

## Build ownership and artifacts

`infra/localnet/Dockerfile` owns the contract build and validator runtime. It uses
the official [Anchor 0.31.1 image](https://www.anchor-lang.com/docs/updates/release-notes/0-31-1)
for the Anchor executable, a dated Rust nightly for IDL generation, and the
checksum-verified [Agave v4.0.3 release](https://github.com/anza-xyz/agave/releases/tag/v4.0.3).
Toolchain versions are explicit in the Dockerfile; validate build/IDL compatibility
when updating them.

The builder copies contract sources into the image, invokes the contract's
existing `scripts/test.sh --build-only`, rejects any Cargo lockfile change, checks
generated IDL against its compatibility baseline, and exports the public artifacts. The runtime image
receives those artifacts, validator tools and the entrypoint, not compilers or
contract source. Compose overrides only the entrypoint with the checkout's script;
contract artifacts remain embedded in the image.

`infra/frontend/Dockerfile` installs the committed npm lockfile with `npm ci`, runs
`npm run build`, and copies only `dist/` into Nginx. The build checks that the
managed SDK and IDL match the submodule and type-checks the application. After a
contract source update, run `npm run sync:contract` on the host before rebuilding.
This maintenance step requires Node/npm; ordinary Compose builds do not.

`VITE_SOLANA_NETWORK` and `VITE_SOLANA_RPC_URL` are optional frontend build
arguments, passed through Compose from its environment or `.env`. They are
public browser configuration, not secrets. A change requires rebuilding the
frontend. The normal local stack does not require either variable.

`.dockerignore` allowlists source inputs. Host `target/`, `node_modules/`, Git
metadata, account files and private keys are excluded. The only `target/` exception
is the managed frontend IDL type under `src/generated/`. Container builds do not
write to the submodule's host checkout. Do not build while editing source files.

The stack embeds artifacts in its localnet image; it does not mount or depend on
host `accounts/build/`. To export a fresh build for other tools:

```sh
sh scripts/build-contract.sh
```

This uses the same Dockerfile's `artifacts` target and BuildKit's local output.
Only the following files are exported into ignored `accounts/build/`:

- `hash_timestamp.so`: compiled contract;
- `idl.json`: generated IDL;
- `hash_timestamp.ts`: generated TypeScript type;
- `program-id.txt`: address read from the IDL.

For an already completed host build, `sh scripts/copy-metadata.sh` copies from
`hash-timestamp/target/`; an optional directory argument or `CONTRACT_DIR` selects
another checkout. This is not needed for Compose. A host build requires the
[contract toolchain](../hash-timestamp/docs/testing.md). Export only after a
successful build of the same source: IDL comparison alone cannot prove that an
old binary matches the source.

## Ledger persistence

The validator preloads the program at genesis with upgrades disabled. Its ledger
lives in the Compose `test-ledger` named volume; `down` preserves it. Replacing
the binary does not upgrade an existing genesis program.

The entrypoint records the program address and binary SHA-256 in the ledger and
refuses to start if a different build is supplied. Existing ledgers without this
fingerprint are also refused; they are never reset or deleted automatically.
This includes volumes created by the earlier infrastructure setup.

To test a new build while preserving the previous chain, stop the old stack and
use a new Compose project name:

```sh
sh scripts/deploy.sh down
COMPOSE_PROJECT_NAME=hashproof-next sh scripts/deploy.sh up
COMPOSE_PROJECT_NAME=hashproof-next sh scripts/deploy.sh logs
COMPOSE_PROJECT_NAME=hashproof-next sh scripts/deploy.sh down
```

Keep that name for subsequent operations. Both projects use the same host ports,
so only one should be running at a time. No deployment script sends transactions
to public Solana clusters. Existing local files in `accounts/` and `config/` stay
ignored, unmodified and outside the container build context.

## Git submodule workflow

Clone this repository with `--recurse-submodules`, or initialize the submodule as
shown above after cloning. `.gitmodules` declares its remote, and the parent Git
index pins the contract commit. Deploy uses the initialized working copy, not a
network checkout of the latest branch. Review `git submodule status` before a build.

Updating the pinned contract is a separate explicit change: check out the desired
contract commit, verify its build, then stage `hash-timestamp` in this repository.
Do not run `git submodule update --remote` as part of deployment.

## Verification

```sh
node --test scripts/tests/infrastructure.test.cjs
docker compose config --quiet
```

The script tests use disposable directories and fake Docker/validator executables.
They cover command routing, artifact export, missing submodule checks and ledger
preservation without sending transactions or reading real keypairs. These tests
and Compose validation do not substitute for a container runtime smoke test:
run `sh scripts/deploy.sh up`, inspect `status`, and check the HTTP/RPC endpoints.
