import { sha256 } from "@noble/hashes/sha256";
import {
  accountPublicKey,
  canonicalHashId,
  deriveAccountMetadataHash,
  deriveBatchHash,
  deriveBranchHash,
  derivePackHash,
  generationFromSource,
  hashSourceKindOf,
  prepareRestore,
  rpcU64,
  to32Bytes,
  toBigInt,
  toBytes,
  type RestoreHashFingerprintInput,
  type RestoreProofInput,
} from "../../contract/sdk";
import { entryId } from "./collect-proof";
import { hex } from "../workspace/values";

/** Browser preflight mirrors protocol/restore graph rules; hashes/encoding stay in the SDK.
 * This checks internal consistency, not historical existence or transaction success.
 */
export function validateProof(proof: RestoreProofInput[]) {
  if (!proof.length || proof.length > 64)
    throw new Error("Supply 1–64 proof entries.");
  prepareRestore(proof, false); // SDK wire/range validation, including all fingerprints.
  const ids = proof.map(entryId);
  if (new Set(ids).size !== ids.length)
    throw new Error(
      "Duplicate canonical IDs in proof (including historical incarnations).",
    );
  const entries = new Map(ids.map((id, index) => [id, proof[index]]));
  const dependencies = new Map<string, string[]>();
  const needsExisting: number[] = [];
  const warnings: string[] = [];
  const sameHash = (
    a: Uint8Array | number[] | string,
    b: Uint8Array | number[] | string,
  ) => hex(to32Bytes(a)) === hex(to32Bytes(b));
  const memberId = (member: RestoreHashFingerprintInput) =>
    hex(canonicalHashId(member.hash, hashSourceKindOf(member.sourceKind)));
  const checkFingerprint = (member: RestoreHashFingerprintInput) => {
    const id = memberId(member);
    const entry = entries.get(id);
    if (!entry) throw new Error(`Missing proof dependency: ${id}`);
    if (
      toBigInt(member.createdAt) !== toBigInt(entry.createdAt) ||
      toBigInt(member.generation) !== generationFromSource(entry.source)
    )
      throw new Error(`Historical fingerprint mismatch: ${id}`);
    return id;
  };
  proof.forEach((entry, index) => {
    const { source, params } = entry;
    if (toBigInt(entry.createdAt) === 0n)
      throw new Error(`Entry ${index}: timestamp cannot be zero.`);
    if (
      (!params && source.kind !== "hash") ||
      (params && params.kind !== source.kind)
    )
      throw new Error(
        `Entry ${index}: parameters must match source ${source.kind}.`,
      );
    let deps: string[] = [];
    let expected: Uint8Array | undefined;
    if (params?.kind === "hash") {
      const payload = toBytes(params.payload);
      if (!payload.length)
        throw new Error(`Entry ${index}: hash payload is empty.`);
      expected =
        payload.length === 32 && sameHash(payload, entry.hash)
          ? payload
          : sha256(payload);
    } else if (params?.kind === "branch" && source.kind === "branch") {
      const parentId = checkFingerprint(params.parent);
      if (parentId !== hex(to32Bytes(source.previousHashId)))
        throw new Error(`Entry ${index}: parent ID mismatch.`);
      if (source.generation !== toBigInt(params.parent.generation) + 1n)
        throw new Error(`Entry ${index}: branch generation mismatch.`);
      deps = [parentId];
      expected = deriveBranchHash(
        parentId,
        params.parent.createdAt,
        params.parent.generation,
        hashSourceKindOf(params.parent.sourceKind),
        source.payload,
      );
    } else if (
      (params?.kind === "batch" || params?.kind === "pack") &&
      (source.kind === "batch" || source.kind === "pack")
    ) {
      if (!params.members.length)
        throw new Error(`Entry ${index}: members cannot be empty.`);
      deps = params.members.map(checkFingerprint);
      if (new Set(deps).size !== deps.length)
        throw new Error(`Entry ${index}: duplicate members.`);
      if (
        source.kind === "batch" &&
        JSON.stringify(deps) !==
          JSON.stringify(source.members.map((member) => hex(to32Bytes(member))))
      )
        throw new Error(`Entry ${index}: ordered batch members mismatch.`);
      const members = params.members.map((member) => ({
        hash: member.hash,
        kind: hashSourceKindOf(member.sourceKind),
        createdAt: member.createdAt,
      }));
      expected =
        params.kind === "batch"
          ? deriveBatchHash(members)
          : derivePackHash(members);
    } else if (params?.kind === "account" && source.kind === "account") {
      if (!params.snapshot) needsExisting.push(index);
      else {
        const snapshot = params.snapshot;
        const lamports = Number(toBigInt(snapshot.lamports));
        const rentEpoch = Number(toBigInt(snapshot.rentEpoch));
        // The RPC-shaped SDK helper accepts numbers. Never round a retained u64 silently.
        if (
          rpcU64(lamports) !== toBigInt(snapshot.lamports) ||
          rpcU64(rentEpoch) !== toBigInt(snapshot.rentEpoch)
        )
          warnings.push(
            `Entry ${index}: snapshot integers exceed the SDK's exact numeric representation; its digest still needs on-chain validation.`,
          );
        else
          expected = deriveAccountMetadataHash(
            accountPublicKey(source.account),
            {
              owner: accountPublicKey(snapshot.owner),
              lamports,
              rentEpoch,
              executable: snapshot.executable,
              data: Buffer.from(snapshot.data),
            },
          );
      }
    }
    if (expected && !sameHash(expected, entry.hash))
      throw new Error(`Entry ${index}: hash commitment mismatch.`);
    dependencies.set(ids[index], deps);
  });
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error("Cyclic proof dependencies.");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of dependencies.get(id)!) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  visit(ids[0]);
  if (visited.size !== proof.length)
    throw new Error(
      "Proof contains entries disconnected from the anchor at index zero.",
    );
  return { ids, needsExisting, warnings };
}
