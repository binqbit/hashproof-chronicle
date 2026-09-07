import { describe, expect, it, vi } from "vitest";
import { BN } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { createReadClient, PROGRAM_ID } from "../../src/contract/client";
import {
  canonicalHashId,
  deriveAccountMetadataHash,
  deriveBranchHash,
  to32Bytes,
  type RestoreProofInput,
  type HashAccountData,
} from "../../src/contract/sdk";
import {
  collectProof,
  entryId,
  mergeHistory,
} from "../../src/features/history/collect-proof";
import { parseProof, proofJson } from "../../src/features/history/proof-format";
import { hex } from "../../src/features/workspace/values";

const raw = new Uint8Array(32).fill(9);
const root: RestoreProofInput = {
  hash: raw,
  source: { kind: "hash" },
  createdAt: 11n,
  params: { kind: "hash", payload: raw },
};
const rpc = "http://127.0.0.1:8899";
function record(
  hash: Uint8Array,
  source: HashAccountData["source"],
  createdAt = 12,
): HashAccountData {
  return {
    hash: [...hash],
    source,
    createdAt: new BN(createdAt),
    voters: new BN(1),
    bump: 1,
  };
}

describe("Portable proofs and retained history", () => {
  it("round-trips hashes, keys, snapshots and full-width integers losslessly", () => {
    const key = new PublicKey(raw);
    const entry: RestoreProofInput = {
      hash: raw,
      source: { kind: "account", account: key },
      createdAt: -5n,
      params: {
        kind: "account",
        snapshot: {
          owner: key,
          lamports: (1n << 64n) - 1n,
          rentEpoch: new BN("18446744073709551615"),
          executable: false,
          data: new Uint8Array([0, 255]),
        },
      },
    };
    const output = parseProof(
      proofJson([entry], PROGRAM_ID.toBase58(), rpc),
    )[0];
    expect(output.createdAt).toBe(-5n);
    expect(output.params?.kind).toBe("account");
    if (output.params?.kind !== "account")
      throw new Error("Wrong snapshot kind");
    expect(output.params.snapshot?.lamports).toBe(18446744073709551615n);
    expect(output.params.snapshot?.rentEpoch).toBe(18446744073709551615n);
    expect(output.params.snapshot?.data).toEqual([0, 255]);
  });
  it.each([0, 1.1, 9007199254740992, "9223372036854775808", "not a number"])(
    "rejects invalid timestamps: %s",
    (createdAt) => {
      expect(() =>
        parseProof(
          JSON.stringify([
            { hash: hex(raw), source: { kind: "hash" }, createdAt },
          ]),
        ),
      ).toThrow();
    },
  );
  it("rejects unknown fields, malformed bytes, unknown sources and oversized imports", () => {
    for (const change of [
      { hash: "0x" + hex(raw) },
      { hash: [256] },
      { source: { kind: "unknown" } },
      { extra: true },
    ]) {
      expect(() =>
        parseProof(
          JSON.stringify([
            {
              hash: hex(raw),
              createdAt: "1",
              source: { kind: "hash" },
              ...change,
            },
          ]),
        ),
      ).toThrow();
    }
    expect(() => parseProof(" ".repeat(2_000_001))).toThrow("2 MB");
  });
  it("preserves existing parameters when merging metadata and refuses conflicting incarnations", () => {
    expect(
      mergeHistory([root], [{ ...root, params: undefined }])[0].params,
    ).toEqual(root.params);
    expect(() => mergeHistory([root], [{ ...root, createdAt: 13n }])).toThrow(
      "Conflicting",
    );
  });
  it("uses retained parent history after closure, with the live child at index zero", async () => {
    const client = createReadClient(new Connection(rpc));
    const parentId = to32Bytes(entryId(root));
    const childHash = deriveBranchHash(parentId, root.createdAt, 0n, 0, raw);
    const childId = hex(canonicalHashId(childHash, 2));
    const read = vi
      .spyOn(client, "fetchHashAccount")
      .mockImplementation(async (id) =>
        hex(to32Bytes(id)) === childId
          ? record(childHash, {
              branch: {
                previousHashId: [...parentId],
                payload: [...raw],
                generation: new BN(1),
              },
            })
          : null,
      );
    const proof = await collectProof(client, childId, [root]);
    expect(proof.map(entryId)).toEqual([childId, entryId(root)]);
    expect(read).toHaveBeenCalledTimes(1);
    await expect(
      collectProof(client, childId, [{ ...root, createdAt: 99n }]),
    ).rejects.toThrow("fingerprints");
  });
  it("does not fabricate pack membership or historical account snapshots", async () => {
    const client = createReadClient(new Connection(rpc));
    vi.spyOn(client, "fetchHashAccount").mockResolvedValue(
      record(raw, { pack: {} }),
    );
    await expect(
      collectProof(client, hex(canonicalHashId(raw, 4))),
    ).rejects.toThrow("membership");
    vi.spyOn(client, "fetchHashAccount").mockResolvedValue(
      record(raw, { account: { account: new PublicKey(raw) } }),
    );
    vi.spyOn(client.connection, "getAccountInfo").mockResolvedValue(null);
    await expect(
      collectProof(client, hex(canonicalHashId(raw, 1))),
    ).rejects.toThrow("snapshot changed");
  });
  it("exports the RPC u64 rentEpoch sentinel in a re-importable snapshot", async () => {
    const client = createReadClient(new Connection(rpc));
    const target = new PublicKey(raw);
    const info = {
      owner: target,
      lamports: 1,
      rentEpoch: Number((1n << 64n) - 1n),
      data: Buffer.from([1]),
      executable: false,
    };
    const hash = deriveAccountMetadataHash(target, info);
    vi.spyOn(client.connection, "getAccountInfo").mockResolvedValue(info);
    vi.spyOn(client, "fetchHashAccount").mockResolvedValue(
      record(hash, { account: { account: target } }),
    );
    const proof = await collectProof(client, hex(canonicalHashId(hash, 1)));
    expect(
      parseProof(proofJson(proof, PROGRAM_ID.toBase58(), rpc)),
    ).toHaveLength(1);
  });
});
