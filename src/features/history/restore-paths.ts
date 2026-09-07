import { graphEdgeId, type ProofGraph } from "./proof-graph";

/** One fewest-edge route per target, not the full proof required by the contract. */
export function shortestRestorePaths(
  graph: ProofGraph,
  anchors: ReadonlySet<string>,
  targets: readonly string[],
  validatedProof?: ReadonlySet<string>,
) {
  // A partial group cannot authenticate a path just because one member is available.
  // A checked SDK proof already resolved witnesses, including live Account records
  // whose snapshots need not be archived. Only that trusted scope skips this check.
  const incomplete = new Set(
    validatedProof ? [] : [
      ...graph.inspection.missingNodes,
      ...graph.inspection.missingWitnesses.map(({ pda }) => pda),
    ],
  );
  for (const pda of incomplete)
    for (const parent of graph.nodes.get(pda)?.referencedBy ?? [])
      incomplete.add(parent);

  // Multi-source BFS chooses the nearest anchor. Stable anchor and member order
  // breaks equal-length ties without depending on archive object insertion order.
  const queue = [...anchors].sort().filter(
    (pda) => graph.nodes.has(pda) && !incomplete.has(pda)
      && (!validatedProof || validatedProof.has(pda)),
  );
  const predecessor = new Map<string, string | null>(
    queue.map((pda) => [pda, null]),
  );
  for (let index = 0; index < queue.length; index++) {
    const pda = queue[index];
    for (const dependency of graph.nodes.get(pda)?.dependencies ?? []) {
      if (
        predecessor.has(dependency)
        || (validatedProof && !validatedProof.has(dependency))
      )
        continue;
      predecessor.set(dependency, pda);
      queue.push(dependency);
    }
  }

  const proofNodes = new Set<string>();
  const proofEdges = new Set<string>();
  for (const target of targets) {
    if (anchors.has(target) || !predecessor.has(target)) continue;
    let pda = target;
    while (!proofNodes.has(pda)) {
      proofNodes.add(pda);
      const parent = predecessor.get(pda);
      if (parent == null) break;
      proofEdges.add(graphEdgeId(parent, pda));
      pda = parent;
    }
  }
  return { proofNodes, proofEdges };
}
