import { PublicKey } from "@solana/web3.js";
import {
  HashTimestampClient,
  canonicalHashId,
  decodeHashSource,
  encodeHashSource,
  generationFromSource,
  hashSourceKindOf,
  deriveBranchHash,
  deriveBatchHash,
  derivePackHash,
  deriveAccountMetadataHash,
  to32Bytes,
  toBigInt,
  rpcU64,
} from "../../contract/sdk";
import type {
  HashAccountData,
  RestoreProofInput,
  RestoreHashFingerprintInput,
} from "../../contract/sdk";
import { hex } from "../workspace/values";

export const entryId = (entry: RestoreProofInput) =>
  hex(canonicalHashId(entry.hash, entry.source));
export function fingerprint(
  entry: RestoreProofInput,
): RestoreHashFingerprintInput {
  return {
    hash: entry.hash,
    sourceKind: hashSourceKindOf(entry.source),
    createdAt: entry.createdAt,
    generation: generationFromSource(entry.source),
  };
}
export function recordEntry(record: HashAccountData): RestoreProofInput {
  return {
    hash: record.hash,
    source: decodeHashSource(record.source),
    createdAt: BigInt(record.createdAt.toString()),
  };
}

/** Imported history describes one incarnation, not every later record at the same PDA. */
export function assertMatchingHistory(
  record: HashAccountData,
  entry: RestoreProofInput,
) {
  if (
    hex(record.hash) !== hex(to32Bytes(entry.hash)) ||
    toBigInt(record.createdAt) !== toBigInt(entry.createdAt) ||
    JSON.stringify(encodeHashSource(decodeHashSource(record.source))) !==
      JSON.stringify(encodeHashSource(entry.source))
  )
    throw new Error(
      `Record ${entryId(
        entry,
      )} no longer matches the imported history. Use a proof for its current record.`,
    );
}

export function mergeHistory(...proofs: RestoreProofInput[][]) {
  const entries = new Map<string, RestoreProofInput>();
  for (const proof of proofs)
    for (const entry of proof) {
      const key = entryId(entry);
      const previous = entries.get(key);
      if (
        previous &&
        toBigInt(previous.createdAt) !== toBigInt(entry.createdAt)
      )
        throw new Error(
          "Conflicting historical incarnations. Keep these proofs separately.",
        );
      entries.set(key, { ...entry, params: entry.params ?? previous?.params });
    }
  return [...entries.values()];
}

/** Application history collection only; all identities/digests are delegated to the SDK. */
export async function collectProof(
  client: HashTimestampClient,
  rootId: string,
  history: RestoreProofInput[] = [],
) {
  const retained = new Map(history.map((entry) => [entryId(entry), entry]));
  const complete = new Map<string, RestoreProofInput>();
  const active = new Set<string>();
  const visit = async (
    id: string,
    root = false,
  ): Promise<RestoreProofInput> => {
    if (complete.has(id)) return complete.get(id)!;
    if (active.has(id)) throw new Error("Cyclic proof history.");
    if (active.size + complete.size >= 32)
      throw new Error("Proof exceeds the UI collection limit of 32 records.");
    active.add(id);
    let entry = !root ? retained.get(id) : undefined;
    if (!entry) {
      const account = await client.fetchHashAccount(id);
      if (!account)
        throw new Error(
          `Missing historical record ${id}. Import its retained proof first.`,
        );
      entry = recordEntry(account);
    }
    if (entryId(entry) !== id)
      throw new Error("Record does not match its canonical ID.");
    const source = entry.source;
    let params: RestoreProofInput["params"];
    let expected: Uint8Array | undefined;
    switch (source.kind) {
      case "hash":
        params = { kind: "hash", payload: entry.hash };
        break;
      case "account": {
        const saved = retained.get(id);
        if (saved?.params?.kind === "account" && saved.params.snapshot) {
          params = saved.params;
          break;
        }
        const target =
          source.account instanceof PublicKey
            ? source.account
            : new PublicKey(to32Bytes(source.account));
        const info = await client.connection.getAccountInfo(target);
        if (
          !info ||
          info.rentEpoch === undefined ||
          hex(deriveAccountMetadataHash(target, info)) !==
            hex(to32Bytes(entry.hash))
        ) {
          throw new Error(
            "The account snapshot changed. Import the original snapshot proof.",
          );
        }
        params = {
          kind: "account",
          snapshot: {
            owner: info.owner,
            lamports: rpcU64(info.lamports),
            executable: info.executable,
            rentEpoch: rpcU64(info.rentEpoch),
            data: info.data,
          },
        };
        break;
      }
      case "branch": {
        const parent = await visit(hex(to32Bytes(source.previousHashId)));
        const parentFingerprint = fingerprint(parent);
        params = { kind: "branch", parent: parentFingerprint };
        if (source.generation !== generationFromSource(parent.source) + 1n)
          throw new Error("Branch generation conflicts with retained history.");
        expected = deriveBranchHash(
          source.previousHashId,
          parent.createdAt,
          parentFingerprint.generation,
          hashSourceKindOf(parent.source),
          source.payload,
        );
        break;
      }
      case "batch":
      case "pack": {
        const saved = retained.get(id);
        const packed =
          saved?.params?.kind === "pack" ? saved.params.members : undefined;
        if (source.kind === "pack" && !packed)
          throw new Error(
            "Pack membership is not stored on-chain. Import its retained proof.",
          );
        const ids =
          source.kind === "batch"
            ? source.members.map((member) => hex(to32Bytes(member)))
            : packed!.map((member) =>
                hex(
                  canonicalHashId(
                    member.hash,
                    hashSourceKindOf(member.sourceKind),
                  ),
                ),
              );
        const members = [];
        for (const memberId of ids)
          members.push(fingerprint(await visit(memberId)));
        params = { kind: source.kind, members };
        const digestMembers = members.map((member) => ({
          hash: member.hash,
          kind: hashSourceKindOf(member.sourceKind),
          createdAt: member.createdAt,
        }));
        expected =
          source.kind === "batch"
            ? deriveBatchHash(digestMembers)
            : derivePackHash(digestMembers);
        break;
      }
    }
    if (expected && hex(expected) !== hex(to32Bytes(entry.hash)))
      throw new Error(
        "Historical fingerprints do not match the committed record.",
      );
    const result = { ...entry, params };
    complete.set(id, result);
    active.delete(id);
    return result;
  };
  const root = await visit(rootId, true);
  return [
    root,
    ...[...complete.entries()]
      .filter(([id]) => id !== rootId)
      .map(([, entry]) => entry),
  ];
}
