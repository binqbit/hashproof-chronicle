import { PublicKey } from "@solana/web3.js";
import {
  archiveFromProof,
  canonicalHashId,
  deriveBatchHash,
  deriveBranchHash,
  deriveHashPda,
  derivePackHash,
  IDL,
  type RestoreProofInput,
} from "../../src/contract/sdk";

export const idOf = (entry: RestoreProofInput) =>
  canonicalHashId(entry.hash, entry.source);
export const pdaOf = (entry: RestoreProofInput, program: string = IDL.address) =>
  deriveHashPda(new PublicKey(program), idOf(entry)).toBase58();
const kindOf = (entry: RestoreProofInput) =>
  (({ hash: 0, account: 1, branch: 2, batch: 3, pack: 4 }) as const)[
    entry.source.kind
  ];
const fingerprint = (entry: RestoreProofInput) => ({
  hash: entry.hash,
  sourceKind: kindOf(entry),
  createdAt: entry.createdAt,
  generation: entry.source.kind === "branch" ? entry.source.generation : 0n,
});

export const fileRecord = (
  seed: number,
  createdAt = 1700000000n,
): RestoreProofInput => ({
  hash: new Uint8Array(32).fill(seed),
  source: { kind: "hash" },
  createdAt,
});
export function version(
  parent: RestoreProofInput,
  seed: number,
  createdAt = 1700000001n,
): RestoreProofInput {
  const payload = new Uint8Array(32).fill(seed);
  const previous = fingerprint(parent);
  return {
    hash: deriveBranchHash(
      idOf(parent),
      parent.createdAt,
      previous.generation,
      previous.sourceKind,
      payload,
    ),
    source: {
      kind: "branch",
      previousHashId: idOf(parent),
      payload,
      generation: BigInt(previous.generation.toString()) + 1n,
    },
    createdAt,
    params: { kind: "branch", parent: previous },
  };
}
export function aggregate(
  kind: "batch" | "pack",
  entries: RestoreProofInput[],
  createdAt = 1700000002n,
): RestoreProofInput {
  const members = entries.map(fingerprint);
  const inputs = members.map((member) => ({
    ...member,
    kind: member.sourceKind,
  }));
  return {
    hash: kind === "batch" ? deriveBatchHash(inputs) : derivePackHash(inputs),
    source: kind === "batch" ? { kind, members: entries.map(idOf) } : { kind },
    createdAt,
    params: { kind, members },
  };
}
export function proofForest() {
  const first = fileRecord(1),
    second = fileRecord(2);
  const branch = version(first, 3),
    sibling = version(first, 4);
  const batch = aggregate("batch", [branch, second]);
  const pack = aggregate("pack", [batch], 1700000003n);
  const unrelated = fileRecord(9);
  return {
    first,
    second,
    branch,
    sibling,
    batch,
    pack,
    unrelated,
    archive: archiveFromProof(IDL.address, [
      first,
      second,
      branch,
      sibling,
      batch,
      pack,
      unrelated,
    ]),
  };
}
