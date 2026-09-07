import { describe, expect, it, vi } from "vitest";
import {
  AnchorProvider,
  BN,
  BorshInstructionCoder,
  BorshAccountsCoder,
} from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { createSigningClient } from "../../src/contract/client";
import {
  IDL,
  canonicalHashId,
  deriveGenesisHashId,
  deriveBranchHash,
  derivePackHash,
  type HashAccountData,
  type RestoreProofInput,
} from "../../src/contract/sdk";
import {
  aggregate,
  branch,
  register,
  restore,
} from "../../src/features/workspace/operations";
import {
  collectProof,
  entryId,
} from "../../src/features/history/collect-proof";
import { hex } from "../../src/features/workspace/values";

const raw = new Uint8Array(32).fill(37);
const parentId = hex(deriveGenesisHashId(raw));
const payload = new Uint8Array(32).fill(72);
const childHash = deriveBranchHash(parentId, 100n, 0n, 0, payload);
const childId = hex(canonicalHashId(childHash, 2));
const account = (
  hash = raw,
  source: HashAccountData["source"] = { hash: {} },
  time = 100
): HashAccountData => ({
  hash: [...hash],
  source,
  createdAt: new BN(time),
  voters: new BN(1),
  bump: 1,
});
const child = () =>
  account(
    childHash,
    {
      branch: {
        previousHashId: [...Buffer.from(parentId, "hex")],
        payload: [...payload],
        generation: new BN(1),
      },
    },
    101
  );

function fixture() {
  const keypair = Keypair.fromSeed(new Uint8Array(32).fill(2));
  const wallet: AnchorProvider["wallet"] = {
    publicKey: keypair.publicKey,
    signTransaction: async (tx) => tx,
    signAllTransactions: async (txs) => txs,
  };
  const client = createSigningClient(
    new Connection("http://127.0.0.1:8899"),
    wallet
  );
  const records = new Map<string, HashAccountData>();
  vi.spyOn(client.connection, "confirmTransaction").mockResolvedValue({
    context: { slot: 100 },
    value: { err: null },
  });
  vi.spyOn(client.connection, "getAccountInfo").mockImplementation(
    async (address) => {
      const value = records.get(address.toBase58());
      return value
        ? {
            owner: client.programId,
            executable: false,
            lamports: 1,
            rentEpoch: 0,
            data: await new BorshAccountsCoder(IDL).encode(
              "hashAccount",
              value
            ),
          }
        : null;
    }
  );
  const sent: Transaction[] = [];
  const fetch = vi
    .spyOn(client.program.account.hashAccount, "fetchNullable")
    .mockImplementation(
      async (address) => records.get(String(address)) ?? null
    );
  const send = vi
    .spyOn(client.program.provider as AnchorProvider, "sendAndConfirm")
    .mockImplementation(async (tx) => {
      if (!(tx instanceof Transaction))
        throw new Error("Expected a legacy transaction");
      sent.push(tx);
      return "confirmed-signature";
    });
  const put = (id: string, value: HashAccountData) => {
    const [, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("hash"), Buffer.from(id, "hex")],
      client.programId
    );
    records.set(client.hashPda(id).toBase58(), { ...value, bump });
  };
  const decoded = () =>
    new BorshInstructionCoder(IDL).decode(sent.at(-1)!.instructions[0].data);
  return { client, records, sent, fetch, send, put, decoded, wallet };
}

describe("Application operations using the actual SDK + Anchor IDL", () => {
  it("registers the raw hash at its canonical PDA, then collects history", async () => {
    const f = fixture();
    f.put(parentId, account());
    const receipt = await register(f.client, raw);
    expect(receipt.signature).toBe("confirmed-signature");
    expect(receipt.ids).toEqual([parentId]);
    expect(Object.keys(receipt.archive!.nodes)).toEqual([
      f.client.hashPda(parentId).toBase58(),
    ]);
    expect(receipt.proof?.map(entryId)).toEqual([parentId]);
    expect(f.decoded()).toEqual({ name: "register", data: { hash: [...raw] } });
    expect(
      f.sent[0].instructions[0].keys[0].pubkey.equals(
        f.client.hashPda(parentId)
      )
    ).toBe(true);
  });
  it("preserves a confirmed receipt when the follow-up RPC read fails", async () => {
    const f = fixture();
    f.put(parentId, account());
    f.fetch.mockRejectedValue(new Error("RPC offline"));
    const receipt = await register(f.client, raw);
    expect(receipt.signature).toBe("confirmed-signature");
    expect(receipt.warning).toContain("RPC offline");
    expect(f.sent).toHaveLength(1);
  });
  it("keeps parent history across a branch that closes the last parent vote", async () => {
    const f = fixture();
    f.put(parentId, account());
    f.put(childId, child());
    f.send.mockImplementation(async (tx) => {
      if (!(tx instanceof Transaction))
        throw new Error("Expected legacy transaction");
      f.sent.push(tx);
      f.records.delete(f.client.hashPda(parentId).toBase58());
      return "confirmed-signature";
    });
    const receipt = await branch(f.client, parentId, payload, true, []);
    expect(receipt.ids).toEqual([childId]);
    expect(receipt.proof?.map(entryId)).toEqual([childId, parentId]);
    expect(f.decoded()).toEqual({
      name: "branch",
      data: { payload: [...payload], takeVote: true },
    });
    const parentReads = f.fetch.mock.calls.filter(
      ([address]) => String(address) === f.client.hashPda(parentId).toBase58()
    );
    expect(parentReads).toHaveLength(1);
  });
  it("retains new pack fingerprints even when a member pack has unavailable history", async () => {
    const f = fixture();
    const memberId = hex(canonicalHashId(raw, 4));
    const packedHash = derivePackHash([
      { hash: raw, kind: 4, createdAt: 100n },
    ]);
    const packedId = hex(canonicalHashId(packedHash, 4));
    f.put(memberId, account(raw, { pack: {} }));
    f.put(packedId, account(packedHash, { pack: {} }, 101));
    const receipt = await aggregate(f.client, "pack", [memberId], []);
    expect(f.decoded()?.name).toBe("pack");
    expect(receipt.signature).toBe("confirmed-signature");
    expect(receipt.proof?.[0].params).toEqual({
      kind: "pack",
      members: [
        { hash: [...raw], sourceKind: 4, createdAt: 100n, generation: 0n },
      ],
    });
    expect(receipt.warning).toContain("partial history");
  });
  it("sends proof-only restore without ancestor allocations, and materialization with exact SDK metas", async () => {
    const f = fixture();
    f.put(parentId, account());
    f.put(childId, child());
    const proof = await collectProof(f.client, childId);
    const checked = await restore(f.client, proof, false);
    expect(checked.ids).toEqual([]);
    expect(f.decoded()?.name).toBe("restore");
    expect(f.sent[0].instructions[0].keys).toHaveLength(3);
    const restored = await restore(
      f.client,
      proof as RestoreProofInput[],
      true
    );
    expect(restored.ids).toEqual([parentId]);
    expect(f.sent[1].instructions[0].keys).toHaveLength(5);
    expect(
      f.sent[1].instructions[0].keys[3].pubkey.equals(
        f.client.hashPda(parentId)
      )
    ).toBe(true);
    expect(
      f.sent[1].instructions[0].keys[4].pubkey.equals(
        f.client.votePda(parentId, f.wallet.publicKey)
      )
    ).toBe(true);
  });
});
