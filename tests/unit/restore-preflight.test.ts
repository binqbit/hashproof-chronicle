import { describe, expect, it, vi } from "vitest";
import { sha256 } from "@noble/hashes/sha256";
import { PublicKey } from "@solana/web3.js";
import {
  deriveBatchHash,
  deriveAccountMetadataHash,
  type RestoreProofInput,
} from "../../src/contract/sdk";
import { validateProof } from "../../src/features/history/validate-proof";
import { checkRestore } from "../../src/features/history/check-restore";
import { entryId, fingerprint } from "../../src/features/history/collect-proof";
import { restore } from "../../src/features/workspace/operations";
import {
  branchEntry,
  bytes,
  hashEntry,
  recordFixture,
} from "./fixtures/records";

describe("Proof consistency", () => {
  it("accepts an unordered dependency graph while keeping the anchor first", () => {
    const a = hashEntry(1),
      b = hashEntry(2),
      branch = branchEntry(a);
    const members = [branch, b];
    const batch: RestoreProofInput = {
      hash: deriveBatchHash(
        members.map((e) => ({
          hash: e.hash,
          kind: Number(fingerprint(e).sourceKind),
          createdAt: e.createdAt,
        })),
      ),
      createdAt: 300n,
      source: { kind: "batch", members: members.map(entryId) },
      params: { kind: "batch", members: members.map(fingerprint) },
    };
    expect(validateProof([batch, a, b, branch]).ids).toEqual(
      [batch, a, b, branch].map(entryId),
    );
  });
  it("rejects duplicate IDs, disconnected entries, missing dependencies and wrong parameters", () => {
    const parent = hashEntry(),
      child = branchEntry(parent);
    expect(() => validateProof([parent, parent])).toThrow("Duplicate");
    expect(() => validateProof([parent, hashEntry(9)])).toThrow("disconnected");
    expect(() => validateProof([child])).toThrow("Missing proof dependency");
    expect(() => validateProof([{ ...child, params: null }, parent])).toThrow(
      "parameters",
    );
    expect(() => validateProof([{ ...parent, createdAt: 0n }])).toThrow(
      "timestamp",
    );
  });
  it("rejects altered timestamps, generations and payload commitments", () => {
    const parent = hashEntry(),
      child = branchEntry(parent);
    expect(() => validateProof([child, { ...parent, createdAt: 7n }])).toThrow(
      "fingerprint",
    );
    if (child.source.kind !== "branch") throw new Error("fixture");
    const source = child.source;
    expect(() =>
      validateProof([
          { ...child, source: { ...source, generation: 8n } },
        parent,
      ]),
    ).toThrow("generation");
    expect(() =>
      validateProof([
        { ...parent, params: { kind: "hash", payload: bytes(8) } },
      ]),
    ).toThrow("commitment");
  });
  it("validates account snapshots without silently rounding full-width integers", () => {
    const target = new PublicKey(bytes(3));
    const info = {
      owner: target,
      lamports: 20,
      executable: false,
      rentEpoch: Number((1n << 64n) - 1n),
      data: Buffer.from([1, 2]),
    };
    const entry: RestoreProofInput = {
      hash: deriveAccountMetadataHash(target, info),
      source: { kind: "account", account: target },
      createdAt: 100n,
      params: {
        kind: "account",
        snapshot: { ...info, rentEpoch: (1n << 64n) - 1n },
      },
    };
    expect(validateProof([entry]).warnings).toEqual([]);
    if (entry.params?.kind !== "account") throw new Error("fixture");
    expect(() => validateProof([{ ...entry, hash: bytes(8) }])).toThrow(
      "commitment",
    );
    const imprecise = {
      ...entry,
      params: {
        kind: "account" as const,
        snapshot: { ...entry.params.snapshot!, lamports: 9007199254740993n },
      },
    };
    expect(validateProof([imprecise]).warnings[0]).toContain(
      "on-chain validation",
    );
  });
});

describe("Restore live-state preflight", () => {
  it("checks a live anchor and previews missing materialization without transactions", async () => {
    const f = recordFixture(),
      parent = hashEntry(),
      child = branchEntry(parent);
    await f.put(child);
    const result = await checkRestore(f.client, [child, parent], true);
    expect(result.errors).toEqual([]);
    expect(result.nodes.map((n) => n.state)).toEqual([
      "Live anchor matches",
      "Will be recreated",
    ]);
    expect(result.transactionBytes).toBeLessThanOrEqual(1232);
  });
  it("blocks conflicting recreation but permits proof-only historical validation", async () => {
    const f = recordFixture(),
      parent = hashEntry(),
      child = branchEntry(parent);
    await f.put(child);
    await f.put({ ...parent, createdAt: 999n });
    expect(
      (await checkRestore(f.client, [child, parent], false)).errors,
    ).toEqual([]);
    expect(
      (await checkRestore(f.client, [child, parent], true)).errors.join(),
    ).toContain("incarnation conflict");
  });
  it("blocks missing and mismatched anchors before submitting", async () => {
    const f = recordFixture(),
      parent = hashEntry();
    const send = vi.spyOn(f.client, "restore");
    await expect(restore(f.client, [parent], false)).rejects.toThrow(
      "live anchor",
    );
    await f.put({ ...parent, createdAt: 1n });
    expect(
      (await checkRestore(f.client, [parent], false)).errors.join(),
    ).toContain("live anchor");
    expect(send).not.toHaveBeenCalled();
  });
  it("does not accept snapshot-free account ancestors merely because they are live on RPC", async () => {
    const f = recordFixture();
    const account: RestoreProofInput = {
      hash: bytes(5),
      createdAt: 100n,
      source: { kind: "account", account: PublicKey.default },
      params: { kind: "account" },
    };
    const child = branchEntry(account);
    await f.put(account);
    await f.put(child);
    expect(
      (await checkRestore(f.client, [child, account], false)).errors.join(),
    ).toContain("snapshot required");
    expect(
      (await checkRestore(f.client, [child, account], true)).errors,
    ).toEqual([]);
  });
  it("reports RPC failures and oversized transactions without signing", async () => {
    const f = recordFixture();
    const payload = new Uint8Array(2400).fill(3);
    const entry: RestoreProofInput = {
      hash: sha256(payload),
      source: { kind: "hash" },
      createdAt: 1n,
      params: { kind: "hash", payload },
    };
    await f.put(entry);
    expect(
      (await checkRestore(f.client, [entry], false)).errors.join(),
    ).toContain("single transaction");
    f.read.mockRejectedValue(new Error("RPC offline"));
    expect(
      (await checkRestore(f.client, [hashEntry()], false)).errors.join(),
    ).toContain("RPC offline");
  });
});
