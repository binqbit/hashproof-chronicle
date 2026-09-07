import {
  archiveFromProof,
  IDL,
  type RestoreProofInput,
} from "../../../src/contract/sdk";

export function archivedHash(
  seed: number,
  createdAt = 100n,
): RestoreProofInput {
  return {
    hash: new Uint8Array(32).fill(seed),
    source: { kind: "hash" },
    createdAt,
  };
}

export function hashArchive(seed: number, createdAt = 100n) {
  return archiveFromProof(IDL.address, [archivedHash(seed, createdAt)]);
}
