# Local accounts and build artifacts

`scripts/build-contract.sh` exports a container-built contract binary, IDL,
generated TypeScript type and program address into `build/`. To copy an existing
host build instead, use `scripts/copy-metadata.sh`. Private keypairs are never
exported. This directory is ignored by Git and is not mounted by Compose: the
validator image contains its own freshly built artifacts.

Existing local account files are retained here, but are not loaded automatically.
Do not put keys in `public/` or import them into the frontend.
