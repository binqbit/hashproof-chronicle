#!/bin/sh
set -eu

artifacts_dir=${ARTIFACTS_DIR:-/artifacts}
ledger_dir=${LEDGER_DIR:-/ledger}
fixtures_dir=${FIXTURES_DIR:-/fixtures/proof-chain}
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
for fixture in pack.json pack-vote.json program-id.txt; do
  if [ ! -s "$fixtures_dir/$fixture" ]; then
    echo "Missing $fixtures_dir/$fixture; restore the proof-chain example fixtures." >&2
    exit 1
  fi
done
if [ "$(cat "$fixtures_dir/program-id.txt")" != "$program_id" ]; then
  echo "Proof-chain fixtures belong to a different program address." >&2
  exit 1
fi

has_ledger=false
if [ -e "$ledger_dir/genesis.bin" ] || [ -e "$ledger_dir/genesis.tar.bz2" ] || [ -e "$ledger_dir/vote-account-keypair.json" ]; then
  has_ledger=true
fi

# Genesis flags cannot upgrade an existing ledger. Refuse a mismatched binary
# rather than silently running the old program or deleting local chain state.
fingerprint="$program_id:$(sha256sum "$artifacts_dir/hash_timestamp.so" | cut -d ' ' -f 1)"
fingerprint_file=$ledger_dir/.hash-timestamp-build
if [ -f "$fingerprint_file" ]; then
  if [ "$(cat "$fingerprint_file")" != "$fingerprint" ]; then
    echo "Ledger belongs to a different contract build. Use a new Compose project/volume." >&2
    exit 1
  fi
elif [ "$has_ledger" = true ]; then
  echo "Existing ledger has no build fingerprint. Use a new Compose project/volume." >&2
  exit 1
fi

# --account only seeds genesis; it cannot insert or replace accounts on restart.
fixture_fingerprint="$(sha256sum "$fixtures_dir/pack.json" | cut -d ' ' -f 1):$(sha256sum "$fixtures_dir/pack-vote.json" | cut -d ' ' -f 1)"
fixture_fingerprint_file=$ledger_dir/.proof-chain-fixture
if [ -f "$fixture_fingerprint_file" ]; then
  if [ "$(cat "$fixture_fingerprint_file")" != "$fixture_fingerprint" ]; then
    echo "Ledger belongs to different proof-chain fixtures. Use a new Compose project/volume." >&2
    exit 1
  fi
elif [ "$has_ledger" = true ]; then
  echo "Existing ledger has no proof-chain fixture. Use a new Compose project/volume; the old ledger is preserved." >&2
  exit 1
fi

mkdir -p "$ledger_dir"
if [ ! -f "$fingerprint_file" ]; then
  printf '%s\n' "$fingerprint" > "$fingerprint_file"
fi
if [ ! -f "$fixture_fingerprint_file" ]; then
  printf '%s\n' "$fixture_fingerprint" > "$fixture_fingerprint_file"
fi

# Agave 4.0.3 also advertises this IP for gossip; 0.0.0.0 causes a panic.
# Its test-validator binds RPC/WS to all interfaces independently, so Docker's
# published RPC ports remain reachable with loopback gossip/validator sockets.
exec solana-test-validator \
  --ledger "$ledger_dir" \
  --bind-address 127.0.0.1 \
  --rpc-port 8899 \
  --bpf-program "$program_id" "$artifacts_dir/hash_timestamp.so" \
  --account - "$fixtures_dir/pack.json" \
  --account - "$fixtures_dir/pack-vote.json" \
  --log
