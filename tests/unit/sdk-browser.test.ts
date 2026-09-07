import { describe, expect, it } from "vitest";
import { createHash as nodeHash } from "node:crypto";
import { File } from "node:buffer";
import { PublicKey } from "@solana/web3.js";
import { createHash } from "../../src/contract/crypto-browser";
import {
  canonicalHashId,
  deriveAccountMetadataHash,
  deriveBatchHash,
  derivePackHash,
  deriveBranchHash,
  deriveGenesisHashId,
  rpcU64,
  archiveFromProof,
  parseArchive,
  stringifyArchive,
  IDL,
} from "../../src/contract/sdk";
import { hashFile, hex, memberIds } from "../../src/features/workspace/values";

const digest = (...parts: Uint8Array[]) => {
  const h = nodeHash("sha256");
  parts.forEach((part) => h.update(part));
  return h.digest("hex");
};
const raw = new Uint8Array(32).fill(19);
const i64 = (value: bigint) => {
  const bytes = Buffer.alloc(8);
  bytes.writeBigInt64LE(value);
  return bytes;
};

describe("Browser SDK compatibility", () => {
  it("imports original Hash payloads and round-trips the SDK archive through the browser crypto adapter", () => {
    const payload = new Uint8Array([1, 2, 3]);
    const hash = nodeHash("sha256").update(payload).digest();
    const archive = archiveFromProof(IDL.address, [
      {
        hash,
        source: { kind: "hash" },
        createdAt: 100n,
        params: { kind: "hash", payload },
      },
    ]);
    expect(Object.keys(archive.nodes)).toHaveLength(1);
    expect(parseArchive(stringifyArchive(archive))).toEqual(archive);
  });
  it("hashes incrementally, including byte views and empty input, exactly like Node SHA-256", () => {
    const view = new Uint8Array([0, 1, 2, 3]).subarray(1, 3);
    expect(
      createHash("sha256").update(view).update(raw).digest().toString("hex")
    ).toBe(digest(view, raw));
    expect(createHash("sha256").digest().toString("hex")).toBe(digest());
    expect(() => createHash("sha512")).toThrow("Unsupported");
  });
  it("separates all five canonical source identities from the raw hash", () => {
    const ids = [0, 1, 2, 3, 4].map((kind) => hex(canonicalHashId(raw, kind)));
    ids.forEach((id, kind) =>
      expect(id).toBe(digest(raw, new Uint8Array([kind])))
    );
    expect(new Set(ids).size).toBe(5);
    expect(hex(deriveGenesisHashId(raw))).not.toBe(hex(raw));
  });
  it("preserves branch timestamp/generation byte framing and aggregate order", () => {
    const parent = deriveGenesisHashId(raw);
    expect(hex(deriveBranchHash(parent, -3n, 2n, 2, raw))).toBe(
      digest(parent, new Uint8Array([2]), i64(-3n), i64(2n), raw)
    );
    const members = [
      { hash: raw, kind: 0, createdAt: 11n },
      { hash: new Uint8Array(32), kind: 2, createdAt: 12n },
    ];
    const expected = digest(
      raw,
      new Uint8Array([0]),
      i64(11n),
      new Uint8Array(32),
      new Uint8Array([2]),
      i64(12n)
    );
    expect(hex(deriveBatchHash(members))).toBe(expected);
    expect(hex(derivePackHash(members))).toBe(expected);
    expect(hex(deriveBatchHash([...members].reverse()))).not.toBe(expected);
  });
  it("retains SDK u64 saturation and rejects a missing RPC rentEpoch", () => {
    expect(rpcU64(Number((1n << 64n) - 1n))).toBe((1n << 64n) - 1n);
    const key = new PublicKey(new Uint8Array(32).fill(5));
    expect(() =>
      deriveAccountMetadataHash(key, {
        owner: key,
        lamports: 1,
        data: Buffer.alloc(0),
        executable: false,
      })
    ).toThrow("missing rentEpoch");
  });
  it("hashes multi-chunk and empty files without uploading content", async () => {
    const data = new Uint8Array(2 * 1024 * 1024 + 7).fill(53);
    const progress: number[] = [];
    expect(
      await hashFile(
        new File([data], "sample.bin") as unknown as globalThis.File,
        (n) => progress.push(n)
      )
    ).toBe(digest(data));
    expect(progress.at(-1)).toBe(100);
    expect(
      await hashFile(new File([], "empty") as unknown as globalThis.File)
    ).toBe(digest());
  });
  it("rejects duplicate and malformed member IDs and keeps input order", () => {
    const a = "aa".repeat(32),
      b = "bb".repeat(32);
    expect(memberIds(`${b},\n${a}`).map(hex)).toEqual([b, a]);
    expect(() => memberIds(`${a}, ${a.toUpperCase()}`)).toThrow("unique");
    expect(() => memberIds("abcd")).toThrow();
    expect(() => memberIds("")).toThrow();
  });
  it("stops file hashing on cancellation, including before the first read", async () => {
    const file = new File(
      [new Uint8Array(4 * 1024 * 1024)],
      "large"
    ) as unknown as globalThis.File;
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(
      hashFile(file, undefined, cancelled.signal)
    ).rejects.toHaveProperty("name", "AbortError");
    const controller = new AbortController();
    const progress: number[] = [];
    await expect(
      hashFile(
        file,
        (percent) => {
          progress.push(percent);
          controller.abort();
        },
        controller.signal
      )
    ).rejects.toHaveProperty("name", "AbortError");
    expect(progress).toEqual([50]);
  });
});
