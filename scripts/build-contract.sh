#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
case "${1:-}" in
  -h|--help)
    echo "Usage: sh scripts/build-contract.sh"
    echo "Builds the contract in Docker and exports public artifacts into accounts/build."
    exit 0 ;;
esac
[ "$#" -eq 0 ] || { echo "Unexpected arguments. Use --help." >&2; exit 1; }
if [ ! -f "$root/hash-timestamp/Anchor.toml" ]; then
  echo "Initialize the contract first: git submodule update --init --recursive" >&2
  exit 1
fi
exec docker build --platform linux/amd64 \
  -f "$root/infra/localnet/Dockerfile" --target artifacts \
  --output "type=local,dest=$root/accounts/build" "$root"
