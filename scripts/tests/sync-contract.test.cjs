const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { syncSdk, syncIdl, check } = require("../sync-contract.cjs");
const repository = path.resolve(__dirname, "../..");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hashproof-sync-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const contract = path.join(root, "hash-timestamp");
  for (const relative of [
    "package.json",
    "hash-timestamp/package.json",
    "hash-timestamp/Anchor.toml",
    "hash-timestamp/programs/hash-timestamp/Cargo.toml",
    "hash-timestamp/scripts/check-idl.cjs",
    "hash-timestamp/tests/fixtures/idl.json",
    "hash-timestamp/app/sdk",
  ]) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(path.join(repository, relative), target, { recursive: true });
  }
  const output = path.join(root, "src/generated/hash-timestamp");
  return { root, contract, output };
}

test("sync is deterministic, checks drift and leaves SDK source untouched", (t) => {
  const { root, contract, output } = fixture(t);
  const original = fs.readFileSync(
    path.join(contract, "app/sdk/protocol/hashes.ts"),
  );
  syncSdk(root);
  syncIdl(root);
  check(root);
  const types = fs.readFileSync(
    path.join(output, "target/types/hash_timestamp.ts"),
  );
  syncSdk(root);
  syncIdl(root);
  check(root);
  assert(
    types.equals(
      fs.readFileSync(path.join(output, "target/types/hash_timestamp.ts")),
    ),
  );
  assert(
    original.equals(
      fs.readFileSync(path.join(contract, "app/sdk/protocol/hashes.ts")),
    ),
  );
  assert.match(
    fs.readFileSync(path.join(output, "app/sdk/protocol/hashes.ts"), "utf8"),
    /missing rentEpoch/,
  );
  fs.appendFileSync(path.join(output, "app/sdk/client.ts"), "\n// drift");
  assert.throws(() => check(root), /SDK drift/);
  syncSdk(root);
  check(root);
  fs.appendFileSync(
    path.join(output, "target/types/hash_timestamp.ts"),
    "\n// drift",
  );
  assert.throws(() => check(root), /types are stale/);
});

test("sync rejects incompatible IDL without overwriting an existing generated IDL", (t) => {
  const { root, output } = fixture(t);
  syncSdk(root);
  syncIdl(root);
  const original = fs.readFileSync(path.join(output, "idl.json"));
  const bad = JSON.parse(original);
  bad.instructions[0].discriminator[0] ^= 1;
  const input = path.join(root, "bad-idl.json");
  fs.writeFileSync(input, JSON.stringify(bad));
  assert.throws(() => syncIdl(root, input), /reviewed contract baseline/);
  assert(original.equals(fs.readFileSync(path.join(output, "idl.json"))));
});

test("sync rejects version, program identity and missing submodule mismatches", (t) => {
  const { root, contract } = fixture(t);
  syncSdk(root);
  syncIdl(root);
  const manifestPath = path.join(
    contract,
    "programs/hash-timestamp/Cargo.toml",
  );
  const manifest = fs.readFileSync(manifestPath, "utf8");
  fs.writeFileSync(
    manifestPath,
    manifest.replace(/^version = .*/m, 'version = "0.0.0"'),
  );
  assert.throws(() => check(root), /version differs/);
  fs.writeFileSync(manifestPath, manifest);
  fs.writeFileSync(
    path.join(contract, "Anchor.toml"),
    'hash_timestamp = "11111111111111111111111111111111"',
  );
  assert.throws(() => check(root), /program address differs/);
  fs.unlinkSync(path.join(contract, "app/sdk/hashTimestamp.ts"));
  assert.throws(() => syncSdk(root), /submodule update/);
});

test("SDK sync refuses destination symlinks before writing through them", (t) => {
  const { root, output } = fixture(t);
  syncSdk(root);
  const victim = path.join(root, "keep.ts");
  fs.writeFileSync(victim, "preserve");
  const link = path.join(output, "app/sdk/client.ts");
  fs.unlinkSync(link);
  fs.symlinkSync(victim, link);
  assert.throws(() => syncSdk(root), /symlink/);
  assert.equal(fs.readFileSync(victim, "utf8"), "preserve");
});

test("updating SDK removes obsolete managed files but never app adapters", (t) => {
  const { root, output } = fixture(t);
  syncSdk(root);
  fs.writeFileSync(path.join(output, "app/sdk/obsolete.ts"), "old");
  fs.mkdirSync(path.join(root, "src/contract"), { recursive: true });
  fs.writeFileSync(path.join(root, "src/contract/adapter.ts"), "keep");
  syncSdk(root);
  assert(!fs.existsSync(path.join(output, "app/sdk/obsolete.ts")));
  assert.equal(
    fs.readFileSync(path.join(root, "src/contract/adapter.ts"), "utf8"),
    "keep",
  );
});
