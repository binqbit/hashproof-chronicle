import { expect, test } from "@playwright/test";
import {
  archiveFromProof,
  IDL,
  stringifyArchive,
} from "../../src/contract/sdk";
import { proofForest, pdaOf, fileRecord } from "../fixtures/proof-forest";
import { openTool } from "./navigation";

test("draws an interactive proof graph with shared nodes, tooltips and touch details offline", async ({
  page,
  isMobile,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === "http://127.0.0.1:4173"
      ? route.continue()
      : route.abort(),
  );
  await page.goto("/");
  await openTool(page, "Proof inspector");
  const f = proofForest();
  const upload = page.getByLabel("Proof file to inspect");
  await upload.setInputFiles({
    name: "forest.json",
    mimeType: "application/json",
    buffer: Buffer.from(stringifyArchive(f.archive)),
  });
  const canvas = page.getByRole("region", {
    name: "Proof graph viewer",
    exact: true,
  });
  await expect(canvas).toBeVisible();
  await expect(canvas.locator("button[data-pda]")).toHaveCount(7);
  await expect(canvas.locator(".react-flow__edge")).toHaveCount(5);
  await expect(
    canvas.getByRole("heading", { name: "History 1", exact: true }),
  ).toBeVisible();
  await expect(
    canvas.getByRole("heading", { name: "History 2", exact: true }),
  ).toBeVisible();
  await expect(canvas.locator(`[data-pda="${pdaOf(f.first)}"]`)).toHaveCount(1);
  await expect(
    canvas.locator(`.react-flow__edge[aria-label*="to ${pdaOf(f.first)}"]`),
  ).toHaveCount(2);
  const branch = canvas.getByRole("button", {
    name: `Branch record ${pdaOf(f.branch)}`,
    exact: true,
  });
  await canvas.scrollIntoViewIfNeeded();
  if (!isMobile) {
    const before = await canvas.boundingBox();
    const viewport = canvas.locator(".react-flow__viewport");
    const transform = await viewport.getAttribute("style");
    await branch.hover();
    const tooltip = page.getByTestId("proof-node-tooltip");
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(
      `${pdaOf(f.branch).slice(0, 8)}…${pdaOf(f.branch).slice(-6)}`,
    );
    await expect(tooltip).toContainText("14 Nov 2023");
    await expect(tooltip).toContainText("22:13:21");
    await expect(tooltip).toContainText("UTC");
    await expect(tooltip).not.toContainText("1700000001");
    await expect(tooltip).not.toContainText("Timestamp in seconds");
    expect(
      await tooltip.evaluate(
        (element) =>
          element.scrollHeight <= element.clientHeight + 1 &&
          element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
    await tooltip.screenshot({
      path: testInfo.outputPath("proof-tooltip.png"),
    });
    expect(await canvas.boundingBox()).toEqual(before);
    expect(await viewport.getAttribute("style")).toBe(transform);
    await page.keyboard.press("Escape");
    await expect(tooltip).toHaveCount(0);
    await page.mouse.move(0, 0);
    await branch.focus();
    await expect(tooltip).toBeVisible();
    await page.keyboard.press("Escape");
  }
  if (isMobile) await branch.tap();
  else await branch.click();
  const details = page.getByRole("dialog", { name: "Branch record details" });
  await expect(details).toBeVisible();
  await expect(details).toContainText("Payload hash");
  await expect(details).toContainText(pdaOf(f.branch));
  await expect(details).toContainText("14 Nov 2023");
  await expect(details).toContainText("22:13:21");
  await expect(details).not.toContainText("1700000001");
  await expect(details).not.toContainText("Timestamp in seconds");
  await page.screenshot({
    path: testInfo.outputPath("proof-graph.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close record details" }).click();
  await expect(details).toHaveCount(0);
  await expect(page.getByTestId("proof-node-tooltip")).toHaveCount(0);
  await expect(branch).toBeFocused();

  if (!isMobile) {
    await canvas.scrollIntoViewIfNeeded();
    const bounds = (await canvas.boundingBox())!;
    const viewport = canvas.locator(".react-flow__viewport");
    const before = await viewport.getAttribute("style");
    await page.mouse.move(bounds.x + 15, bounds.y + 80);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 85, bounds.y + 110, { steps: 6 });
    await page.mouse.up();
    await expect(viewport).not.toHaveAttribute("style", before!);
  }

  const viewport = canvas.locator(".react-flow__viewport");
  const beforeZoom = await viewport.getAttribute("style");
  await page.getByRole("button", { name: "Zoom in graph" }).click();
  await expect(viewport).not.toHaveAttribute("style", beforeZoom!);
  await page.getByRole("button", { name: "Fit graph", exact: true }).click();
  await expect(branch).toBeVisible();
  await page.getByLabel("Find record in graph").fill(pdaOf(f.branch));
  await page.getByRole("button", { name: "Find record", exact: true }).click();
  await expect(branch).toBeVisible();

  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole("button", { name: "Fit graph", exact: true }).click();
  await canvas.scrollIntoViewIfNeeded();
  if (isMobile) await branch.tap();
  else await branch.click();
  await expect(details).toBeVisible();
  const popup = await details.boundingBox();
  expect(popup!.x).toBeGreaterThanOrEqual(0);
  expect(popup!.y).toBeGreaterThanOrEqual(0);
  expect(popup!.x + popup!.width).toBeLessThanOrEqual(320);
  expect(popup!.y + popup!.height).toBeLessThanOrEqual(568);
  expect(
    await details.evaluate(
      (element) =>
        element.scrollHeight <= element.clientHeight + 1 &&
        element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("proof-graph-narrow.png"),
  });
  await page.getByRole("button", { name: "Close record details" }).click();
  if (!isMobile) {
    await branch.evaluate((element) => element.blur());
    await branch.focus();
    const tooltip = page.getByTestId("proof-node-tooltip");
    await expect(tooltip).toBeVisible();
    expect(
      await tooltip.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return (
          bounds.x >= 0 &&
          bounds.y >= 0 &&
          bounds.right <= innerWidth &&
          bounds.bottom <= innerHeight &&
          element.scrollHeight <= element.clientHeight + 1 &&
          element.scrollWidth <= element.clientWidth + 1
        );
      }),
    ).toBe(true);
    await tooltip.screenshot({
      path: testInfo.outputPath("proof-tooltip-narrow.png"),
    });
    await page.keyboard.press("Escape");
  }
  await page.setViewportSize({ width: 568, height: 320 });
  await page.getByRole("button", { name: "Fit graph", exact: true }).click();
  await canvas.scrollIntoViewIfNeeded();
  if (isMobile) await branch.tap();
  else await branch.click();
  await expect(details).toBeVisible();
  expect(
    await details.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return (
        bounds.x >= 0 &&
        bounds.y >= 0 &&
        bounds.right <= innerWidth &&
        bounds.bottom <= innerHeight &&
        element.scrollHeight <= element.clientHeight + 1 &&
        element.scrollWidth <= element.clientWidth + 1
      );
    }),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("proof-graph-landscape.png"),
  });
  await page.getByRole("button", { name: "Close record details" }).click();
  await upload.setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });
  await expect(
    page
      .getByRole("region", { name: "Inspect proof history", exact: true })
      .getByRole("alert"),
  ).toContainText("broken.json");
  await expect(canvas).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("keeps a large forest responsive and locates records outside the initial viewport", async ({
  page,
}) => {
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === "http://127.0.0.1:4173"
      ? route.continue()
      : route.abort(),
  );
  await page.goto("/");
  await openTool(page, "Proof inspector");
  const entries = Array.from({ length: 1000 }, (_, index) => {
    const entry = fileRecord(0);
    entry.hash = new Uint8Array(32);
    new DataView(entry.hash.buffer).setUint32(0, index);
    return entry;
  });
  const archive = archiveFromProof(IDL.address, entries);
  await page.getByLabel("Proof file to inspect").setInputFiles({
    name: "large.json",
    mimeType: "application/json",
    buffer: Buffer.from(stringifyArchive(archive)),
  });
  const canvas = page.getByRole("region", {
    name: "Proof graph viewer",
    exact: true,
  });
  await expect(canvas).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByText(/Large proof: only the visible area/),
  ).toBeVisible();
  await expect
    .poll(() => canvas.locator("button[data-pda]").count())
    .toBeGreaterThan(0);
  expect(await canvas.locator("button[data-pda]").count()).toBeLessThan(200);
  const rendered = await canvas
    .locator("button[data-pda]")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("data-pda")),
    );
  const absent = Object.keys(archive.nodes).find(
    (id) => !rendered.includes(id),
  )!;
  await page.getByLabel("Find record in graph").fill(absent);
  await page.getByRole("button", { name: "Find record", exact: true }).click();
  await expect(canvas.locator(`[data-pda="${absent}"]`)).toBeVisible();
  await page.getByRole("button", { name: "Center graph", exact: true }).click();
  await page.getByRole("button", { name: "Zoom out graph" }).click();
  expect(await canvas.locator("button[data-pda]").count()).toBeLessThan(200);
});
