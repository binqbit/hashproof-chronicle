import { expect, test, type Page } from "@playwright/test";
import { BN, BorshAccountsCoder } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { generateProofChain } from "../../examples/proof-chain/generate";
import {
  IDL,
  encodeHashSource,
  stringifyArchive,
  parseArchive,
  type RestoreProofInput,
} from "../../src/contract/sdk";
import { proofForest, pdaOf, idOf } from "../fixtures/proof-forest";
import { openTool } from "./navigation";

async function mockRecords(page: Page, live: RestoreProofInput[]) {
  const records = new Map<string, string>();
  for (const entry of live) {
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("hash"), Buffer.from(idOf(entry))],
      new PublicKey(IDL.address),
    );
    const data = await new BorshAccountsCoder(IDL).encode("hashAccount", {
      hash: [...(entry.hash as Uint8Array)],
      source: encodeHashSource(entry.source),
      createdAt: new BN(entry.createdAt.toString()),
      voters: new BN(1),
      bump,
    });
    records.set(pda.toBase58(), data.toString("base64"));
  }
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === "http://127.0.0.1:4173") return route.continue();
    if (url.origin !== "http://127.0.0.1:8899") return route.abort();
    const request = route.request().postDataJSON();
    expect(request.method).toBe("getAccountInfo");
    const address = request.params[0],
      encoded = records.get(address);
    const value =
      address === IDL.address
        ? {
            executable: true,
            owner: "BPFLoader2111111111111111111111111111111111",
            lamports: 1,
            rentEpoch: 0,
            data: ["", "base64"],
          }
        : encoded
          ? {
              executable: false,
              owner: IDL.address,
              lamports: 1,
              rentEpoch: 0,
              data: [encoded, "base64"],
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
}

test("selects restore circles, checks actual anchor paths, and invalidates routes on changes", async ({
  page,
  isMobile,
}, testInfo) => {
  const f = proofForest();
  await mockRecords(page, [f.branch]);
  await page.goto("/");
  await openTool(page, "Restore");
  await expect(page.locator("textarea")).toHaveCount(0);
  await page.getByLabel("Proof file to restore").setInputFiles({
    name: "history.json",
    mimeType: "application/json",
    buffer: Buffer.from(stringifyArchive(f.archive)),
  });
  const canvas = page.getByRole("region", {
    name: "Proof graph viewer",
    exact: true,
  });
  await expect(canvas.locator("button[data-pda]")).toHaveCount(7);
  await expect(
    page.getByRole("button", { name: "Check selected records — no fee" }),
  ).toBeDisabled();
  await expect(canvas.locator(".proof-edge-muted")).toHaveCount(5);
  await page.getByLabel("Find record in graph").fill(pdaOf(f.first));
  await page.getByRole("button", { name: "Find record", exact: true }).click();
  const circle = canvas.locator(`[data-pda="${pdaOf(f.first)}"]`);
  if (isMobile) await circle.tap();
  else await circle.hover();
  const card = page.getByRole("dialog", {
    name: isMobile ? "Hash record details" : "Restore record preview",
    exact: true,
  });
  await expect(card).toBeVisible();
  const viewport = canvas.locator(".react-flow__viewport");
  const before = await viewport.getAttribute("style");
  const positions = await canvas
    .locator(".react-flow__node")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("style")));
  await card
    .getByRole("checkbox", { name: `Restore record ${pdaOf(f.first)}` })
    .check();
  await expect(canvas.locator("[data-restore-selected=true]")).toHaveCount(1);
  await expect(circle.getByLabel("Selected for restore")).toBeVisible();
  await expect(viewport).toHaveAttribute("style", before!);
  expect(
    await canvas
      .locator(".react-flow__node")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("style"))),
  ).toEqual(positions);
  await page.keyboard.press("Escape");
  await expect(circle).toBeFocused();
  await page
    .getByRole("button", { name: "Check selected records — no fee" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Restore paths checked" }),
  ).toBeVisible();
  await expect(canvas.locator("[data-restore-anchor=true]")).toHaveCount(1);
  await expect(
    canvas.locator(
      `[data-restore-anchor=true] [data-pda="${pdaOf(f.branch)}"]`,
    ),
  ).toHaveCount(1);
  await expect(canvas.locator(".proof-edge-active")).toHaveCount(1);
  await expect(canvas.locator(".proof-edge-muted")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: /^Restore selected records/ }),
  ).toBeDisabled(); // no wallet
  await page.getByRole("button", { name: "Fit graph", exact: true }).click();
  await canvas.screenshot({ path: testInfo.outputPath("restore-path.png") });
  await page.getByLabel("Find record in graph").fill(pdaOf(f.first));
  await page.getByRole("button", { name: "Find record", exact: true }).click();
  if (isMobile) await circle.tap();
  else {
    await circle.focus();
    await page.keyboard.press("Enter");
  }
  const details = page.getByRole("dialog", {
    name: "Hash record details",
    exact: true,
  });
  const checkbox = details.getByRole("checkbox", {
    name: `Restore record ${pdaOf(f.first)}`,
  });
  await details.screenshot({
    path: testInfo.outputPath("restore-details.png"),
  });
  await expect(checkbox).toBeChecked();
  await checkbox.focus();
  await page.keyboard.press("Space");
  await expect(canvas.locator("[data-restore-selected=true]")).toHaveCount(0);
  await expect(canvas.locator(".proof-edge-active")).toHaveCount(0);
  await expect(page.getByLabel("Restore plan")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(circle).toBeFocused();
  await page.getByRole("button", { name: "Clear proof", exact: true }).click();
  await expect(canvas).toHaveCount(0);
});

test("shows only the example Pack's shortest route even when its full restore proof cannot fit", async ({
  page,
}, testInfo) => {
  const archive = parseArchive(
    readFileSync("examples/proof-chain/proof-chain.json", "utf8"),
  );
  const [pda, pack] = Object.entries(archive.nodes).find(
    ([, node]) => node.source.kind === "pack",
  )!;
  await mockRecords(page, [
    {
      hash: Buffer.from(pack.hash, "hex"),
      source: { kind: "pack" },
      createdAt: BigInt(pack.createdAt),
    },
  ]);
  await page.goto("/");
  await openTool(page, "Restore");
  await page
    .getByLabel("Proof file to restore")
    .setInputFiles("examples/proof-chain/proof-chain.json");
  const canvas = page.getByRole("region", {
    name: "Proof graph viewer",
    exact: true,
  });
  await expect(canvas.locator("[data-restore-anchor=true]")).toHaveCount(1);
  await expect(
    canvas.locator(`[data-restore-anchor=true] [data-pda="${pda}"]`),
  ).toHaveCount(1);
  await page.getByLabel("Find record in graph").fill(pda);
  await page.getByRole("button", { name: "Find record", exact: true }).click();
  await canvas.locator(`[data-pda="${pda}"]`).click();
  const anchorCheckbox = page
    .getByRole("dialog", { name: "Pack record details", exact: true })
    .getByRole("checkbox", { name: `Restore record ${pda}` });
  await expect(anchorCheckbox).toBeDisabled();
  await expect(anchorCheckbox).not.toBeChecked();
  await page.getByRole("button", { name: "Close record details" }).click();
  const example = generateProofChain();
  const path = ["Pack", "L2", "L1", "Batch3", "X2", "X1", "Batch1", "A1", "A"]
    .map((name) => example.records.find((record) => record.name === name)!.pda);
  const target = path[path.length - 1];
  await page.getByLabel("Find record in graph").fill(target);
  await page.getByRole("button", { name: "Find record", exact: true }).click();
  await canvas.locator(`[data-pda="${target}"]`).click();
  await page
    .getByRole("dialog", { name: "Hash record details", exact: true })
    .getByRole("checkbox", { name: `Restore record ${target}` })
    .check();
  await page.getByRole("button", { name: "Close record details" }).click();
  await expect(canvas.locator(".proof-edge-active")).toHaveCount(path.length - 1);
  await page
    .getByRole("button", { name: "Check selected records — no fee" })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Restore historical records", exact: true })
      .getByRole("alert"),
  ).toContainText(/proof|size|offset/i);
  await expect(canvas.locator("[data-restore-anchor=true]")).toHaveCount(1);
  await expect(canvas.locator(".proof-edge-active")).toHaveCount(path.length - 1);
  for (let index = 1; index < path.length; index++)
    await expect(canvas.locator(
      `.proof-edge-active[aria-label^="${path[index - 1]} to ${path[index]},"]`,
    )).toHaveCount(1);
  await expect(canvas.locator(".proof-edge-active").first()).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(
    canvas.locator(`.proof-edge-active[aria-label*="to ${target}"]`),
  ).not.toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Restore selected records/ }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Fit graph", exact: true }).click();
  await canvas.screenshot({ path: testInfo.outputPath("shortest-path.png") });
});

test("keeps Restore details and selection accessible on narrow and landscape screens", async ({
  page,
}, testInfo) => {
  const archive = parseArchive(
    readFileSync("examples/proof-chain/proof-chain.json", "utf8"),
  );
  await mockRecords(page, []);
  await page.goto("/");
  await openTool(page, "Restore");
  await page
    .getByLabel("Proof file to restore")
    .setInputFiles("examples/proof-chain/proof-chain.json");
  for (const size of [
    { width: 320, height: 568 },
    { width: 568, height: 320 },
  ]) {
    await page.setViewportSize(size);
    for (const kind of ["branch", "account"] as const) {
      const [pda] = Object.entries(archive.nodes).find(
        ([, node]) => node.source.kind === kind,
      )!;
      await page.getByLabel("Find record in graph").fill(pda);
      await page
        .getByRole("button", { name: "Find record", exact: true })
        .click();
      await page.locator(`button[data-pda="${pda}"]`).click();
      const dialog = page.getByRole("dialog", {
        name: `${kind[0].toUpperCase() + kind.slice(1)} record details`,
        exact: true,
      });
      await expect(dialog).toBeVisible();
      expect(
        await dialog.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return {
            top: box.top,
            bottom: box.bottom,
            left: box.left,
            right: box.right,
            overflow:
              element.scrollHeight > element.clientHeight + 1 ||
              element.scrollWidth > element.clientWidth + 1,
          };
        }),
      ).toEqual({
        top: expect.any(Number),
        bottom: expect.any(Number),
        left: expect.any(Number),
        right: expect.any(Number),
        overflow: false,
      });
      const bounds = (await dialog.boundingBox())!;
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(size.height);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(size.width);
      const checkbox = dialog.getByRole("checkbox", {
        name: `Restore record ${pda}`,
      });
      await checkbox.check();
      await expect(checkbox).toBeChecked();
      await dialog.screenshot({
        path: testInfo.outputPath(`restore-${kind}-${size.width}.png`),
      });
      await dialog
        .getByRole("button", { name: "Close record details" })
        .click();
    }
  }
});

test("requires explicit selection of extra records and rejects malformed replacement files", async ({
  page,
}) => {
  const f = proofForest();
  await mockRecords(page, [f.pack]);
  await page.goto("/");
  await openTool(page, "Restore");
  const upload = page.getByLabel("Proof file to restore");
  await upload.setInputFiles({
    name: "combined.json",
    mimeType: "application/json",
    buffer: Buffer.from(stringifyArchive(f.archive)),
  });
  const canvas = page.getByRole("region", {
    name: "Proof graph viewer",
    exact: true,
  });
  await page.getByLabel("Find record in graph").fill(pdaOf(f.first));
  await page.getByRole("button", { name: "Find record", exact: true }).click();
  await canvas.locator(`[data-pda="${pdaOf(f.first)}"]`).click();
  await page
    .getByRole("checkbox", { name: `Restore record ${pdaOf(f.first)}` })
    .check();
  await page.getByRole("button", { name: "Close record details" }).click();
  await page
    .getByRole("button", { name: "Check selected records — no fee" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Additional records are required" }),
  ).toBeVisible();
  await expect(canvas.locator("[data-restore-required=true]")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Select 2 required record(s)" })
    .click();
  await expect(canvas.locator("[data-restore-selected=true]")).toHaveCount(3);
  await expect(canvas.locator(".proof-edge-active")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Check selected records — no fee" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Restore paths checked" }),
  ).toBeVisible();
  await expect(canvas.locator(".proof-edge-active")).toHaveCount(3);
  await expect(
    canvas.locator(`.proof-edge-muted[aria-label*="to ${pdaOf(f.second)}"]`),
  ).toHaveCount(1);
  await upload.setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });
  await expect(canvas).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("broken.json");
});
