import { expect, test } from "@playwright/test";
import { openTool } from "./navigation";
import { proofForest, pdaOf } from "../fixtures/proof-forest";
import {
  archiveFromProof,
  IDL,
  mergeArchives,
  parseArchive,
  stringifyArchive,
} from "../../src/contract/sdk";

test("combines and downloads proof files with RPC unavailable, preserving selection across tabs", async ({
  page,
}, testInfo) => {
  await page.route("**/*", (route) => {
    if (new URL(route.request().url()).origin === "http://127.0.0.1:4173")
      return route.continue();
    return route.abort();
  });
  const archives = [1, 2].map((seed) =>
    archiveFromProof(IDL.address, [
      {
        hash: new Uint8Array(32).fill(seed),
        source: { kind: "hash" },
        createdAt: 100n,
      },
    ]),
  );
  await page.goto("/");
  await openTool(page, "Manage proofs");
  await page.getByLabel("Add proof JSON files").setInputFiles(
    archives.map((archive, index) => ({
      name: `proof-${index}.json`,
      mimeType: "application/json",
      buffer: Buffer.from(stringifyArchive(archive)),
    })),
  );
  await openTool(page, "Inspect");
  await openTool(page, "Manage proofs");
  await expect(
    page.getByText("2 files selected", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Save selected history" }),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download selected proof" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("hash-timestamp-archive.json");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(parseArchive(Buffer.concat(chunks).toString("utf8"))).toEqual(
    mergeArchives(archives[0], archives[1]),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("proofs-merged.png"),
    fullPage: true,
  });
});

test("edits graph scopes reversibly and exports exactly the selection without moving the graph", async ({
  page,
  isMobile,
}, testInfo) => {
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === "http://127.0.0.1:4173"
      ? route.continue()
      : route.abort(),
  );
  const f = proofForest();
  await page.goto("/");
  await openTool(page, "Manage proofs");
  await page.getByLabel("Add proof JSON files").setInputFiles({
    name: "history.json",
    mimeType: "application/json",
    buffer: Buffer.from(stringifyArchive(f.archive)),
  });
  const canvas = page.getByRole("region", {
    name: "Proof graph viewer",
    exact: true,
  });
  await expect(canvas.locator("[data-export-included=true]")).toHaveCount(7);
  await expect(canvas.locator(".proof-edge-active")).toHaveCount(5);
  await page.getByLabel("Find record in graph").fill(pdaOf(f.branch));
  await page.getByRole("button", { name: "Find record", exact: true }).click();
  const circle = canvas.locator(`[data-pda="${pdaOf(f.branch)}"]`);
  if (isMobile) await circle.tap();
  else await circle.hover();
  const card = page.getByRole("dialog", {
    name: isMobile ? "Branch record details" : "Export record preview",
    exact: true,
  });
  const viewport = canvas.locator(".react-flow__viewport");
  const positions = await canvas
    .locator(".react-flow__node")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("style")));
  const before = await viewport.getAttribute("style");
  await card
    .getByRole("checkbox", {
      name: `Include record ${pdaOf(f.branch)} in export`,
    })
    .uncheck();
  await expect(canvas.locator("[data-export-included=false]")).toHaveCount(1);
  await expect(viewport).toHaveAttribute("style", before!);
  expect(
    await canvas
      .locator(".react-flow__node")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("style"))),
  ).toEqual(positions);
  if (!isMobile)
    await card
      .getByRole("button", { name: "History selection actions" })
      .click();
  const dialog = page.getByRole("dialog", {
    name: "Branch record details",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Previous history", exact: true })
    .click();
  await expect(
    dialog.getByText("2 records in scope · 1 included"),
  ).toBeVisible();
  await expect(canvas.locator("[data-export-preview=true]")).toHaveCount(2);
  await dialog
    .getByRole("button", { name: "Continuations", exact: true })
    .click();
  await expect(
    dialog.getByText("3 records in scope · 2 included"),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Connected history", exact: true })
    .click();
  await expect(
    dialog.getByText("6 records in scope · 5 included"),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Exclude 5", exact: true }).click();
  await expect(canvas.locator("[data-export-included=false]")).toHaveCount(6);
  await page.keyboard.press("Escape");
  await expect(circle).toBeFocused();
  await expect(canvas.locator("[data-export-preview=true]")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo selection" }).click();
  await expect(canvas.locator("[data-export-included=false]")).toHaveCount(1);
  await page.getByRole("button", { name: "Fit graph", exact: true }).click();
  await canvas.screenshot({
    path: testInfo.outputPath("manage-selection.png"),
  });
  await page.getByRole("button", { name: "Download selected proof" }).click();
  const confirmation = page.getByRole("alertdialog", {
    name: "Save incomplete history?",
  });
  await expect(confirmation).toBeVisible();
  const event = page.waitForEvent("download");
  await confirmation
    .getByRole("button", { name: "Download partial proof" })
    .click();
  const stream = await (await event).createReadStream(),
    chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const selected = parseArchive(Buffer.concat(chunks).toString("utf8"));
  const expected = parseArchive(f.archive);
  delete expected.nodes[pdaOf(f.branch)];
  expect(selected).toEqual(expected);
});

test("keeps proof selection actions inside narrow and landscape screens", async ({
  page,
}, testInfo) => {
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === "http://127.0.0.1:4173"
      ? route.continue()
      : route.abort(),
  );
  await page.goto("/");
  await openTool(page, "Manage proofs");
  await page
    .getByLabel("Add proof JSON files")
    .setInputFiles("examples/proof-chain/proof-chain.json");
  for (const size of [
    { width: 320, height: 568 },
    { width: 568, height: 320 },
  ]) {
    await page.setViewportSize(size);
    for (const kind of ["Branch", "Account"] as const) {
      const circle = page
        .getByRole("button", { name: new RegExp(`^${kind} record `) })
        .first();
      const pda = await circle.getAttribute("data-pda");
      await page.getByLabel("Find record in graph").fill(pda!);
      await page
        .getByRole("button", { name: "Find record", exact: true })
        .click();
      await circle.click();
      const dialog = page.getByRole("dialog", {
        name: `${kind} record details`,
        exact: true,
      });
      await expect(dialog).toBeVisible();
      const close = await dialog
        .getByRole("button", { name: "Close record details" })
        .boundingBox();
      const detailsTab = await dialog
        .getByRole("button", { name: "Full record details", exact: true })
        .boundingBox();
      expect(detailsTab!.x + detailsTab!.width).toBeLessThanOrEqual(close!.x - 2);
      const bounds = await dialog.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(size.width);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(size.height);
      expect(
        await dialog.evaluate(
          (el) =>
            el.scrollWidth <= el.clientWidth &&
            el.scrollHeight <= el.clientHeight,
        ),
      ).toBe(true);
      await dialog
        .getByRole("button", { name: "Previous history", exact: true })
        .click();
      await expect(
        dialog.getByRole("button", { name: /^Exclude / }),
      ).toBeInViewport();
      await dialog.screenshot({
        path: testInfo.outputPath(`manage-${kind}-${size.width}.png`),
      });
      await dialog
        .getByRole("button", { name: "Full record details", exact: true })
        .click();
      const full = await dialog.boundingBox();
      expect(full!.y).toBeGreaterThanOrEqual(0);
      expect(full!.y + full!.height).toBeLessThanOrEqual(size.height);
      expect(
        await dialog.evaluate(
          (el) =>
            el.scrollWidth <= el.clientWidth &&
            el.scrollHeight <= el.clientHeight,
        ),
      ).toBe(true);
      await expect(
        dialog.getByRole("button", { name: "Selection actions", exact: true }),
      ).toBeInViewport();
      await dialog
        .getByRole("button", { name: "Close record details" })
        .click();
    }
  }
});
