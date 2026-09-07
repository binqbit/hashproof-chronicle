import { expect, it } from "vitest";
import {
  archiveFromProof,
  deriveBatchHash,
  derivePackHash,
  IDL,
  type RestoreProofInput,
} from "../../src/contract/sdk";
import {
  checkFileProof,
  findFileInArchive,
} from "../../src/features/history/file-proof";
import { entryId, fingerprint } from "../../src/features/history/collect-proof";
import { hex } from "../../src/features/workspace/values";
import {
  branchEntry,
  bytes,
  hashEntry,
  recordFixture,
} from "./fixtures/records";

function group(
  kind: "batch" | "pack",
  entries: RestoreProofInput[],
  createdAt: bigint,
): RestoreProofInput {
  const members = entries.map(fingerprint);
  const inputs = members.map((member) => ({
    hash: member.hash,
    kind: Number(member.sourceKind),
    createdAt: member.createdAt,
  }));
  return {
    hash: kind === "batch" ? deriveBatchHash(inputs) : derivePackHash(inputs),
    source:
      kind === "batch" ? { kind, members: entries.map(entryId) } : { kind },
    createdAt,
    params: { kind, members },
  };
}

function nestedHistory() {
  const root = hashEntry();
  const branch = branchEntry(root);
  const batch = group("batch", [branch, root], 300n);
  const pack = group("pack", [batch], 400n);
  const outer = group("batch", [pack], 500n);
  return {
    root,
    branch,
    batch,
    pack,
    outer,
    archive: archiveFromProof(IDL.address, [root, branch, batch, pack, outer]),
  };
}

it("finds file payloads throughout nested branches and groups, keeping their own timestamps", () => {
  const { archive } = nestedHistory();
  expect(
    findFileInArchive(archive, hex(bytes(1))).matches.map(
      ({ kind, createdAt }) => ({ kind, createdAt }),
    ),
  ).toEqual([{ kind: "hash", createdAt: "100" }]);
  expect(
    findFileInArchive(archive, hex(bytes(2))).matches.map(
      ({ kind, createdAt }) => ({ kind, createdAt }),
    ),
  ).toEqual([{ kind: "branch", createdAt: "200" }]);
  expect(findFileInArchive(archive, hex(bytes(99))).matches).toEqual([]);
});

it("never interprets derived branch/group digests or account metadata as a file payload", () => {
  const { archive, branch, batch, pack } = nestedHistory();
  for (const entry of [branch, batch, pack])
    expect(
      findFileInArchive(archive, hex(entry.hash as Uint8Array)).matches,
    ).toEqual([]);
  const account: RestoreProofInput = {
    hash: bytes(44),
    source: { kind: "account", account: bytes(55) },
    createdAt: 100n,
  };
  expect(
    findFileInArchive(archiveFromProof(IDL.address, [account]), hex(bytes(44)))
      .matches,
  ).toEqual([]);
});

it("returns repeated file versions in exact timestamp order, without a global earliest-time claim", () => {
  const root = hashEntry(1, 9007199254740992n);
  const first = { ...branchEntry(root, 1), createdAt: 9007199254740993n };
  const second = { ...branchEntry(first, 1), createdAt: 9007199254740994n };
  const archive = archiveFromProof(IDL.address, [second, root, first]);
  expect(
    findFileInArchive(archive, hex(bytes(1))).matches.map(
      (match) => match.createdAt,
    ),
  ).toEqual(["9007199254740992", "9007199254740993", "9007199254740994"]);
});

it("confirms a deleted or recreated file record through a live nested aggregate", async () => {
  const f = recordFixture();
  const { archive, root, outer } = nestedHistory();
  await f.put(outer);
  const target = f.client.hashPda(entryId(root)).toBase58();
  const found = await checkFileProof(f.client, archive, hex(bytes(1)), target);
  expect(found.matched).toBe(true);
  expect(found.anchor).toBe(f.client.hashPda(entryId(outer)).toBase58());
  await f.put({ ...root, createdAt: 999n });
  expect(
    (await checkFileProof(f.client, archive, hex(bytes(1)), target)).matched,
  ).toBe(true);
  expect(findFileInArchive(archive, hex(bytes(1))).matches[0].createdAt).toBe(
    "100",
  );
});

it("does not confirm a partial aggregate, even when its live record matches", async () => {
  const f = recordFixture();
  const root = hashEntry(),
    sibling = hashEntry(9);
  const pack = group("pack", [root, sibling], 300n);
  const archive = archiveFromProof(IDL.address, [pack, root, sibling]);
  delete archive.nodes[f.client.hashPda(entryId(sibling)).toBase58()];
  await f.put(pack);
  const found = await checkFileProof(
    f.client,
    archive,
    hex(bytes(1)),
    f.client.hashPda(entryId(root)).toBase58(),
  );
  expect(found.matched).toBe(false);
  expect(found.message).toContain("Missing archive node");
});

it("confirms a complete path despite unrelated partial records and an earlier read error", async () => {
  const f = recordFixture();
  const { archive, root, outer } = nestedHistory();
  const unrelated = archiveFromProof(IDL.address, [
    { hash: bytes(88), source: { kind: "pack" }, createdAt: 600n },
  ]);
  Object.assign(archive.nodes, unrelated.nodes);
  await f.put(outer);
  f.read.mockRejectedValueOnce(new Error("Temporary read failure"));
  const target = f.client.hashPda(entryId(root)).toBase58();
  expect(findFileInArchive(archive, hex(bytes(1))).inspection.complete).toBe(
    false,
  );
  expect(
    (await checkFileProof(f.client, archive, hex(bytes(1)), target)).matched,
  ).toBe(true);
});

it("confirms the payload of a live branch with unavailable parents, but rejects a different incarnation", async () => {
  const f = recordFixture();
  const branch = branchEntry(hashEntry());
  const archive = archiveFromProof(IDL.address, [
    { ...branch, params: undefined },
  ]);
  const target = await f.put(branch);
  expect(
    (await checkFileProof(f.client, archive, hex(bytes(2)), target.toBase58()))
      .matched,
  ).toBe(true);
  await f.put({ ...branch, createdAt: 777n });
  expect(
    (await checkFileProof(f.client, archive, hex(bytes(2)), target.toBase58()))
      .matched,
  ).toBe(false);
});

it("rejects tampered history, and does not turn RPC failures into absence claims", async () => {
  const f = recordFixture();
  const { archive, root } = nestedHistory();
  const target = f.client.hashPda(entryId(root)).toBase58();
  f.read.mockRejectedValue(new Error("RPC offline"));
  const result = await checkFileProof(f.client, archive, hex(bytes(1)), target);
  expect(result.matched).toBe(false);
  expect(result.message).toContain("RPC offline");
  expect(result.message).toContain("does not mean the file never existed");
  archive.nodes[target].createdAt = "101";
  expect(() => findFileInArchive(archive, hex(bytes(1)))).toThrow(
    "commitment mismatch",
  );
});

it("does not authenticate a forged branch payload through an incomplete later group", async () => {
  const f = recordFixture();
  const root = hashEntry(),
    branch = branchEntry(root);
  const pack = group("pack", [branch], 300n);
  const archive = archiveFromProof(IDL.address, [root, branch, pack]);
  const target = f.client.hashPda(entryId(branch)).toBase58();
  delete archive.nodes[f.client.hashPda(entryId(root)).toBase58()];
  const source = archive.nodes[target].source;
  if (source.kind !== "branch") throw new Error("Expected branch fixture");
  source.payload = hex(bytes(99));
  await f.put(pack);
  expect(findFileInArchive(archive, hex(bytes(99))).matches).toHaveLength(1);
  expect(
    (await checkFileProof(f.client, archive, hex(bytes(99)), target)).matched,
  ).toBe(false);
});

it("bounds network reads and stops cancelled checks", async () => {
  const f = recordFixture();
  const root = hashEntry();
  const branches = Array.from({ length: 40 }, (_, index) =>
    branchEntry(root, index + 2),
  );
  const archive = archiveFromProof(IDL.address, [root, ...branches]);
  const target = f.client.hashPda(entryId(root)).toBase58();
  const result = await checkFileProof(f.client, archive, hex(bytes(1)), target);
  expect(result.checked).toBe(32);
  expect(f.read).toHaveBeenCalledTimes(32);
  expect(result.message).toContain("Only the first 32");
  const controller = new AbortController();
  controller.abort();
  await expect(
    checkFileProof(f.client, archive, hex(bytes(1)), target, controller.signal),
  ).rejects.toThrow();
  expect(f.read).toHaveBeenCalledTimes(32);
});
