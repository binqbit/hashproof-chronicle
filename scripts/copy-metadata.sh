#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
case "${1:-}" in
  -h|--help)
    echo "Usage: sh scripts/copy-metadata.sh [contract-directory]"
    echo "Exports existing build artifacts into accounts/build; never copies keypairs."
    exit 0 ;;
esac
[ "$#" -le 1 ] || { echo "Expected at most one contract directory." >&2; exit 1; }
contract=${1:-${CONTRACT_DIR:-$root/hash-timestamp}}
contract=$(CDPATH= cd -- "$contract" && pwd)

for artifact in deploy/hash_timestamp.so idl/hash_timestamp.json types/hash_timestamp.ts; do
  if [ ! -s "$contract/target/$artifact" ]; then
    echo "Missing $contract/target/$artifact; build the contract first." >&2
    exit 1
  fi
done
# Reuse the contract's compatibility check instead of maintaining another IDL validator.
node "$contract/scripts/check-idl.cjs"
program_id=$(node -e '
  const idl = require(process.argv[1]);
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(idl.address)) {
    throw new Error("Invalid IDL program address");
  }
  process.stdout.write(idl.address);
' "$contract/target/idl/hash_timestamp.json")

destination=$root/accounts/build
mkdir -p "$destination"
cp "$contract/target/deploy/hash_timestamp.so" "$destination/hash_timestamp.so"
cp "$contract/target/idl/hash_timestamp.json" "$destination/idl.json"
cp "$contract/target/types/hash_timestamp.ts" "$destination/hash_timestamp.ts"
printf '%s\n' "$program_id" > "$destination/program-id.txt"
echo "Exported public build artifacts to $destination"
