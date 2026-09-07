#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"
[ "$#" -le 1 ] || { echo "Expected one action: up, down, logs or status." >&2; exit 1; }
case "${1:-up}" in
  -h|--help)
    echo "Usage: sh scripts/deploy.sh [up|down|logs|status]"
    echo "Builds and starts the frontend and localnet; never resets the ledger or deploys to public clusters."
    exit 0 ;;
  up)
    if [ ! -f "$root/hash-timestamp/Anchor.toml" ]; then
      echo "Initialize the contract first: git submodule update --init --recursive" >&2
      exit 1
    fi
    exec docker compose -f "$root/docker-compose.yml" up -d --build --wait ;;
  down) exec docker compose -f "$root/docker-compose.yml" down ;;
  logs) exec docker compose -f "$root/docker-compose.yml" logs -f ;;
  status) exec docker compose -f "$root/docker-compose.yml" ps ;;
  *) echo "Unknown action: $1. Use --help." >&2; exit 1 ;;
esac
