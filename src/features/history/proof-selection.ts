import {
  inspectArchive,
  selectArchive,
  stringifyArchive,
} from "../../contract/sdk";
import type { ProofGraph } from "./proof-graph";

export type ProofSelectionScope =
  | "record"
  | "history"
  | "continuations"
  | "connected";

/** Traverse saved links, not dates or the subset currently rendered on the canvas. */
export function proofSelectionScope(
  graph: ProofGraph,
  roots: Iterable<string>,
  scope: ProofSelectionScope,
): Set<string> {
  const visited = new Set(roots);
  const records = new Set<string>();
  for (const pda of visited) {
    const node = graph.nodes.get(pda);
    if (!node) continue;
    if (node.record) records.add(pda);
    if (scope === "history" || scope === "connected")
      node.dependencies.forEach((key) => visited.add(key));
    if (scope === "continuations" || scope === "connected")
      node.referencedBy.forEach((key) => visited.add(key));
  }
  return records;
}

export function changeProofSelection(
  selected: ReadonlySet<string>,
  records: Iterable<string>,
  include: boolean,
) {
  const next = new Set(selected);
  for (const pda of records) {
    if (include) next.add(pda);
    else next.delete(pda);
  }
  return next.size === selected.size &&
    [...next].every((pda) => selected.has(pda))
    ? selected
    : next;
}

/** Exact subset: do not silently re-add exclusions or rewrite committed references. */
export function exportProofSelection(
  graph: ProofGraph,
  selected: ReadonlySet<string>,
) {
  const archive = selectArchive(graph.archive, [...selected], false);
  return {
    archive,
    inspection: inspectArchive(archive),
    json: stringifyArchive(archive),
  };
}
