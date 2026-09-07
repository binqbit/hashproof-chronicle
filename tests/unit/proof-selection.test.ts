import { expect, it } from "vitest";
import { parseArchive } from "../../src/contract/sdk";
import { buildProofGraph } from "../../src/features/history/proof-graph";
import {
  changeProofSelection,
  exportProofSelection,
  proofSelectionScope,
} from "../../src/features/history/proof-selection";
import { proofForest, pdaOf } from "../fixtures/proof-forest";

it("selects records, earlier dependencies, continuations and connected histories distinctly", () => {
  const f = proofForest(),
    graph = buildProofGraph(f.archive);
  const scope = (kind: Parameters<typeof proofSelectionScope>[2]) =>
    proofSelectionScope(graph, [pdaOf(f.branch)], kind);
  expect(scope("record")).toEqual(new Set([pdaOf(f.branch)]));
  expect(scope("history")).toEqual(new Set([pdaOf(f.branch), pdaOf(f.first)]));
  expect(scope("continuations")).toEqual(
    new Set([f.branch, f.batch, f.pack].map((e) => pdaOf(e))),
  );
  expect(scope("connected")).toEqual(
    new Set(
      [f.first, f.second, f.branch, f.sibling, f.batch, f.pack].map((e) =>
        pdaOf(e),
      ),
    ),
  );
});

it("exports exactly selected nodes without rewriting a missing middle link or group member", () => {
  const f = proofForest(),
    graph = buildProofGraph(f.archive);
  const original = JSON.stringify(f.archive);
  const included = new Set(Object.keys(f.archive.nodes));
  const selection = changeProofSelection(
    included,
    [pdaOf(f.branch), pdaOf(f.second)],
    false,
  );
  expect(included.size).toBe(7);
  const output = exportProofSelection(graph, selection);
  expect(Object.keys(output.archive.nodes)).toHaveLength(5);
  expect(output.archive.nodes[pdaOf(f.batch)]).toEqual(
    f.archive.nodes[pdaOf(f.batch)],
  );
  expect(output.archive.nodes[pdaOf(f.pack)]).toEqual(
    f.archive.nodes[pdaOf(f.pack)],
  );
  expect(output.inspection.missingNodes).toEqual(
    [pdaOf(f.branch), pdaOf(f.second)].sort(),
  );
  expect(parseArchive(output.json)).toEqual(output.archive);
  expect(JSON.stringify(f.archive)).toBe(original);
  expect(proofSelectionScope(graph, selection, "history")).toEqual(included);
  expect(changeProofSelection(selection, [], true)).toBe(selection);
});

it("traverses absent references for scope but never exports placeholder records", () => {
  const f = proofForest(),
    partial = parseArchive(f.archive);
  delete partial.nodes[pdaOf(f.first)];
  const graph = buildProofGraph(partial);
  const connected = proofSelectionScope(graph, [pdaOf(f.sibling)], "connected");
  expect(connected.has(pdaOf(f.first))).toBe(false);
  expect(connected.has(pdaOf(f.branch))).toBe(true);
  const selected = proofSelectionScope(graph, [pdaOf(f.pack)], "history");
  const output = exportProofSelection(graph, selected);
  expect(output.inspection.missingNodes).toContain(pdaOf(f.first));
  expect(output.archive.nodes[pdaOf(f.first)]).toBeUndefined();
  expect(proofSelectionScope(graph, [pdaOf(f.first)], "record").size).toBe(0);
});
