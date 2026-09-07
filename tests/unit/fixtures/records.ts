import { BN, BorshAccountsCoder } from "@coral-xyz/anchor";
import { Connection, type AccountInfo, type PublicKey } from "@solana/web3.js";
import { vi } from "vitest";
import { createReadClient } from "../../../src/contract/client";
import {
  IDL,
  deriveBranchHash,
  encodeHashSource,
  type RestoreProofInput,
} from "../../../src/contract/sdk";
import {
  entryId,
  fingerprint,
} from "../../../src/features/history/collect-proof";

export const bytes = (seed: number) => new Uint8Array(32).fill(seed);
export const hashEntry = (seed = 1, createdAt = 100n): RestoreProofInput => ({
  hash: bytes(seed),
  source: { kind: "hash" },
  createdAt,
  params: { kind: "hash", payload: bytes(seed) },
});
export function branchEntry(
  parent: RestoreProofInput,
  seed = 2,
): RestoreProofInput {
  const meta = fingerprint(parent);
  return {
    hash: deriveBranchHash(
      entryId(parent),
      parent.createdAt,
      meta.generation,
      Number(meta.sourceKind),
      bytes(seed),
    ),
    source: {
      kind: "branch",
      previousHashId: entryId(parent),
      payload: bytes(seed),
      generation: BigInt(meta.generation.toString()) + 1n,
    },
    createdAt: 200n,
    params: { kind: "branch", parent: meta },
  };
}
export function recordFixture() {
  const client = createReadClient(new Connection("http://127.0.0.1:8899"));
  const records = new Map<string, AccountInfo<Buffer>>();
  const read = vi
    .spyOn(client.connection, "getAccountInfo")
    .mockImplementation(async (key) => records.get(key.toBase58()) ?? null);
  const put = async (entry: RestoreProofInput, address?: PublicKey) => {
    const pda = address ?? client.hashPda(entryId(entry));
    records.set(pda.toBase58(), {
      owner: client.programId,
      executable: false,
      lamports: 1_000_000,
      rentEpoch: 0,
      data: await new BorshAccountsCoder(IDL).encode("hashAccount", {
        hash: [
          ...Buffer.from(
            typeof entry.hash === "string"
              ? Buffer.from(entry.hash, "hex")
              : entry.hash,
          ),
        ],
        source: encodeHashSource(entry.source),
        createdAt: new BN(entry.createdAt.toString()),
        voters: new BN(1),
        bump: 1,
      }),
    });
    return pda;
  };
  return { client, records, read, put };
}
