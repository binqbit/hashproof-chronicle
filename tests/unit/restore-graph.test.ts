import { afterEach, expect, it, vi } from "vitest";
import { BN, BorshAccountsCoder } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import {
  createReadClient,
  createSigningClient,
} from "../../src/contract/client";
import {
  ArchiveRestoreExecutionError,
  IDL,
  archiveFromProof,
  createArchive,
  encodeHashSource,
  parseArchive,
  type RestoreProofInput,
} from "../../src/contract/sdk";
import {
  executeGraphRestore,
  planGraphRestore,
  restoreGraphHighlight,
} from "../../src/features/history/restore-graph";
import { readRestoreAnchors } from "../../src/features/history/restore-anchors";
import { shortestRestorePaths } from "../../src/features/history/restore-paths";
import {
  buildProofGraph,
  graphEdgeId,
} from "../../src/features/history/proof-graph";
import {
  aggregate,
  fileRecord,
  idOf,
  pdaOf,
  proofForest,
  version,
} from "../fixtures/proof-forest";

afterEach(() => vi.restoreAllMocks());
async function fixture(entries: RestoreProofInput[]) {
  const connection = new Connection("http://127.0.0.1:8899");
  const records = new Map();
  for (const entry of entries) {
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("hash"), Buffer.from(idOf(entry))],
      new PublicKey(IDL.address),
    );
    records.set(pda.toBase58(), {
      owner: new PublicKey(IDL.address),
      executable: false,
      lamports: 1,
      rentEpoch: 0,
      data: await new BorshAccountsCoder(IDL).encode("hashAccount", {
        hash: [...Buffer.from(entry.hash as Uint8Array)],
        source: encodeHashSource(entry.source),
        createdAt: new BN(entry.createdAt.toString()),
        voters: new BN(1),
        bump,
      }),
    });
  }
  const read = vi
    .spyOn(connection, "getAccountInfo")
    .mockImplementation(async (pda) => records.get(pda.toBase58()) ?? null);
  const payer = new PublicKey(new Uint8Array(32).fill(6));
  const sign = vi.fn(async () => {
    throw new Error("must not sign in tests");
  });
  return {
    connection,
    records,
    read,
    payer,
    sign,
    client: createReadClient(connection),
    signer: createSigningClient(connection, {
      publicKey: payer,
      signTransaction: sign,
      signAllTransactions: sign,
    }),
  };
}

it("finds the nearer matching anchor without a wallet and highlights its shortest route", async () => {
  const f = proofForest(),
    rpc = await fixture([f.pack, f.branch]);
  const plan = await planGraphRestore(rpc.client, f.archive, [pdaOf(f.first)]);
  expect(plan.steps).toHaveLength(1);
  expect(plan.steps[0].anchor).toBe(pdaOf(f.branch));
  expect(plan.steps[0].expectedCreations).toEqual([pdaOf(f.first)]);
  const view = restoreGraphHighlight(buildProofGraph(f.archive), plan);
  expect([...view.anchors]).toEqual([pdaOf(f.branch)]);
  expect([...view.proofEdges]).toEqual([
    graphEdgeId(pdaOf(f.branch), pdaOf(f.first)),
  ]);
  expect(rpc.sign).not.toHaveBeenCalled();
});

it("exposes mandatory intermediate creations and blocks them until explicitly selected", async () => {
  const f = proofForest(),
    rpc = await fixture([f.pack]);
  const targets = [pdaOf(f.first)];
  const plan = await planGraphRestore(
    rpc.client,
    f.archive,
    targets,
    rpc.payer,
  );
  expect(new Set(plan.steps[0].additionalRequiredCreations)).toEqual(
    new Set([pdaOf(f.batch), pdaOf(f.branch)]),
  );
  expect(plan.steps[0].requestedAccounts).not.toContain(pdaOf(f.second));
  await expect(
    executeGraphRestore(rpc.signer, f.archive, targets, plan),
  ).rejects.toThrow("Select the required");
  expect(rpc.sign).not.toHaveBeenCalled();
  const explicit = await planGraphRestore(
    rpc.client,
    f.archive,
    [...targets, pdaOf(f.batch), pdaOf(f.branch)],
    rpc.payer,
  );
  expect(
    explicit.steps.every((step) => !step.additionalRequiredCreations.length),
  ).toBe(true);
});

it("rejects conflicting live history and RPC errors, and recognizes already-present targets", async () => {
  const f = proofForest(),
    rpc = await fixture([f.branch, { ...f.first, createdAt: 1900000000n }]);
  await expect(
    planGraphRestore(rpc.client, f.archive, [pdaOf(f.first)]),
  ).rejects.toThrow("Historical incarnation conflict");
  rpc.read.mockRejectedValue(new Error("RPC offline"));
  await expect(
    planGraphRestore(rpc.client, f.archive, [pdaOf(f.first)]),
  ).rejects.toThrow("RPC offline");
  const present = await fixture([f.first]);
  const plan = await planGraphRestore(present.client, f.archive, [
    pdaOf(f.first),
  ]);
  expect(plan.steps).toHaveLength(0);
  expect(plan.alreadyPresent).toEqual([pdaOf(f.first)]);
});

it("rechecks state before signing and refuses a changed plan", async () => {
  const f = proofForest(),
    rpc = await fixture([f.branch]);
  const targets = [pdaOf(f.first)];
  const reviewed = await planGraphRestore(
    rpc.client,
    f.archive,
    targets,
    rpc.payer,
  );
  const changed = { ...reviewed, alreadyPresent: targets, steps: [] };
  vi.spyOn(rpc.signer, "planRestore").mockResolvedValue(changed);
  const send = vi.spyOn(rpc.signer, "executeRestorePlan");
  await expect(
    executeGraphRestore(rpc.signer, f.archive, targets, reviewed),
  ).rejects.toThrow("Network state or wallet changed");
  expect(send).not.toHaveBeenCalled();
});

it("preserves confirmed transactions and proof after a later step fails", async () => {
  const f = proofForest(),
    rpc = await fixture([f.branch]);
  const targets = [pdaOf(f.first)];
  const reviewed = await planGraphRestore(
    rpc.client,
    f.archive,
    targets,
    rpc.payer,
  );
  vi.spyOn(rpc.signer, "planRestore").mockResolvedValue(reviewed);
  const completed = {
    signatures: ["first-confirmed"],
    archive: archiveFromProof(IDL.address, [fileRecord(90)]),
  };
  vi.spyOn(rpc.signer, "executeRestorePlan").mockRejectedValue(
    new ArchiveRestoreExecutionError(completed, 1, new Error("second failed")),
  );
  const receipt = await executeGraphRestore(
    rpc.signer,
    f.archive,
    targets,
    reviewed,
  );
  expect(receipt.signatures).toEqual(completed.signatures);
  expect(receipt.archive).toEqual(completed.archive);
  expect(receipt.warning).toContain("1 confirmed");
  vi.spyOn(rpc.signer, "executeRestorePlan").mockRejectedValue(
    new ArchiveRestoreExecutionError(
      { signatures: [], archive: createArchive(IDL.address) },
      0,
      new Error("first failed"),
    ),
  );
  await expect(
    executeGraphRestore(rpc.signer, f.archive, targets, reviewed),
  ).rejects.toThrow("first failed");
});

it("plans independent anchors and executes a fresh reviewed plan without losing receipts", async () => {
  const f = proofForest(),
    otherBranch = version(f.second, 80);
  const archive = archiveFromProof(IDL.address, [
    f.branch,
    f.first,
    otherBranch,
    f.second,
  ]);
  const rpc = await fixture([f.branch, otherBranch]);
  const targets = [pdaOf(f.first), pdaOf(f.second)];
  const reviewed = await planGraphRestore(
    rpc.client,
    archive,
    targets,
    rpc.payer,
  );
  expect(reviewed.steps).toHaveLength(2);
  const highlighted = restoreGraphHighlight(buildProofGraph(archive), reviewed);
  expect(highlighted.anchors).toEqual(
    new Set([pdaOf(f.branch), pdaOf(otherBranch)]),
  );
  expect(highlighted.proofEdges).toEqual(
    new Set([
      graphEdgeId(pdaOf(f.branch), pdaOf(f.first)),
      graphEdgeId(pdaOf(otherBranch), pdaOf(f.second)),
    ]),
  );
  const send = vi.spyOn(rpc.signer, "executeRestorePlan").mockResolvedValue({
    signatures: ["first-confirmed", "second-confirmed"],
    archive,
  });
  const receipt = await executeGraphRestore(
    rpc.signer,
    archive,
    targets,
    reviewed,
  );
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][0]).not.toBe(reviewed);
  expect(send.mock.calls[0][0].steps).toEqual(reviewed.steps);
  expect(receipt.signature).toBe("second-confirmed");
  expect(receipt.signatures).toEqual(["first-confirmed", "second-confirmed"]);
  expect(receipt.archive).toEqual(archive);
  expect(receipt.proof).toHaveLength(4);
  expect(receipt.warning).toBeUndefined();
  expect(rpc.sign).not.toHaveBeenCalled();
});

it("detects the real example Pack independently of oversized or zero-step restore plans", async () => {
  const archive = parseArchive(
    readFileSync("examples/proof-chain/proof-chain.json", "utf8"),
  );
  const dump = JSON.parse(
    readFileSync("examples/proof-chain/ledger/pack.json", "utf8"),
  );
  const rpc = await fixture([]);
  rpc.records.set(dump.pubkey, {
    ...dump.account,
    owner: new PublicKey(dump.account.owner),
    data: Buffer.from(dump.account.data[0], "base64"),
  });
  const states = await readRestoreAnchors(rpc.client, archive);
  expect(states.get(dump.pubkey)).toEqual({ kind: "live" });
  expect(
    [...states.values()].filter((state) => state.kind === "missing"),
  ).toHaveLength(23);
  const [target] = Object.entries(archive.nodes).find(
    ([, node]) => node.source.kind === "hash",
  )!;
  await expect(planGraphRestore(rpc.client, archive, [target])).rejects.toThrow(
    /No complete, live, transaction-sized proof/,
  );
  const graph = buildProofGraph(archive);
  expect(restoreGraphHighlight(graph, undefined, states).anchors).toEqual(
    new Set([dump.pubkey]),
  );
  const present = await planGraphRestore(rpc.client, archive, [dump.pubkey]);
  expect(present.steps).toHaveLength(0);
  expect(restoreGraphHighlight(graph, present).anchors).toEqual(
    new Set([dump.pubkey]),
  );
  expect(rpc.sign).not.toHaveBeenCalled();
});

it("does not misclassify conflicts, malformed live accounts or failed reads as trusted anchors", async () => {
  const f = proofForest(),
    rpc = await fixture([
      f.first,
      { ...f.second, createdAt: 1800000000n },
      f.branch,
    ]);
  const originalRead = rpc.read.getMockImplementation()!;
  rpc.records.get(pdaOf(f.branch)).data[0] ^= 0xff; // invalid discriminator
  rpc.read.mockImplementation(async (...args) => {
    if (args[0].toBase58() === pdaOf(f.pack)) throw new Error("RPC offline");
    return originalRead(...args);
  });
  const states = await readRestoreAnchors(rpc.client, f.archive);
  expect(states.get(pdaOf(f.first))?.kind).toBe("live");
  expect(states.get(pdaOf(f.second))?.kind).toBe("conflict");
  expect(states.get(pdaOf(f.branch))?.kind).toBe("error");
  expect(states.get(pdaOf(f.pack))).toEqual({
    kind: "error",
    message: "RPC offline",
  });
  expect(states.get(pdaOf(f.unrelated))?.kind).toBe("missing");
  expect(
    restoreGraphHighlight(buildProofGraph(f.archive), undefined, states)
      .anchors,
  ).toEqual(new Set([pdaOf(f.first)]));
});

it("bounds anchor reads and stops scheduling more after cancellation", async () => {
  const rpc = await fixture([]),
    controller = new AbortController();
  const archive = archiveFromProof(
    IDL.address,
    Array.from({ length: 20 }, (_, i) => fileRecord(i + 1)),
  );
  rpc.read.mockImplementation(async () => {
    controller.abort();
    return null;
  });
  await expect(
    readRestoreAnchors(rpc.client, archive, controller.signal),
  ).rejects.toThrow();
  expect(rpc.read.mock.calls.length).toBeLessThanOrEqual(8);
});

it("highlights connecting history without a transaction plan, but not unrelated or incomplete paths", () => {
  const f = proofForest(),
    anchors = new Set([pdaOf(f.pack)]);
  const graph = buildProofGraph(f.archive);
  const paths = shortestRestorePaths(graph, anchors, [pdaOf(f.first)]);
  expect(paths.proofEdges).toEqual(
    new Set([
      graphEdgeId(pdaOf(f.pack), pdaOf(f.batch)),
      graphEdgeId(pdaOf(f.batch), pdaOf(f.branch)),
      graphEdgeId(pdaOf(f.branch), pdaOf(f.first)),
    ]),
  );
  expect(
    shortestRestorePaths(graph, anchors, [pdaOf(f.unrelated)]).proofEdges.size,
  ).toBe(0);
  const incomplete = parseArchive(f.archive);
  delete incomplete.nodes[pdaOf(f.second)];
  expect(
    shortestRestorePaths(buildProofGraph(incomplete), anchors, [pdaOf(f.first)])
      .proofEdges.size,
  ).toBe(0);
});

it("previews only the shortest route from the nearest complete live anchor", () => {
  const f = proofForest();
  const paths = shortestRestorePaths(
    buildProofGraph(f.archive),
    new Set([pdaOf(f.pack), pdaOf(f.branch)]),
    [pdaOf(f.first)],
  );
  expect(paths.proofEdges).toEqual(
    new Set([graphEdgeId(pdaOf(f.branch), pdaOf(f.first))]),
  );
  expect(paths.proofNodes).toEqual(new Set([pdaOf(f.branch), pdaOf(f.first)]));
  const tied = [pdaOf(f.branch), pdaOf(f.sibling)];
  const tiePaths = shortestRestorePaths(buildProofGraph(f.archive), new Set(tied), [pdaOf(f.first)]);
  expect(tiePaths.proofEdges).toEqual(
    new Set([graphEdgeId([...tied].sort()[0], pdaOf(f.first))]),
  );
  expect(shortestRestorePaths(buildProofGraph(f.archive), new Set(tied.reverse()), [pdaOf(f.first)]))
    .toEqual(tiePaths);
});

it("chooses one deterministic shortest path through converging groups, including multiple targets", () => {
  const f = proofForest();
  const longer = version(f.branch, 20, 1700000002n);
  const pack = aggregate("pack", [longer, f.branch, f.sibling, f.second], 1700000003n);
  const archive = archiveFromProof(IDL.address, [
    pack, longer, f.branch, f.sibling, f.first, f.second,
  ]);
  const graph = buildProofGraph(archive);
  const anchor = pdaOf(pack), target = pdaOf(f.first);
  const paths = shortestRestorePaths(graph, new Set([anchor]), [target]);
  expect(paths.proofEdges.size).toBe(2);
  expect(paths.proofNodes.has(pdaOf(longer))).toBe(false);
  const shortBranch = [f.branch, f.sibling].map((entry) => pdaOf(entry)).find((pda) => paths.proofNodes.has(pda))!;
  expect(paths.proofEdges).toEqual(new Set([
    graphEdgeId(anchor, shortBranch), graphEdgeId(shortBranch, target),
  ]));
  const reordered = { ...archive, nodes: Object.fromEntries(Object.entries(archive.nodes).reverse()) };
  expect(shortestRestorePaths(buildProofGraph(reordered), new Set([anchor]), [target])).toEqual(paths);
  const multiple = shortestRestorePaths(graph, new Set([anchor]), [pdaOf(f.second), target]);
  expect(multiple.proofEdges).toEqual(new Set([
    ...paths.proofEdges, graphEdgeId(anchor, pdaOf(f.second)),
  ]));
  expect(shortestRestorePaths(graph, new Set([anchor]), [anchor]).proofEdges.size).toBe(0);
});

it("keeps supporting group siblings dim after planning without removing them from the proof", async () => {
  const f = proofForest(), rpc = await fixture([f.pack]);
  const plan = await planGraphRestore(rpc.client, f.archive, [pdaOf(f.first)]);
  expect(plan.steps[0].proof.map((entry) => pdaOf(entry))).toContain(pdaOf(f.second));
  const view = restoreGraphHighlight(buildProofGraph(f.archive), plan);
  expect(view.proofEdges).toEqual(new Set([
    graphEdgeId(pdaOf(f.pack), pdaOf(f.batch)),
    graphEdgeId(pdaOf(f.batch), pdaOf(f.branch)),
    graphEdgeId(pdaOf(f.branch), pdaOf(f.first)),
  ]));
  expect(view.proofNodes.has(pdaOf(f.second))).toBe(false);
  expect(view.required).toEqual(new Set([pdaOf(f.batch), pdaOf(f.branch)]));
});

it("uses SDK-validated live Account witnesses for a checked path without an archived snapshot", async () => {
  const target = fileRecord(40);
  const account: RestoreProofInput = {
    hash: new Uint8Array(32).fill(41),
    source: { kind: "account", account: new PublicKey(new Uint8Array(32).fill(42)) },
    createdAt: 1700000001n,
    params: { kind: "account" },
  };
  const pack = aggregate("pack", [target, account]);
  const archive = archiveFromProof(IDL.address, [pack, target, account]);
  const rpc = await fixture([pack, account]);
  const graph = buildProofGraph(archive);
  expect(graph.inspection.missingWitnesses).toEqual([
    { pda: pdaOf(account), field: "snapshot" },
  ]);
  // Offline history alone is incomplete; the planner verifies the live witness.
  expect(shortestRestorePaths(graph, new Set([pdaOf(pack)]), [pdaOf(target)]).proofEdges.size).toBe(0);
  const plan = await planGraphRestore(rpc.client, archive, [pdaOf(target)]);
  expect(plan.steps[0].requestedAccounts).toContain(pdaOf(account));
  expect(plan.steps[0].expectedCreations).not.toContain(pdaOf(account));
  expect(restoreGraphHighlight(graph, plan).proofEdges).toEqual(
    new Set([graphEdgeId(pdaOf(pack), pdaOf(target))]),
  );
});

it("does not highlight a second route to a target already covered by an earlier planned step", async () => {
  const first = fileRecord(50), shared = fileRecord(51), last = fileRecord(52);
  const left = aggregate("pack", [first, shared]);
  const right = aggregate("pack", [shared, last]);
  const archive = archiveFromProof(IDL.address, [left, right, first, shared, last]);
  const rpc = await fixture([left, right]);
  const plan = await planGraphRestore(rpc.client, archive, [first, shared, last].map((entry) => pdaOf(entry)));
  expect(plan.steps).toHaveLength(2);
  expect(plan.steps.every((step) => step.targets.includes(pdaOf(shared)))).toBe(true);
  const graph = buildProofGraph(archive), view = restoreGraphHighlight(graph, plan);
  expect(view.proofEdges.size).toBe(3);
  expect(view.proofEdges.has(graphEdgeId(plan.steps[0].anchor, pdaOf(shared)))).toBe(true);
  expect(view.proofEdges.has(graphEdgeId(plan.steps[1].anchor, pdaOf(shared)))).toBe(false);
});
