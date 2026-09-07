import { describe, expect, it, vi } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  archiveFromProof,
  createArchive,
  IDL,
  mergeArchives,
  parseArchive,
  stringifyArchive,
} from "../../src/contract/sdk";
import {
  mergeProofFiles,
  MAX_PROOF_FILE_BYTES,
  MAX_PROOF_TOTAL_BYTES,
  validateProofFiles,
} from "../../src/features/history/archive-files";
import { proofJson } from "../../src/features/history/proof-format";
import { archivedHash, hashArchive } from "./fixtures/archives";

const file = (json: string, name = "proof.json") =>
  new File([json], name, { type: "application/json" });
const archiveFile = (seed: number) =>
  file(stringifyArchive(hashArchive(seed)), `${seed}.json`);

describe("Local proof-file merging", () => {
  it("combines disjoint archives and deduplicates repeated nodes into canonical JSON", async () => {
    const result = await mergeProofFiles(
      [archiveFile(1), archiveFile(2), archiveFile(1)],
      IDL.address,
    );
    expect(result.archive).toEqual(
      mergeArchives(hashArchive(1), hashArchive(2)),
    );
    expect(parseArchive(result.json)).toEqual(result.archive);
    expect(result.inputNodes).toBe(3);
    expect(result.convertedFiles).toBe(0);
    expect(result.inspection.complete).toBe(true);
  });
  it("converts legacy envelopes and arrays while preserving the envelope program identity", async () => {
    const legacy = proofJson(
      [archivedHash(1)],
      IDL.address,
      "http://other-network.invalid",
    );
    const plain = JSON.stringify([
      { hash: "02".repeat(32), source: { kind: "hash" }, createdAt: "100" },
    ]);
    const result = await mergeProofFiles(
      [file(legacy), file(plain), archiveFile(3)],
      IDL.address,
    );
    expect(result.archive).toEqual(
      mergeArchives(hashArchive(1), hashArchive(2), hashArchive(3)),
    );
    expect(result.convertedFiles).toBe(2);
    expect(result.json).not.toContain("rpc");
    await expect(
      mergeProofFiles(
        [
          file(
            proofJson(
              [archivedHash(1)],
              PublicKey.default.toBase58(),
              "http://other.invalid",
            ),
          ),
          archiveFile(2),
        ],
        IDL.address,
      ),
    ).rejects.toThrow("different programs");
  });
  it("keeps partial archives exportable without claiming a complete history", async () => {
    const partial = archiveFromProof(IDL.address, [
      {
        hash: new Uint8Array(32).fill(3),
        source: { kind: "pack" },
        createdAt: 101n,
      },
    ]);
    const result = await mergeProofFiles(
      [file(stringifyArchive(partial)), archiveFile(1)],
      IDL.address,
    );
    expect(result.inspection.complete).toBe(false);
    expect(result.inspection.missingWitnesses).toHaveLength(1);
    expect(parseArchive(result.json)).toEqual(result.archive);
  });
  it("rejects conflicting timestamps and program identities without changing source data", async () => {
    const original = archiveFile(1);
    await expect(
      mergeProofFiles(
        [original, file(stringifyArchive(hashArchive(1, 200n)))],
        IDL.address,
      ),
    ).rejects.toThrow("Conflicting historical incarnation");
    expect(await original.text()).toBe(stringifyArchive(hashArchive(1)));
    await expect(
      mergeProofFiles(
        [original, file(stringifyArchive(createArchive(PublicKey.default)))],
        IDL.address,
      ),
    ).rejects.toThrow("different programs");
  });
  it("retains raw JSON duplicate-key validation and names the invalid input file", async () => {
    const json = JSON.stringify(hashArchive(1));
    await expect(
      mergeProofFiles(
        [
          archiveFile(2),
          file(
            json.replace('"version":1', '"version":1,"version":1'),
            "duplicate.json",
          ),
        ],
        IDL.address,
      ),
    ).rejects.toThrow("duplicate.json: Duplicate JSON key");
    await expect(
      mergeProofFiles([archiveFile(1), file("{", "broken.json")], IDL.address),
    ).rejects.toThrow("broken.json:");
  });
  it("checks count and byte budgets before reading any files", async () => {
    const oversized = archiveFile(1);
    Object.defineProperty(oversized, "size", {
      value: MAX_PROOF_FILE_BYTES + 1,
    });
    const read = vi.spyOn(oversized, "text");
    await expect(
      mergeProofFiles([oversized, archiveFile(2)], IDL.address),
    ).rejects.toThrow("16 MiB");
    expect(read).not.toHaveBeenCalled();
    await expect(
      mergeProofFiles([archiveFile(1)], IDL.address),
    ).rejects.toThrow("at least two");
    expect(() =>
      validateProofFiles(Array(33).fill({ name: "small.json", size: 0 })),
    ).toThrow("32 files");
    expect(() =>
      validateProofFiles(
        Array(3).fill({
          name: "large.json",
          size: MAX_PROOF_TOTAL_BYTES / 3 + 1,
        }),
      ),
    ).toThrow("32 MiB in total");
  });
  it("stops reading further files after cancellation", async () => {
    const controller = new AbortController();
    const first = archiveFile(1),
      second = archiveFile(2);
    vi.spyOn(first, "text").mockImplementation(async () => {
      controller.abort();
      return stringifyArchive(hashArchive(1));
    });
    const read = vi.spyOn(second, "text");
    await expect(
      mergeProofFiles([first, second], IDL.address, controller.signal),
    ).rejects.toHaveProperty("name", "AbortError");
    expect(read).not.toHaveBeenCalled();
  });
});
