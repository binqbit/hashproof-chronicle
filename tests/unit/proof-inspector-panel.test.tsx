// @vitest-environment jsdom
import { File as NodeFile } from "node:buffer";
import { useState } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  archiveFromProof,
  createArchive,
  IDL,
  stringifyArchive,
  type HashArchive,
} from "../../src/contract/sdk";
import { ProofInspectorPanel } from "../../src/features/history/ProofInspectorPanel";
import { ProofNodeDetails } from "../../src/features/history/ProofNodeDetails";
import {
  buildProofGraph,
  type ProofGraph,
} from "../../src/features/history/proof-graph";
import { fileRecord, pdaOf, proofForest } from "../fixtures/proof-forest";

// Test the import boundary here; actual canvas, worker and portals run in Chromium.
vi.mock("../../src/features/history/ProofGraphViewer", () => ({
  default: function Viewer({ graph }: { graph: ProofGraph }) {
    const [selected, select] = useState(false);
    return (
      <div data-testid="graph">
        <span>
          {graph.nodes.size} graph nodes, {graph.components.length} graphs
        </span>
        <button onClick={() => select(true)}>
          {selected ? "Selected node" : "Select node"}
        </button>
      </div>
    );
  },
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
});

function jsonFile(contents: string, name = "history.json") {
  const actual = new NodeFile([contents], name);
  const file = new File([contents], name, { type: "application/json" });
  Object.defineProperty(file, "text", {
    value: () => actual.text(),
    configurable: true,
  });
  return file;
}
const saved = (archive: HashArchive) => jsonFile(stringifyArchive(archive));
const input = () => screen.getByLabelText("Proof file to inspect");

it("passes all independent histories and unique nodes to the offline viewer", async () => {
  render(<ProofInspectorPanel />);
  await userEvent.setup().upload(input(), saved(proofForest().archive));
  expect((await screen.findByTestId("graph")).textContent).toContain(
    "7 graph nodes, 2 graphs",
  );
  expect(screen.getByRole("status").textContent).toContain(
    "7 records · 2 independent histories",
  );
  expect(
    screen.getByText(/This view does not confirm records on the network/),
  ).toBeTruthy();
});

it("cancels stale reads and removes graphs on errors, clear and empty imports", async () => {
  const user = userEvent.setup();
  render(<ProofInspectorPanel />);
  const old = saved(proofForest().archive);
  let resolve!: (contents: string) => void;
  Object.defineProperty(old, "text", {
    value: () =>
      new Promise<string>((done) => {
        resolve = done;
      }),
  });
  await user.upload(input(), old);
  await user.upload(input(), saved(createArchive(IDL.address)));
  await act(async () => resolve(stringifyArchive(proofForest().archive)));
  expect(screen.getByText("This proof contains no records.")).toBeTruthy();
  expect(screen.queryByTestId("graph")).toBeNull();
  await user.upload(input(), jsonFile("{"));
  expect(screen.getByRole("alert").textContent).toContain("history.json");
  expect(screen.queryByLabelText("Proof history inspector")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Clear proof" }));
  expect(screen.queryByRole("alert")).toBeNull();
  await user.upload(input(), saved(proofForest().archive));
  expect(await screen.findByTestId("graph")).toBeTruthy();
});

it("resets viewer state even when an immediate replacement has the same component PDA", async () => {
  const user = userEvent.setup();
  const archive = proofForest().archive;
  render(<ProofInspectorPanel />);
  await user.upload(input(), saved(archive));
  await user.click(await screen.findByRole("button", { name: "Select node" }));
  expect(screen.getByText("Selected node")).toBeTruthy();
  const file = saved(archive);
  Object.defineProperty(file, "text", {
    value: () => Promise.resolve(stringifyArchive(archive)),
  });
  await user.upload(input(), file);
  expect(
    await screen.findByRole("button", { name: "Select node" }),
  ).toBeTruthy();
  expect(screen.queryByText("Selected node")).toBeNull();
});

it("does not silently limit the number of independent graphs", async () => {
  render(<ProofInspectorPanel />);
  await userEvent.setup().upload(
    input(),
    saved(
      archiveFromProof(
        IDL.address,
        Array.from({ length: 7 }, (_, i) => fileRecord(i)),
      ),
    ),
  );
  expect((await screen.findByTestId("graph")).textContent).toContain(
    "7 graph nodes, 7 graphs",
  );
});

it("formats exact record details and never invents a timestamp for missing nodes", () => {
  const f = proofForest();
  const graph = buildProofGraph(f.archive);
  const { rerender } = render(
    <ProofNodeDetails node={graph.nodes.get(pdaOf(f.branch))!} />,
  );
  expect(screen.getByText("14 Nov 2023")).toBeTruthy();
  expect(screen.queryByText("1700000001")).toBeNull();
  expect(screen.getByText("Payload hash")).toBeTruthy();
  expect(screen.getByText(pdaOf(f.branch))).toBeTruthy();
  rerender(
    <ProofNodeDetails
      node={{ pda: pdaOf(f.first), dependencies: [], referencedBy: [] }}
    />,
  );
  expect(screen.queryByText("Recorded time")).toBeNull();
  expect(
    screen.getByText(/contents and timestamp are not in the file/),
  ).toBeTruthy();
});
