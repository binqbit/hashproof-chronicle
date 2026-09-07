import { expect, test } from "vitest";
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
} from "@solana/web3.js";
import { createSigningClient, PROGRAM_ID } from "../../src/contract/client";
import {
  register,
  branch,
  aggregate,
  restore,
  accountSnapshot,
} from "../../src/features/workspace/operations";
import { parseProof, proofJson } from "../../src/features/history/proof-format";

test("real localnet: register, vote, close via branch, restore, pack, batch and snapshot", async () => {
  const endpoint = process.env.SOLANA_TEST_RPC_URL;
  if (!endpoint)
    throw new Error(
      "Set SOLANA_TEST_RPC_URL to an isolated local validator with the current contract deployed.",
    );
  const url = new URL(endpoint);
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    throw new Error("This test only sends transactions to loopback localnet.");
  const connection = new Connection(endpoint, "confirmed");
  expect(
    (await connection.getAccountInfo(PROGRAM_ID))?.executable,
    "Deploy the current contract first",
  ).toBe(true);
  const makeClient = async () => {
    const payer = Keypair.generate();
    const wallet: AnchorProvider["wallet"] = {
      publicKey: payer.publicKey,
      signTransaction: async (tx) => {
        if (tx instanceof Transaction) tx.partialSign(payer);
        else tx.sign([payer]);
        return tx;
      },
      signAllTransactions: async (txs) => {
        for (const tx of txs) {
          if (tx instanceof Transaction) tx.partialSign(payer);
          else tx.sign([payer]);
        }
        return txs;
      },
    };
    const signature = await connection.requestAirdrop(
      payer.publicKey,
      5 * LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(
      { ...(await connection.getLatestBlockhash()), signature },
      "confirmed",
    );
    return { client: createSigningClient(connection, wallet), payer };
  };
  const a = await makeClient(),
    b = await makeClient();
  const initial = await register(
    a.client,
    Keypair.generate().publicKey.toBytes(),
  );
  expect(initial.warning).toBeUndefined();
  const id = initial.ids[0];
  const original = (await a.client.fetchHashAccount(id))!;
  await b.client.vote(id);
  expect((await a.client.fetchHashAccount(id))?.voters.toString()).toBe("2");
  await b.client.verify(id);
  await b.client.unvote(id);
  const child = await branch(
    a.client,
    id,
    Keypair.generate().publicKey.toBytes(),
    true,
    initial.proof!,
  );
  expect(child.warning).toBeUndefined();
  expect(await a.client.fetchHashAccount(id)).toBeNull();
  const proof = parseProof(
    proofJson(child.proof!, PROGRAM_ID.toBase58(), endpoint),
  );
  await restore(a.client, proof, false);
  expect(await a.client.fetchHashAccount(id)).toBeNull();
  await restore(a.client, proof, true);
  expect((await a.client.fetchHashAccount(id))?.createdAt.toString()).toBe(
    original.createdAt.toString(),
  );
  const packed = await aggregate(a.client, "pack", [id, child.ids[0]], proof);
  expect(packed.warning).toBeUndefined();
  await a.client.unvote(child.ids[0]);
  await a.client.unvote(id);
  await restore(
    a.client,
    parseProof(proofJson(packed.proof!, PROGRAM_ID.toBase58(), endpoint)),
    true,
  );
  expect((await a.client.fetchHashAccount(id))?.createdAt.toString()).toBe(
    original.createdAt.toString(),
  );
  const batched = await aggregate(
    a.client,
    "batch",
    [id, child.ids[0]],
    packed.proof!,
  );
  expect(batched.warning).toBeUndefined();
  await restore(a.client, batched.proof!, false);
  const snapshot = await accountSnapshot(a.client, b.payer.publicKey);
  expect(snapshot.warning).toBeUndefined();
  await restore(
    a.client,
    parseProof(proofJson(snapshot.proof!, PROGRAM_ID.toBase58(), endpoint)),
    false,
  );
});
