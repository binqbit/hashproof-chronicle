// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManageProofsPanel } from "../../src/features/history/ManageProofsPanel";
import {
  archiveFromProof,
  IDL,
  mergeArchives,
  parseArchive,
  stringifyArchive,
  type HashArchive,
} from "../../src/contract/sdk";
import type { ProofSelectionInteraction } from "../../src/features/history/ProofSelectionContext";
import * as downloads from "../../src/features/history/proof-format";
import { hashArchive } from "./fixtures/archives";
import { fileRecord, pdaOf, proofForest } from "../fixtures/proof-forest";

// Test file admission/export with the actual SDK. Browser tests own the canvas.
vi.mock("../../src/features/history/ProofGraphViewer", () => ({
  default: ({ selection }: { selection: ProofSelectionInteraction }) => (
    <div data-testid="graph">
      {[...selection.graph.nodes.values()].map((node) => (
        <input
          key={node.pda}
          type="checkbox"
          aria-label={node.pda}
          checked={selection.included.has(node.pda)}
          disabled={selection.disabled || !node.record}
          onChange={(event) =>
            selection.onSelect([node.pda], event.target.checked)
          }
        />
      ))}
    </div>
  ),
}));
beforeEach(() =>
  vi.stubGlobal(
    "Uint8Array",
    Object.getPrototypeOf(Buffer.prototype).constructor,
  ),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function archiveFile(archive: HashArchive, name = "history.json") {
  const json = stringifyArchive(archive);
  const file = new File([json], name, { type: "application/json" });
  Object.defineProperty(file, "text", {
    value: vi.fn().mockResolvedValue(json),
    configurable: true,
  });
  return file;
}
const upload = () => screen.getByLabelText("Add proof JSON files");
const downloadButton = () =>
  screen.getByRole("button", { name: "Download selected proof" });
const output = (download: ReturnType<typeof vi.spyOn>) =>
  parseArchive(download.mock.calls.at(-1)![1]);

it("opens a single file automatically and downloads canonical selected history", async () => {
  const download = vi
    .spyOn(downloads, "downloadJson")
    .mockImplementation(() => {});
  const user = userEvent.setup(),
    archive = hashArchive(1);
  render(<ManageProofsPanel />);
  await user.upload(upload(), archiveFile(archive));
  await screen.findByText(/1 included · 0 excluded/);
  await user.click(downloadButton());
  expect(download).toHaveBeenCalledTimes(1);
  expect(download.mock.calls[0][0]).toBe("hash-timestamp-archive.json");
  expect(output(download)).toEqual(archive);
});

it("excludes exactly one node, confirms partial export, adds history explicitly, and undoes selection", async () => {
  const download = vi
    .spyOn(downloads, "downloadJson")
    .mockImplementation(() => {});
  const user = userEvent.setup(),
    f = proofForest();
  render(<ManageProofsPanel />);
  await user.upload(upload(), archiveFile(f.archive));
  const checkbox = await screen.findByRole("checkbox", {
    name: pdaOf(f.branch),
  });
  await user.click(checkbox);
  await user.click(downloadButton());
  expect(download).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: "Download partial proof" }),
  );
  const selected = output(download);
  expect(selected.nodes[pdaOf(f.branch)]).toBeUndefined();
  expect(selected.nodes[pdaOf(f.batch)]).toEqual(
    f.archive.nodes[pdaOf(f.batch)],
  );
  await user.click(
    screen.getByRole("button", { name: "Add needed history (+1)" }),
  );
  expect((checkbox as HTMLInputElement).checked).toBe(true);
  await user.click(screen.getByRole("button", { name: "Undo selection" }));
  expect((checkbox as HTMLInputElement).checked).toBe(false);
  await user.click(screen.getByRole("button", { name: "Exclude all" }));
  expect((downloadButton() as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole("button", { name: "Undo selection" }));
  await screen.findByText(/6 included · 1 excluded/);
  await user.click(screen.getByRole("button", { name: "Include all" }));
  await user.click(downloadButton());
  expect(output(download)).toEqual(f.archive);
});

it("preserves exclusions on overlapping imports and includes newly resolved placeholders", async () => {
  const user = userEvent.setup(),
    f = proofForest();
  const partial = parseArchive(f.archive);
  delete partial.nodes[pdaOf(f.first)];
  render(<ManageProofsPanel />);
  await user.upload(upload(), archiveFile(partial));
  const branch = await screen.findByRole("checkbox", { name: pdaOf(f.branch) });
  await user.click(branch);
  const addition = archiveFromProof(IDL.address, [
    f.first,
    f.branch,
    fileRecord(80),
  ]);
  await user.upload(upload(), archiveFile(addition, "additional.json"));
  await screen.findByText(/7 included · 1 excluded/);
  expect(
    (
      screen.getByRole("checkbox", {
        name: pdaOf(f.branch),
      }) as HTMLInputElement
    ).checked,
  ).toBe(false);
  expect(
    (screen.getByRole("checkbox", { name: pdaOf(f.first) }) as HTMLInputElement)
      .checked,
  ).toBe(true);
  expect(
    (
      screen.getByRole("button", {
        name: "Undo selection",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});

it("rejects bad or conflicting additions atomically without losing the existing graph and exclusions", async () => {
  const user = userEvent.setup(),
    archive = mergeArchives(hashArchive(1), hashArchive(2));
  const [pda] = Object.keys(archive.nodes);
  render(<ManageProofsPanel />);
  await user.upload(upload(), archiveFile(archive));
  await user.click(await screen.findByRole("checkbox", { name: pda }));
  const broken = archiveFile(hashArchive(3), "broken.json");
  Object.defineProperty(broken, "text", { value: () => Promise.resolve("{") });
  await user.upload(upload(), broken);
  expect((await screen.findByRole("alert")).textContent).toContain(
    "broken.json",
  );
  expect(
    (screen.getByRole("checkbox", { name: pda }) as HTMLInputElement).checked,
  ).toBe(false);
  const conflict = parseArchive(archive);
  conflict.nodes[pda].createdAt = "123456789";
  await user.upload(upload(), archiveFile(conflict, "conflict.json"));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Conflicting historical incarnation",
  );
  await screen.findByText(/1 included · 1 excluded/);
  expect(screen.getByText("1 files selected")).toBeTruthy();
});

it("removes source files and preserves records still supplied by another source", async () => {
  const user = userEvent.setup(),
    a = hashArchive(1),
    b = hashArchive(2);
  render(<ManageProofsPanel />);
  await user.upload(upload(), [
    archiveFile(a, "a.json"),
    archiveFile(mergeArchives(a, b), "ab.json"),
  ]);
  await screen.findByText(/2 included · 0 excluded/);
  await user.click(screen.getByText("Source files (2)"));
  await user.click(screen.getByRole("button", { name: "Remove ab.json" }));
  await screen.findByText(/1 included · 0 excluded/);
  expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  expect(
    (
      screen.getByRole("checkbox", {
        name: Object.keys(a.nodes)[0],
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
});

it("does not resurrect a cancelled import when its file read finishes", async () => {
  const user = userEvent.setup();
  let finish!: (contents: string) => void;
  const slow = archiveFile(hashArchive(1));
  Object.defineProperty(slow, "text", {
    value: () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  });
  render(<ManageProofsPanel />);
  await user.upload(upload(), slow);
  await user.click(screen.getByRole("button", { name: "Cancel & clear" }));
  await act(async () => finish(stringifyArchive(hashArchive(1))));
  expect(screen.queryByTestId("graph")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Download selected proof" }),
  ).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("preserves exclusions while witness data is added and removed with its source file", async () => {
  const download = vi
    .spyOn(downloads, "downloadJson")
    .mockImplementation(() => {});
  const user = userEvent.setup(),
    f = proofForest(),
    partial = parseArchive(f.archive);
  delete partial.nodes[pdaOf(f.pack)].members;
  render(<ManageProofsPanel />);
  await user.upload(upload(), archiveFile(partial, "partial.json"));
  await user.click(
    await screen.findByRole("checkbox", { name: pdaOf(f.pack) }),
  );
  await user.upload(upload(), archiveFile(f.archive, "complete.json"));
  await screen.findByText("2 files selected");
  const checkbox = () =>
    screen.getByRole("checkbox", { name: pdaOf(f.pack) }) as HTMLInputElement;
  expect(checkbox().checked).toBe(false);
  await user.click(checkbox());
  await user.click(downloadButton());
  expect(output(download).nodes[pdaOf(f.pack)].members).toEqual(
    f.archive.nodes[pdaOf(f.pack)].members,
  );
  await user.click(checkbox());
  await user.click(screen.getByText("Source files (2)"));
  await user.click(
    screen.getByRole("button", { name: "Remove complete.json" }),
  );
  await screen.findByText("1 files selected");
  expect(checkbox().checked).toBe(false);
  await user.click(checkbox());
  expect(screen.getByText(/Partial history:.*1 missing membership lists or snapshots/)).toBeTruthy();
  await user.click(downloadButton());
  await user.click(
    screen.getByRole("button", { name: "Download partial proof" }),
  );
  expect(output(download)).toEqual(partial);
});
