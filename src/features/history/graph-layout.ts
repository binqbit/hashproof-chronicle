import dagre from "@dagrejs/dagre";
import type { ProofGraphEdge } from "./proof-graph";

// Only topology crosses the worker boundary, never account snapshots or file bytes.
export interface LayoutInput {
  components: { key: string; members: string[] }[];
  edges: ProofGraphEdge[];
}
export interface GraphPosition {
  id: string;
  x: number;
  y: number;
}
export interface GraphLayout {
  nodes: GraphPosition[];
  histories: GraphPosition[];
}

export const NODE_WIDTH = 140;
export const NODE_HEIGHT = 116;
const COLUMN = 180;
const ROW = 190;

/** Longest-path ranks keep *every* edge downward, including shared ancestors. */
function layeredLayout(members: string[], edges: ProofGraphEdge[]) {
  const indegree = new Map(members.map((id) => [id, 0]));
  const children = new Map(members.map((id) => [id, [] as string[]]));
  const ranks = new Map(members.map((id) => [id, 0]));
  for (const { source, target } of edges) {
    children.get(source)!.push(target);
    indegree.set(target, indegree.get(target)! + 1);
  }
  const queue = members.filter((id) => indegree.get(id) === 0);
  const levels: string[][] = [];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i],
      rank = ranks.get(id)!;
    (levels[rank] ??= []).push(id);
    for (const child of children.get(id)!) {
      ranks.set(child, Math.max(ranks.get(child)!, rank + 1));
      indegree.set(child, indegree.get(child)! - 1);
      if (indegree.get(child) === 0) queue.push(child);
    }
  }
  if (queue.length !== members.length)
    throw new Error("Cannot draw a cyclic proof history.");
  const width = levels.reduce(
    (max, level) => Math.max(max, level.length * COLUMN),
    COLUMN,
  );
  return levels.flatMap((level, rank) =>
    level.map((id, index) => ({
      id,
      x: (width - level.length * COLUMN) / 2 + index * COLUMN,
      y: rank * ROW,
    })),
  );
}

/** Layout each independent history separately, then pack them onto one canvas. */
export function layoutProofGraph(input: LayoutInput): GraphLayout {
  const membership = new Map<string, number>();
  input.components.forEach((component, index) =>
    component.members.forEach((id) => membership.set(id, index)),
  );
  const edgeGroups = input.components.map(() => [] as ProofGraphEdge[]);
  for (const edge of input.edges)
    edgeGroups[membership.get(edge.source)!].push(edge);
  const parts = input.components.map((component, index) => {
    const edges = edgeGroups[index];
    let positions: GraphPosition[];
    // Crossing minimization is expensive on dense/deep inputs. Large histories
    // use an iterative O(V + E) placement; no records or edges are discarded.
    if (component.members.length > 200 || edges.length > 400) {
      positions = layeredLayout(component.members, edges);
    } else {
      const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
      graph.setGraph({
        rankdir: "TB",
        nodesep: 44,
        ranksep: 74,
        ranker: "longest-path",
      });
      for (const id of component.members)
        graph.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT });
      for (const edge of edges) graph.setEdge(edge.source, edge.target);
      dagre.layout(graph);
      positions = component.members.map((id) => {
        const { x, y } = graph.node(id);
        return { id, x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 };
      });
    }
    const width = positions.reduce(
      (max, p) => Math.max(max, p.x + NODE_WIDTH),
      NODE_WIDTH,
    );
    const height = positions.reduce(
      (max, p) => Math.max(max, p.y + NODE_HEIGHT),
      NODE_HEIGHT,
    );
    return { key: component.key, positions, width, height };
  });
  const targetWidth = Math.max(
    800,
    Math.sqrt(
      parts.reduce((area, p) => area + (p.width + 100) * (p.height + 100), 0),
    ),
  );
  const result: GraphLayout = { nodes: [], histories: [] };
  let x = 0,
    y = 0,
    rowHeight = 0;
  for (const part of parts) {
    if (x && x + part.width > targetWidth) {
      x = 0;
      y += rowHeight + 100;
      rowHeight = 0;
    }
    result.histories.push({ id: part.key, x, y });
    for (const p of part.positions)
      result.nodes.push({ id: p.id, x: x + p.x, y: y + p.y + 55 });
    x += part.width + 100;
    rowHeight = Math.max(rowHeight, part.height + 55);
  }
  return result;
}
