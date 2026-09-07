// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProofsPanel } from "../../src/features/history/ProofsPanel";
import {
  mergeArchives,
  parseArchive,
  stringifyArchive,
} from "../../src/contract/sdk";
import * as downloads from "../../src/features/history/proof-format";
import { hashArchive } from "./fixtures/archives";

// web3.js hashes Node Buffers; jsdom's separate Uint8Array realm fails noble's checks.
// Keep real SDK hashing/validation and align the test realm instead of mocking PDAs.
beforeEach(() =>
  vi.stubGlobal(
    "Uint8Array",
    Object.getPrototypeOf(Buffer.prototype).constructor,
  ),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function archiveFile(seed: number, json = stringifyArchive(hashArchive(seed))) {
  const file = new File([json], `${seed}.json`, { type: "application/json" });
  // jsdom's File lacks text(); only the browser file-read boundary is substituted.
  Object.defineProperty(file, "text", {
    value: vi.fn().mockResolvedValue(json),
    configurable: true,
  });
  return file;
}

it("merges multiple files offline and downloads the exact SDK archive", async () => {
  const download = vi
    .spyOn(downloads, "downloadJson")
    .mockImplementation(() => {});
  const user = userEvent.setup();
  render(<ProofsPanel />);
  const input = screen.getByLabelText(
    "Add proof JSON files",
  ) as HTMLInputElement;
  expect(input.multiple).toBe(true);
  expect(
    (screen.getByRole("button", { name: "Merge files" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  await user.upload(input, [archiveFile(1), archiveFile(2), archiveFile(1)]);
  await user.click(screen.getByRole("button", { name: "Merge files" }));
  expect(await screen.findByText("Archive ready")).toBeTruthy();
  expect(
    screen.getByText("3 files → 2 unique nodes. 1 overlapping nodes combined."),
  ).toBeTruthy();
  await user.click(
    screen.getByRole("button", { name: "Download merged JSON" }),
  );
  expect(download).toHaveBeenCalledTimes(1);
  const [name, contents] = download.mock.calls[0];
  expect(name).toBe("hash-timestamp-archive.json");
  expect(parseArchive(contents)).toEqual(
    mergeArchives(hashArchive(1), hashArchive(2)),
  );
});

it("invalidates stale downloads on file changes and reports bad files without dropping the selection", async () => {
  const user = userEvent.setup();
  render(<ProofsPanel />);
  const input = screen.getByLabelText("Add proof JSON files");
  await user.upload(input, [archiveFile(1), archiveFile(2)]);
  await user.click(screen.getByRole("button", { name: "Merge files" }));
  await screen.findByText("Archive ready");
  await user.upload(input, archiveFile(3, "{"));
  expect(
    screen.queryByRole("button", { name: "Download merged JSON" }),
  ).toBeNull();
  await user.click(screen.getByRole("button", { name: "Merge files" }));
  expect((await screen.findByRole("alert")).textContent).toContain("3.json:");
  expect(screen.queryByText("Archive ready")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Remove 3.json" }));
  await user.click(screen.getByRole("button", { name: "Merge files" }));
  await screen.findByText("Archive ready");
  await user.click(screen.getByRole("button", { name: "Clear files" }));
  expect(screen.queryByText("Archive ready")).toBeNull();
  expect(
    screen.queryByRole("list", { name: "Selected proof files" }),
  ).toBeNull();
});

it("does not resurrect a cancelled result when an earlier file read finishes", async () => {
  const user = userEvent.setup();
  let finish!: (contents: string) => void;
  const slow = archiveFile(1);
  Object.defineProperty(slow, "text", {
    value: () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  });
  render(<ProofsPanel />);
  await user.upload(screen.getByLabelText("Add proof JSON files"), [
    slow,
    archiveFile(2),
  ]);
  await user.click(screen.getByRole("button", { name: "Merge files" }));
  await user.click(screen.getByRole("button", { name: "Cancel & clear" }));
  await act(async () => finish(stringifyArchive(hashArchive(1))));
  expect(screen.queryByText("Archive ready")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Download merged JSON" }),
  ).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});
