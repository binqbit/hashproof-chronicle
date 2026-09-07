import { expect, it } from "vitest";
import { archiveFromProof, createArchive, IDL } from "../../src/contract/sdk";
import { buildProofGraph } from "../../src/features/history/proof-graph";
import { layoutProofGraph } from "../../src/features/history/graph-layout";
import {
  aggregate,
  fileRecord,
  idOf,
  pdaOf,
  proofForest,
  version,
} from "../fixtures/proof-forest";

it("separates unrelated histories while preserving converging groups, shared roots and ordered edges", () => {
  const f = proofForest();
  const graph = buildProofGraph(f.archive);
  expect(graph.components).toHaveLength(2);
  expect(graph.components.map((component) => component.records).sort()).toEqual(
    [1, 6],
  );
  const main = graph.components.find((component) => component.records === 6)!;
  expect(main.heads.sort()).toEqual([pdaOf(f.pack), pdaOf(f.sibling)].sort());
  expect(graph.nodes.get(pdaOf(f.batch))!.dependencies).toEqual([
    pdaOf(f.branch),
    pdaOf(f.second),
  ]);
  expect(graph.nodes.get(pdaOf(f.pack))!.dependencies).toEqual([
    pdaOf(f.batch),
  ]);
  expect(main.members.filter((pda) => pda === pdaOf(f.first))).toHaveLength(1);
  expect(
    graph.edges.filter((edge) => edge.target === pdaOf(f.first)),
  ).toHaveLength(2);
  expect(
    graph.edges
      .filter((edge) => edge.source === pdaOf(f.batch))
      .map((edge) => edge.member),
  ).toEqual([1, 2]);
  const reordered = {
    ...f.archive,
    nodes: Object.fromEntries(Object.entries(f.archive.nodes).reverse()),
  };
  expect(buildProofGraph(reordered).components).toEqual(graph.components);
  expect(layoutProofGraph(buildProofGraph(reordered))).toEqual(
    layoutProofGraph(graph),
  );
});

it("keeps branches connected through a shared missing parent, without fabricating its timestamp", () => {
  const f = proofForest();
  delete f.archive.nodes[pdaOf(f.first)];
  const graph = buildProofGraph(f.archive);
  expect(graph.components).toHaveLength(2);
  expect(graph.components.find((component) => component.missing)!.records).toBe(
    5,
  );
  expect(graph.nodes.get(pdaOf(f.first))!.record).toBeUndefined();
  expect(graph.nodes.get(pdaOf(f.first))!.referencedBy.sort()).toEqual(
    [pdaOf(f.branch), pdaOf(f.sibling)].sort(),
  );
  expect(graph.inspection.complete).toBe(false);
});

it("does not invent Pack membership or account dependencies, including equal file payloads", () => {
  const first = fileRecord(1),
    second = fileRecord(2);
  const branch = version(first, 7),
    other = version(second, 7);
  const opaque = {
    hash: new Uint8Array(32).fill(99),
    source: { kind: "pack" as const },
    createdAt: 1n,
  };
  const account = {
    hash: new Uint8Array(32).fill(98),
    source: { kind: "account" as const, account: pdaOf(first) },
    createdAt: 1n,
  };
  const graph = buildProofGraph(
    archiveFromProof(IDL.address, [
      first,
      second,
      branch,
      other,
      opaque,
      account,
    ]),
  );
  expect(graph.components).toHaveLength(4);
  expect(graph.nodes.get(pdaOf(opaque))!.dependencies).toEqual([]);
  expect(graph.inspection.missingWitnesses).toEqual(
    expect.arrayContaining([
      { pda: pdaOf(opaque), field: "members" },
      { pda: pdaOf(account), field: "snapshot" },
    ]),
  );
});

it("rejects tampered commitments and cycles, accepting empty and foreign-program archives", () => {
  expect(buildProofGraph(createArchive(IDL.address)).components).toEqual([]);
  const f = proofForest();
  const source = f.archive.nodes[pdaOf(f.branch)].source;
  if (source.kind !== "branch") throw new Error("Expected Branch fixture");
  source.payload = "ff".repeat(32);
  expect(() => buildProofGraph(f.archive)).toThrow(/commitment mismatch/);
  const cyclic = proofForest();
  const branchSource = cyclic.archive.nodes[pdaOf(cyclic.branch)].source;
  if (branchSource.kind !== "branch")
    throw new Error("Expected Branch fixture");
  branchSource.previousHashId = Buffer.from(idOf(cyclic.branch)).toString(
    "hex",
  );
  expect(() => buildProofGraph(cyclic.archive)).toThrow(
    /Cyclic archive dependencies/,
  );
  const program = "11111111111111111111111111111111";
  const first = fileRecord(1),
    child = version(first, 2);
  const graph = buildProofGraph(archiveFromProof(program, [first, child]));
  expect(graph.nodes.get(pdaOf(child, program))!.dependencies).toEqual([
    pdaOf(first, program),
  ]);
});

it("keeps a densely shared DAG linear in nodes plus edges", () => {
  const entries = [fileRecord(1), fileRecord(2)];
  for (let i = 0; i < 80; i++)
    entries.push(aggregate("batch", entries.slice(-2), BigInt(i + 1700000002)));
  const graph = buildProofGraph(archiveFromProof(IDL.address, entries));
  expect(graph.edges).toHaveLength(160);
  expect(graph.nodes.size).toBe(82);
  expect(graph.components[0].members).toHaveLength(82);
});

it("lays out 10,000-deep histories iteratively without dropping any nodes", () => {
  const members = Array.from({ length: 10000 }, (_, index) => String(index));
  const edges = members
    .slice(1)
    .map((id, index) => ({ source: String(index), target: id }));
  const layout = layoutProofGraph({
    components: [{ key: "0", members }],
    edges,
  });
  expect(layout.nodes).toHaveLength(10000);
  expect(new Set(layout.nodes.map((node) => node.id)).size).toBe(10000);
  expect(layout.nodes.at(-1)!.y).toBeGreaterThan(layout.nodes[0].y);
});

it("places shared ancestors below all predecessors and packs independent histories without overlaps", () => {
  const graph = buildProofGraph(proofForest().archive);
  const layout = layoutProofGraph(graph);
  const positions = new Map(layout.nodes.map((node) => [node.id, node]));
  for (const { source, target } of graph.edges)
    expect(positions.get(target)!.y).toBeGreaterThan(positions.get(source)!.y);
  const bounds = graph.components.map((component) => {
    const members = component.members.map((id) => positions.get(id)!);
    return {
      left: Math.min(...members.map((n) => n.x)),
      right: Math.max(...members.map((n) => n.x + 140)),
      top: Math.min(...members.map((n) => n.y)),
      bottom: Math.max(...members.map((n) => n.y + 116)),
    };
  });
  const [a, b] = bounds;
  expect(
    a.right < b.left ||
      b.right < a.left ||
      a.bottom < b.top ||
      b.bottom < a.top,
  ).toBe(true);
  expect(layout.histories).toHaveLength(2);
});
