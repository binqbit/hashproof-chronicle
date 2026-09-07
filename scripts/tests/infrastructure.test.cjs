const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { test } = require('node:test');

test('localnet seccomp preserves the pinned default and only adds io_uring', () => {
  const profile = JSON.parse(fs.readFileSync(path.join(__dirname, '../../infra/localnet/seccomp.json'), 'utf8'));
  assert.equal(profile.defaultAction, 'SCMP_ACT_ERRNO');
  assert.equal(profile.defaultErrnoRet, 1);
  assert.deepEqual(profile.syscalls.pop(), {
    names: ['io_uring_setup', 'io_uring_enter', 'io_uring_register'],
    action: 'SCMP_ACT_ALLOW',
  });
  // SHA-256 of JSON.stringify(default.json) from moby/profiles commit
  // 61eaf32614c7c71b60bd8927d3e6a4ffc8ff1f31. All upstream rules stay intact,
  // including namespace/capability restrictions and clone3's ENOSYS fallback.
  assert.equal(createHash('sha256').update(JSON.stringify(profile)).digest('hex'),
    'afb4934b023cfceaaec1a9d752ca3f801aaa96eb2e59abe6e7ea16976948e080');
});

function fixture(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'hashproof-infra-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const root = path.join(temporary, 'frontend with spaces');
  const contract = path.join(root, 'hash-timestamp');
  const put = (file, contents) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  };
  for (const name of ['build-contract.sh', 'copy-metadata.sh', 'deploy.sh']) {
    put(path.join(root, 'scripts', name), fs.readFileSync(path.join(__dirname, '..', name)));
  }
  const address = '11111111111111111111111111111111';
  put(path.join(contract, 'Anchor.toml'), '# Contract checkout marker');
  put(path.join(contract, 'target/deploy/hash_timestamp.so'), 'test binary');
  put(path.join(contract, 'target/deploy/hash_timestamp-keypair.json'), 'DO NOT EXPORT');
  put(path.join(contract, 'target/idl/hash_timestamp.json'), JSON.stringify({ address }));
  put(path.join(contract, 'target/types/hash_timestamp.ts'), 'export type HashTimestamp = {};');
  // These tests cover orchestration; IDL compatibility has its own contract tests.
  put(path.join(contract, 'scripts/check-idl.cjs'), 'process.exit(Number(process.env.CHECK_EXIT || 0));');
  put(path.join(contract, 'scripts/test.sh'), '#!/bin/bash\nprintf "%s\\n" "$@" > "$BUILD_ARGS"\nexit "${BUILD_EXIT:-0}"\n');
  const docker = path.join(temporary, 'bin/docker');
  put(docker, '#!/bin/sh\nprintf "%s\\n" "$@" > "$DOCKER_ARGS"\nexit "${DOCKER_EXIT:-0}"\n');
  fs.chmodSync(docker, 0o755);
  const env = {
    ...process.env,
    PATH: `${path.dirname(docker)}:${process.env.PATH}`,
    CONTRACT_DIR: contract,
    BUILD_ARGS: path.join(temporary, 'build-args'),
    DOCKER_ARGS: path.join(temporary, 'docker-args'),
    BUILD_EXIT: '0',
    CHECK_EXIT: '0',
    DOCKER_EXIT: '0',
  };
  const run = (script, args = [], extra = {}) => spawnSync('sh', [path.join(root, 'scripts', script), ...args], {
    cwd: temporary, env: { ...env, ...extra }, encoding: 'utf8',
  });
  return { root, contract, put, run, env, address, output: path.join(root, 'accounts/build') };
}

test('export uses explicit paths, preserves the address and excludes keypairs', (t) => {
  const f = fixture(t);
  const result = f.run('copy-metadata.sh', [f.contract], { CONTRACT_DIR: '/missing' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readdirSync(f.output).sort(), [
    'hash_timestamp.so', 'hash_timestamp.ts', 'idl.json', 'program-id.txt',
  ]);
  assert.equal(fs.readFileSync(path.join(f.output, 'program-id.txt'), 'utf8'), `${f.address}\n`);
  assert.equal(fs.readFileSync(path.join(f.output, 'hash_timestamp.so'), 'utf8'), 'test binary');
});

test('missing artifact fails before creating an export', (t) => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.contract, 'target/types/hash_timestamp.ts'));
  const result = f.run('copy-metadata.sh');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing/);
  assert.equal(fs.existsSync(f.output), false);
});

test('IDL check failure preserves an existing export', (t) => {
  const f = fixture(t);
  f.put(path.join(f.output, 'idl.json'), 'previous export');
  const result = f.run('copy-metadata.sh', [], { CHECK_EXIT: '7' });
  assert.equal(result.status, 7);
  assert.equal(fs.readFileSync(path.join(f.output, 'idl.json'), 'utf8'), 'previous export');
});

test('invalid program address is rejected before copying', (t) => {
  const f = fixture(t);
  f.put(path.join(f.contract, 'target/idl/hash_timestamp.json'), '{"address":"--reset"}');
  assert.notEqual(f.run('copy-metadata.sh').status, 0);
  assert.equal(fs.existsSync(f.output), false);
});

test('artifact build uses Docker without running host contract tools', (t) => {
  const f = fixture(t);
  const result = f.run('build-contract.sh');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(f.env.DOCKER_ARGS, 'utf8'),
    `build\n--platform\nlinux/amd64\n-f\n${f.root}/infra/localnet/Dockerfile\n--target\nartifacts\n--output\ntype=local,dest=${f.output}\n${f.root}\n`);
  assert.equal(fs.existsSync(f.env.BUILD_ARGS), false);
  assert.equal(f.run('build-contract.sh', [], { DOCKER_EXIT: '17' }).status, 17);
  assert.notEqual(f.run('build-contract.sh', ['--offline']).status, 0);
});

test('build and deploy reject an uninitialized submodule without calling Docker', (t) => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.contract, 'Anchor.toml'));
  assert.notEqual(f.run('build-contract.sh').status, 0);
  assert.notEqual(f.run('deploy.sh', ['up']).status, 0);
  assert.notEqual(f.run('deploy.sh', ['reset']).status, 0);
  assert.notEqual(f.run('deploy.sh', ['down', '--volumes']).status, 0);
  assert.equal(fs.existsSync(f.env.DOCKER_ARGS), false);
});

test('deploy selects the repository Compose file from any working directory', (t) => {
  const f = fixture(t);
  // Host artifacts are not required: the localnet image builds its own copy.
  assert.equal(fs.existsSync(f.output), false);
  assert.equal(f.run('deploy.sh', ['up']).status, 0);
  const prefix = `compose\n-f\n${f.root}/docker-compose.yml\n`;
  assert.equal(fs.readFileSync(f.env.DOCKER_ARGS, 'utf8'), `${prefix}up\n-d\n--build\n--wait\n`);
  assert.equal(f.run('deploy.sh', ['down']).status, 0);
  assert.equal(fs.readFileSync(f.env.DOCKER_ARGS, 'utf8'), `${prefix}down\n`);
  assert.equal(f.run('deploy.sh', ['logs']).status, 0);
  assert.equal(fs.readFileSync(f.env.DOCKER_ARGS, 'utf8'), `${prefix}logs\n-f\n`);
});

test('export defaults to the nested contract checkout', (t) => {
  const f = fixture(t);
  const result = f.run('copy-metadata.sh', [], { CONTRACT_DIR: '' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(f.output, 'idl.json')), true);
});

function validatorFixture(t) {
  const f = fixture(t);
  const entrypoint = path.join(f.root, 'entrypoint.sh');
  f.put(entrypoint, fs.readFileSync(path.join(__dirname, '../../infra/localnet/entrypoint.sh')));
  const validator = path.join(path.dirname(f.env.DOCKER_ARGS), 'bin/solana-test-validator');
  f.put(validator, '#!/bin/sh\nprintf "%s\\n" "$@" > "$VALIDATOR_ARGS"\n');
  fs.chmodSync(validator, 0o755);
  assert.equal(f.run('copy-metadata.sh').status, 0);
  const ledger = path.join(f.root, 'test ledger');
  const argsFile = path.join(f.root, 'validator-args');
  const fixtures = path.join(f.root, 'proof chain fixtures');
  f.put(path.join(fixtures, 'program-id.txt'), `${f.address}\n`);
  // These are orchestration sentinels; real dump contents are decoded in the example unit test.
  f.put(path.join(fixtures, 'pack.json'), 'pack account fixture');
  f.put(path.join(fixtures, 'pack-vote.json'), 'vote account fixture');
  const start = () => spawnSync('sh', [entrypoint], {
    env: { ...f.env, ARTIFACTS_DIR: f.output, LEDGER_DIR: ledger, FIXTURES_DIR: fixtures, VALIDATOR_ARGS: argsFile },
    encoding: 'utf8',
  });
  return { ...f, start, ledger, argsFile, fixtures };
}

test('validator loads the built program and preserves matching ledger state', (t) => {
  const f = validatorFixture(t);
  assert.equal(f.start().status, 0);
  const args = fs.readFileSync(f.argsFile, 'utf8');
  assert.equal(args, `--ledger\n${f.ledger}\n--bind-address\n127.0.0.1\n--rpc-port\n8899\n--bpf-program\n${f.address}\n${f.output}/hash_timestamp.so\n--account\n-\n${f.fixtures}/pack.json\n--account\n-\n${f.fixtures}/pack-vote.json\n--log\n`);
  f.put(path.join(f.ledger, 'genesis.bin'), 'persistent local chain');
  assert.equal(f.start().status, 0);
  assert.equal(fs.readFileSync(path.join(f.ledger, 'genesis.bin'), 'utf8'), 'persistent local chain');
});

test('validator refuses changed binaries without resetting the existing ledger', (t) => {
  const f = validatorFixture(t);
  assert.equal(f.start().status, 0);
  fs.unlinkSync(f.argsFile);
  f.put(path.join(f.output, 'hash_timestamp.so'), 'another build');
  const result = f.start();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /different contract build/);
  assert.equal(fs.existsSync(f.argsFile), false);
  assert.equal(fs.existsSync(path.join(f.ledger, '.hash-timestamp-build')), true);
});

test('validator refuses untracked existing ledgers and missing artifacts', (t) => {
  const f = validatorFixture(t);
  f.put(path.join(f.ledger, 'genesis.bin'), 'legacy chain');
  assert.match(f.start().stderr, /no build fingerprint/);
  assert.equal(fs.existsSync(f.argsFile), false);
  fs.unlinkSync(path.join(f.output, 'hash_timestamp.so'));
  assert.match(f.start().stderr, /Missing/);
  assert.equal(fs.readFileSync(path.join(f.ledger, 'genesis.bin'), 'utf8'), 'legacy chain');
});

test('validator refuses missing or wrong-program fixtures before writing a ledger', (t) => {
  const f = validatorFixture(t);
  f.put(path.join(f.fixtures, 'program-id.txt'), 'another-program');
  assert.match(f.start().stderr, /different program address/);
  assert.equal(fs.existsSync(f.ledger), false);
  f.put(path.join(f.fixtures, 'program-id.txt'), f.address);
  fs.unlinkSync(path.join(f.fixtures, 'pack-vote.json'));
  assert.match(f.start().stderr, /Missing.*pack-vote.json/);
  assert.equal(fs.existsSync(f.argsFile), false);
  assert.equal(fs.existsSync(f.ledger), false);
});

test('validator preserves existing chains when proof fixtures change or were never seeded', (t) => {
  const f = validatorFixture(t);
  assert.equal(f.start().status, 0);
  f.put(path.join(f.ledger, 'genesis.bin'), 'keep this chain');
  fs.unlinkSync(f.argsFile);
  const marker = path.join(f.ledger, '.proof-chain-fixture');
  const originalMarker = fs.readFileSync(marker, 'utf8');
  f.put(path.join(f.fixtures, 'pack.json'), 'changed pack fixture');
  assert.match(f.start().stderr, /different proof-chain fixtures/);
  assert.equal(fs.readFileSync(marker, 'utf8'), originalMarker);
  fs.unlinkSync(marker);
  assert.match(f.start().stderr, /no proof-chain fixture/);
  assert.equal(fs.existsSync(marker), false);
  assert.equal(fs.existsSync(f.argsFile), false);
  assert.equal(fs.readFileSync(path.join(f.ledger, 'genesis.bin'), 'utf8'), 'keep this chain');
});

test('validator recognizes Agave ledger marker without creating fixture fingerprints', (t) => {
  const f = validatorFixture(t);
  f.put(path.join(f.ledger, 'vote-account-keypair.json'), 'existing validator marker');
  assert.match(f.start().stderr, /no build fingerprint/);
  assert.equal(fs.existsSync(path.join(f.ledger, '.hash-timestamp-build')), false);
  assert.equal(fs.existsSync(path.join(f.ledger, '.proof-chain-fixture')), false);
  assert.equal(fs.existsSync(f.argsFile), false);
});
