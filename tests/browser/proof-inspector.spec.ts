import { expect, test, type Locator } from "@playwright/test";
import {
  archiveFromProof,
  IDL,
  stringifyArchive,
} from "../../src/contract/sdk";
import { proofForest, pdaOf, fileRecord } from "../fixtures/proof-forest";
import { openTool } from "./navigation";

async function expectFullGraphInView(canvas: Locator) {
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const nodes = [...element.querySelectorAll(".react-flow__node")];
        return (
          nodes.length > 0 &&
          nodes.every((node) => {
            const rect = node.getBoundingClientRect();
            return (
              rect.left >= bounds.left &&
              rect.top >= bounds.top &&
              rect.right <= bounds.right &&
              rect.bottom <= bounds.bottom
            );
          })
        );
      }),
    )
    .toBe(true);
}

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
  const close = details.getByRole("button", { name: "Close record details" });
  const closeBounds = (await close.boundingBox())!;
  const iconBounds = (await close.locator("svg").boundingBox())!;
  expect(closeBounds.width).toBe(closeBounds.height);
  expect(iconBounds.x + iconBounds.width / 2).toBeCloseTo(
    closeBounds.x + closeBounds.width / 2,
    0,
  );
  expect(iconBounds.y + iconBounds.height / 2).toBeCloseTo(
    closeBounds.y + closeBounds.height / 2,
    0,
  );
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
  await page.getByRole("button", { name: "Find record", exact: true }).click();
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
  await page.getByRole("button", { name: "Find record", exact: true }).click();
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

test("zooms promptly at the cursor and pans with the middle button across the example graph", async ({
  page,
  isMobile,
}, testInfo) => {
  test.skip(
    isMobile,
    "Mouse wheel and middle-button controls are desktop interactions.",
  );
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === "http://127.0.0.1:4173"
      ? route.continue()
      : route.abort(),
  );
  await page.goto("/");
  await openTool(page, "Proof inspector");
  await page
    .getByLabel("Proof file to inspect")
    .setInputFiles("examples/proof-chain/proof-chain.json");
  const canvas = page.getByRole("region", {
    name: "Proof graph viewer",
    exact: true,
  });
  await expect(canvas.locator("button[data-pda]")).toHaveCount(24);
  await expect(canvas.locator(".react-flow__edge")).toHaveCount(26);
  await canvas.scrollIntoViewIfNeeded();
  const viewport = canvas.locator(".react-flow__viewport");
  const transform = () =>
    viewport.evaluate((element) => {
      const matrix = new DOMMatrix(getComputedStyle(element).transform);
      return { x: matrix.e, y: matrix.f, zoom: matrix.a };
    });
  const bounds = (await canvas.boundingBox())!;
  // Browser wheel coordinates are integer CSS pixels, even with fractional layout bounds.
  const pointer = {
    x: Math.round(bounds.x + 70),
    y: Math.round(bounds.y + 110),
  };
  const origin = await canvas.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + element.clientLeft,
      y: rect.top + element.clientTop,
    };
  });
  const local = { x: pointer.x - origin.x, y: pointer.y - origin.y };
  const before = await transform();
  expect(before.zoom).toBeLessThan(0.5);
  await expectFullGraphInView(canvas);
  const scroll = await page.evaluate(() => scrollY);
  await page.mouse.move(pointer.x, pointer.y);
  await page.mouse.wheel(0, -120);
  await expect
    .poll(async () => (await transform()).zoom / before.zoom)
    .toBeGreaterThan(1.45);
  const after = await transform();
  expect(after.zoom / before.zoom).toBeLessThan(1.6);
  expect((local.x - after.x) / after.zoom).toBeCloseTo(
    (local.x - before.x) / before.zoom,
    1,
  );
  expect((local.y - after.y) / after.zoom).toBeCloseTo(
    (local.y - before.y) / before.zoom,
    1,
  );
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  await page.mouse.wheel(0, 120);
  await expect
    .poll(async () => (await transform()).zoom)
    .toBeCloseTo(before.zoom, 4);

  // Repeated wheel events at the minimum cannot shrink or shift the graph.
  await page.mouse.wheel(0, 10000);
  await page.mouse.wheel(0, 10000);
  await expect.poll(transform).toEqual(before);

  await page.mouse.down({ button: "middle" });
  await page.mouse.move(pointer.x + 80, pointer.y - 50, { steps: 6 });
  await page.mouse.up({ button: "middle" });
  const panned = await transform();
  expect(panned.x - before.x).toBeCloseTo(80, 0);
  expect(panned.y - before.y).toBeCloseTo(-50, 0);
  expect(panned.zoom).toBeCloseTo(before.zoom, 4);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);

  // A middle drag beginning on a record must pan, never open its details.
  await page.getByRole("button", { name: "Fit graph", exact: true }).click();
  const pack = canvas.getByRole("button", { name: /^Pack record / });
  // Locate the record up close before testing a drag from its circle.
  await page
    .getByLabel("Find record in graph")
    .fill((await pack.getAttribute("data-pda"))!);
  await page.getByRole("button", { name: "Find record", exact: true }).click();
  await pack.hover();
  await page.getByTestId("proof-node-tooltip").waitFor();
  await page.keyboard.press("Escape");
  const nodeBounds = (await pack.boundingBox())!;
  const nodeStart = await transform();
  // Clicking Fit may scroll the toolbar into view; compare only the drag itself.
  const nodeScroll = await page.evaluate(() => scrollY);
  const nodePoint = {
    x: nodeBounds.x + nodeBounds.width / 2,
    y: nodeBounds.y + nodeBounds.height / 2,
  };
  await page.mouse.move(nodePoint.x, nodePoint.y);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(nodePoint.x + 60, nodePoint.y + 35, { steps: 6 });
  await page.mouse.up({ button: "middle" });
  const nodeEnd = await transform();
  expect(nodeEnd.x - nodeStart.x).toBeCloseTo(60, 0);
  expect(nodeEnd.y - nodeStart.y).toBeCloseTo(35, 0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => scrollY)).toBe(nodeScroll);

  // Ctrl+wheel is the browser's trackpad-pinch representation; leave it native.
  const beforePinch = await transform();
  await page.mouse.move(nodePoint.x, nodePoint.y);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -80);
  await page.keyboard.up("Control");
  await expect
    .poll(async () => (await transform()).zoom)
    .toBeGreaterThan(beforePinch.zoom);
  expect(await page.evaluate(() => scrollY)).toBe(nodeScroll);

  const paths = canvas.locator(".react-flow__edge-path");
  const closeZoom = (await transform()).zoom;
  expect(closeZoom).toBeGreaterThan(0.375);
  for (const path of await paths.all()) {
    expect(await path.getAttribute("d")).toMatch(/C/);
    expect(await path.getAttribute("d")).not.toMatch(/[LHVQ]/);
    const strokeWidth = await path.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).strokeWidth),
    );
    expect(strokeWidth * closeZoom).toBeCloseTo(2 * closeZoom, 3);
  }
  // Arrowheads scale with graph coordinates, not the compensated line thickness.
  for (const marker of await canvas.locator("marker").all()) {
    await expect(marker).toHaveAttribute("markerUnits", "userSpaceOnUse");
  }
  await page.getByRole("button", { name: "Fit graph", exact: true }).click();
  await page.mouse.move(0, 0);
  await expect
    .poll(async () => (await transform()).zoom)
    .toBeCloseTo(before.zoom, 4);
  await page.getByRole("button", { name: "Zoom out graph" }).click();
  await expect
    .poll(async () => (await transform()).zoom)
    .toBeCloseTo(before.zoom, 4);
  const currentBounds = (await canvas.boundingBox())!;
  await page.mouse.move(currentBounds.x + 70, currentBounds.y + 110);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, 500);
  await page.keyboard.up("Control");
  await expect
    .poll(async () => (await transform()).zoom)
    .toBeCloseTo(before.zoom, 4);
  await expectFullGraphInView(canvas);
  const overviewStroke = await paths
    .first()
    .evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).strokeWidth),
    );
  expect(before.zoom).toBeLessThan(0.375);
  expect(overviewStroke * (await transform()).zoom).toBeCloseTo(0.75, 3);
  await canvas.screenshot({
    path: testInfo.outputPath("proof-example-curves.png"),
  });
  // A smaller window gets a new overview and floor, without needing a Fit click.
  await page.setViewportSize({ width: 320, height: 568 });
  await expect
    .poll(async () => (await transform()).zoom)
    .toBeLessThan(before.zoom);
  await expectFullGraphInView(canvas);
  const resized = await transform();
  const resizedStroke = await paths
    .first()
    .evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).strokeWidth),
    );
  expect(resizedStroke * resized.zoom).toBeCloseTo(0.75, 3);
  await page.getByRole("button", { name: "Zoom out graph" }).click();
  await expect
    .poll(async () => (await transform()).zoom)
    .toBeCloseTo(resized.zoom, 4);
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect
    .poll(async () => (await transform()).zoom)
    .toBeCloseTo(before.zoom, 4);
  await expectFullGraphInView(canvas);
});

test("fits a large forest and virtualizes offscreen records when exploring up close", async ({
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
  await expect(canvas.locator("button[data-pda]")).toHaveCount(1000);
  await expectFullGraphInView(canvas);
  const minimum = await canvas
    .locator(".react-flow__viewport")
    .evaluate(
      (element) => new DOMMatrix(getComputedStyle(element).transform).a,
    );
  await page
    .getByLabel("Find record in graph")
    .fill(Object.keys(archive.nodes)[0]);
  await page.getByRole("button", { name: "Find record", exact: true }).click();
  await expect
    .poll(() => canvas.locator("button[data-pda]").count())
    .toBeLessThan(200);
  const rendered = await canvas
    .locator("button[data-pda]")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("data-pda")),
    );
  const absent = Object.keys(archive.nodes).find(
    (id) => !rendered.includes(id),
  )!;
  await page.getByLabel("Find record in graph").fill(absent);
  // Distant animated searches must respect the floor between endpoints too.
  const [minimumDuringSearch] = await Promise.all([
    canvas.locator(".react-flow__viewport").evaluate(async (element) => {
      let minimum = Infinity;
      const started = performance.now();
      while (performance.now() - started < 800) {
        minimum = Math.min(
          minimum,
          new DOMMatrix(getComputedStyle(element).transform).a,
        );
        await new Promise(requestAnimationFrame);
      }
      return minimum;
    }),
    page.getByRole("button", { name: "Find record", exact: true }).click(),
  ]);
  expect(minimumDuringSearch).toBeGreaterThanOrEqual(minimum - 0.000001);
  await expect(canvas.locator(`[data-pda="${absent}"]`)).toBeVisible();
  await page.getByRole("button", { name: "Fit graph", exact: true }).click();
  await expect(canvas.locator("button[data-pda]")).toHaveCount(1000);
  await page.getByRole("button", { name: "Zoom out graph" }).click();
  await expectFullGraphInView(canvas);
});
