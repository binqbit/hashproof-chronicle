import {
  canonicalHashId,
  inspectArchive,
  parseArchive,
  type ArchiveNode,
  type HashArchive,
} from "../../contract/sdk";
import { hex } from "../workspace/values";
import { archiveLinks } from "./archive-links";

export const graphEdgeId = (source: string, target: string) => `${source}-${target}`;

export interface ProofGraphNode {
  pda: string;
  id?: string;
  record?: ArchiveNode;
  dependencies: readonly string[];
  referencedBy: string[];
}

export const nodeKind = (node: ProofGraphNode) => {
  const kind = node.record?.source.kind;
  return kind ? kind[0].toUpperCase() + kind.slice(1) : "Missing record";
};

export interface ProofGraphComponent {
  key: string;
  records: number;
  missing: number;
  heads: string[];
  members: string[];
}

export interface ProofGraphEdge {
  source: string;
  target: string;
  /** One-based Batch/Pack membership order; Branch edges have no member index. */
  member?: number;
}

/** Local presentation model only. The public SDK validates the imported history. */
export function buildProofGraph(input: HashArchive) {
  const archive = parseArchive(input);
  const inspection = inspectArchive(archive);
  const links = archiveLinks(archive.programId);
  const nodes = new Map<string, ProofGraphNode>();
  const edges: ProofGraphEdge[] = [];
  const ensure = (pda: string) => {
    if (!nodes.has(pda))
      nodes.set(pda, { pda, dependencies: [], referencedBy: [] });
    return nodes.get(pda)!;
  };
  for (const [pda, record] of Object.entries(archive.nodes)) {
    const node = ensure(pda);
    node.record = record;
    const kind = { hash: 0, account: 1, branch: 2, batch: 3, pack: 4 } as const;
    node.id = hex(canonicalHashId(record.hash, kind[record.source.kind]));
    node.dependencies = links(record) ?? [];
    node.dependencies.forEach((dependency, index) => {
      ensure(dependency).referencedBy.push(pda);
      edges.push({
        source: pda,
        target: dependency,
        member: record.source.kind === "branch" ? undefined : index + 1,
      });
    });
  }

  // Include missing-reference placeholders when finding connected histories.
  // Otherwise branches with a shared, absent parent would look unrelated.
  const components: ProofGraphComponent[] = [];
  const seen = new Set<string>();
  for (const pda of [...nodes.keys()].sort()) {
    if (seen.has(pda)) continue;
    const connected = [pda];
    seen.add(pda);
    for (let i = 0; i < connected.length; i++) {
      const node = nodes.get(connected[i])!;
      for (const adjacent of [...node.dependencies, ...node.referencedBy])
        if (!seen.has(adjacent)) {
          seen.add(adjacent);
          connected.push(adjacent);
        }
    }
    const heads = connected
      .filter((key) => !nodes.get(key)!.referencedBy.length)
      .sort();
    const records = connected.filter((key) => nodes.get(key)!.record).length;
    components.push({
      key: pda,
      records,
      missing: connected.length - records,
      heads,
      members: connected.sort(),
    });
  }
  edges.sort(
    (a, b) =>
      a.source.localeCompare(b.source) ||
      (a.member ?? 0) - (b.member ?? 0) ||
      a.target.localeCompare(b.target),
  );
  return { archive, inspection, nodes, edges, components };
}

export type ProofGraph = ReturnType<typeof buildProofGraph>;
