#!/bin/sh
set -eu

artifacts_dir=${ARTIFACTS_DIR:-/artifacts}
ledger_dir=${LEDGER_DIR:-/ledger}
for artifact in hash_timestamp.so program-id.txt; do
  if [ ! -s "$artifacts_dir/$artifact" ]; then
    echo "Missing $artifacts_dir/$artifact; rebuild the localnet image." >&2
    exit 1
  fi
done
program_id=$(cat "$artifacts_dir/program-id.txt")
case "$program_id" in
  ''|*[!1-9A-HJ-NP-Za-km-z]*) echo "Invalid program address." >&2; exit 1 ;;
esac

# Genesis flags cannot upgrade an existing ledger. Refuse a mismatched binary
# rather than silently running the old program or deleting local chain state.
fingerprint="$program_id:$(sha256sum "$artifacts_dir/hash_timestamp.so" | cut -d ' ' -f 1)"
fingerprint_file=$ledger_dir/.hash-timestamp-build
if [ -f "$fingerprint_file" ]; then
  if [ "$(cat "$fingerprint_file")" != "$fingerprint" ]; then
    echo "Ledger belongs to a different contract build. Use a new Compose project/volume." >&2
    exit 1
  fi
elif [ -e "$ledger_dir/genesis.bin" ] || [ -e "$ledger_dir/genesis.tar.bz2" ]; then
  echo "Existing ledger has no build fingerprint. Use a new Compose project/volume." >&2
  exit 1
else
  mkdir -p "$ledger_dir"
  printf '%s\n' "$fingerprint" > "$fingerprint_file"
fi

# Agave 4.0.3 also advertises this IP for gossip; 0.0.0.0 causes a panic.
# Its test-validator binds RPC/WS to all interfaces independently, so Docker's
# published RPC ports remain reachable with loopback gossip/validator sockets.
exec solana-test-validator \
  --ledger "$ledger_dir" \
  --bind-address 127.0.0.1 \
  --rpc-port 8899 \
  --bpf-program "$program_id" "$artifacts_dir/hash_timestamp.so" \
  --log
