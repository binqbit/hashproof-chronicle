import { expect, test } from "@playwright/test";
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
  const tabs = page.getByRole("navigation", { name: "Record operations" });
  await tabs.getByRole("button", { name: "Proofs", exact: true }).click();
  await page
    .getByLabel("Add proof JSON files")
    .setInputFiles(
      archives.map((archive, index) => ({
        name: `proof-${index}.json`,
        mimeType: "application/json",
        buffer: Buffer.from(stringifyArchive(archive)),
      })),
    );
  await tabs.getByRole("button", { name: "Inspect", exact: true }).click();
  await tabs.getByRole("button", { name: "Proofs", exact: true }).click();
  await expect(
    page.getByText("2 files selected", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Merge files", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Archive ready" }),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download merged JSON" }).click();
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
