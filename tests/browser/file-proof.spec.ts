import { expect, test } from "@playwright/test";
import { openTool } from "./navigation";
import { createHash } from "node:crypto";
import { BN, BorshAccountsCoder } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  archiveFromProof,
  canonicalHashId,
  deriveBatchHash,
  deriveBranchHash,
  deriveHashPda,
  derivePackHash,
  encodeHashSource,
  IDL,
  stringifyArchive,
  type RestoreProofInput,
} from "../../src/contract/sdk";
import { entryId, fingerprint } from "../../src/features/history/collect-proof";

test("finds file versions inside Batch and Pack and checks historical time without a wallet", async ({
  page,
}, testInfo) => {
  const digest = (text: string) => createHash("sha256").update(text).digest();
  const root: RestoreProofInput = {
    hash: digest("original document"),
    source: { kind: "hash" },
    createdAt: 100n,
  };
  const version: RestoreProofInput = {
    hash: deriveBranchHash(
      entryId(root),
      100n,
      0n,
      0,
      digest("updated document"),
    ),
    source: {
      kind: "branch",
      previousHashId: entryId(root),
      payload: digest("updated document"),
      generation: 1n,
    },
    createdAt: 200n,
    params: { kind: "branch", parent: fingerprint(root) },
  };
  const batch: RestoreProofInput = {
    hash: deriveBatchHash([{ hash: version.hash, kind: 2, createdAt: 200n }]),
    source: { kind: "batch", members: [entryId(version)] },
    createdAt: 300n,
    params: { kind: "batch", members: [fingerprint(version)] },
  };
  const pack: RestoreProofInput = {
    hash: derivePackHash([{ hash: batch.hash, kind: 3, createdAt: 300n }]),
    source: { kind: "pack" },
    createdAt: 400n,
    params: { kind: "pack", members: [fingerprint(batch)] },
  };
  const archive = archiveFromProof(IDL.address, [root, version, batch, pack]);
  const anchor = deriveHashPda(
    new PublicKey(IDL.address),
    canonicalHashId(pack.hash, pack.source),
  );
  const encoded = await new BorshAccountsCoder(IDL).encode("hashAccount", {
    hash: [...(pack.hash as Uint8Array)],
    source: encodeHashSource(pack.source),
    createdAt: new BN(400),
    voters: new BN(1),
    bump: 1,
  });
  const methods: string[] = [];
  await page.route("**/*", async (route) => {
    const origin = new URL(route.request().url()).origin;
    if (origin === "http://127.0.0.1:4173") return route.continue();
    if (origin !== "http://127.0.0.1:8899") return route.abort();
    const request = route.request().postDataJSON();
    methods.push(request.method);
    const address = request.params?.[0];
    const value =
      address === IDL.address
        ? {
            executable: true,
            owner: "BPFLoader2111111111111111111111111111111111",
            lamports: 1,
            rentEpoch: 0,
            data: ["", "base64"],
          }
        : address === anchor.toBase58()
          ? {
              executable: false,
              owner: IDL.address,
              lamports: 1,
              rentEpoch: 0,
              data: [encoded.toString("base64"), "base64"],
            }
          : null;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        result: { context: { slot: 1 }, value },
      }),
    });
  });
  await page.goto("/");
  await openTool(page, "Proof check");
  const search = page.getByRole("button", { name: "Find file in proof" });
  await expect(search).toBeDisabled();
  await page.getByLabel("Proof file to search").setInputFiles({
    name: "combined.json",
    mimeType: "application/json",
    buffer: Buffer.from(stringifyArchive(archive)),
  });
  await expect(search).toBeDisabled();
  const input = page.getByLabel("File to check");
  await input.setInputFiles({
    name: "v2.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("updated document"),
  });
  await search.click();
  await expect(
    page.getByRole("heading", { name: "1970-01-01T00:03:20.000Z" }),
  ).toBeVisible();
  await expect(page.getByText("Branch version", { exact: true })).toBeVisible();
  await expect(page.getByText(/Matches live history/)).toHaveCount(0);
  await page.getByRole("button", { name: "Check on network — no fee" }).click();
  await expect(
    page.getByText("Matches live history · Localnet", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(anchor.toBase58(), { exact: true }),
  ).toBeVisible();
  expect(methods.every((method) => method === "getAccountInfo")).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("file-proof-check.png"),
    fullPage: true,
  });
  await input.setInputFiles({
    name: "v1.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("original document"),
  });
  await expect(page.getByText(/Matches live history/)).toHaveCount(0);
  await search.click();
  await expect(
    page.getByRole("heading", { name: "1970-01-01T00:01:40.000Z" }),
  ).toBeVisible();
  await input.setInputFiles({
    name: "other.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not in this archive"),
  });
  await search.click();
  await expect(
    page.getByRole("heading", { name: "File not found in this proof" }),
  ).toBeVisible();
});
