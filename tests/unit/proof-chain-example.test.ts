import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { BorshAccountsCoder, BorshInstructionCoder } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { expect, it } from "vitest";
import {
  generateArtifacts,
  generateProofChain,
} from "../../examples/proof-chain/generate";
import {
  archiveFromProof,
  buildRestoreProof,
  canonicalHashId,
  IDL,
  inspectArchive,
  parseArchive,
  prepareRestore,
  stringifyArchive,
} from "../../src/contract/sdk";
import { buildProofGraph, graphEdgeId } from "../../src/features/history/proof-graph";
import { shortestRestorePaths } from "../../src/features/history/restore-paths";
import {
  checkFileProof,
  findFileInArchive,
} from "../../src/features/history/file-proof";
import { validateProof } from "../../src/features/history/validate-proof";
import { recordFixture } from "./fixtures/records";

const directory = resolve("examples/proof-chain");
const read = (path: string) => readFileSync(resolve(directory, path), "utf8");
const archive = parseArchive(read("proof-chain.json"));
const example = generateProofChain();
const address = (name: string) =>
  example.records.find((record) => record.name === name)!.pda;
const graph = buildProofGraph(archive);

it("reproduces every committed artifact, including actual file bytes and genesis dumps", async () => {
  for (const [path, contents] of Object.entries(await generateArtifacts()))
    expect(read(path), path).toBe(contents);
  expect(readdirSync(resolve(directory, "files"))).toHaveLength(19);
  expect(archive).toEqual(example.archive);
  expect(inspectArchive(archive)).toEqual({
    complete: true,
    missingNodes: [],
    missingWitnesses: [],
  });
});

it("contains exactly the approved graph, including shared members, forks and all five types", () => {
  expect(graph.nodes.size).toBe(24);
  expect(graph.edges).toHaveLength(26);
  expect(graph.components).toHaveLength(1);
  expect(graph.components[0].heads).toEqual([address("Pack")]);
  const expected = {
    A: [],
    B: [],
    C: [],
    Account: [],
    A1: ["A"],
    B1: ["B"],
    B2: ["B1"],
    B3: ["B2"],
    C1: ["C"],
    C2: ["C1"],
    C3: ["C2"],
    C4: ["C3"],
    Batch1: ["A1", "B3", "C4"],
    Batch2: ["B3", "C4"],
    X1: ["Batch1"],
    X2: ["X1"],
    Y1: ["Batch2"],
    Batch3: ["X2", "Y1"],
    L1: ["Batch3"],
    L2: ["L1"],
    R1: ["Batch3"],
    R2: ["R1"],
    R3: ["R2"],
    Pack: ["L2", "R3", "Account"],
  };
  const counts: Record<string, number> = {};
  for (const [name, inputs] of Object.entries(expected)) {
    const node = graph.nodes.get(address(name))!;
    expect(node.dependencies, name).toEqual(inputs.map(address));
    counts[node.record!.source.kind] =
      (counts[node.record!.source.kind] ?? 0) + 1;
    for (const parent of node.dependencies)
      expect(BigInt(node.record!.createdAt)).toBeGreaterThan(
        BigInt(archive.nodes[parent].createdAt),
      );
  }
  expect(counts).toEqual({
    hash: 3,
    account: 1,
    branch: 16,
    batch: 3,
    pack: 1,
  });
});

it("highlights only the shorter left fork from the live Pack to file A", () => {
  const path = ["Pack", "L2", "L1", "Batch3", "X2", "X1", "Batch1", "A1", "A"].map(address);
  const view = shortestRestorePaths(graph, new Set([address("Pack")]), [address("A")]);
  expect(view.proofNodes).toEqual(new Set(path));
  expect(view.proofEdges).toEqual(new Set(
    path.slice(1).map((pda, index) => graphEdgeId(path[index], pda)),
  ));
});

it("authenticates the real files, canonical IDs and every PDA independently", () => {
  const kinds = { hash: 0, account: 1, branch: 2, batch: 3, pack: 4 };
  for (const record of example.records) {
    const node = archive.nodes[record.pda];
    const id = createHash("sha256")
      .update(Buffer.from(node.hash, "hex"))
      .update(Buffer.from([kinds[node.source.kind]]))
      .digest();
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("hash"), id],
      new PublicKey(archive.programId),
    );
    expect(pda.toBase58()).toBe(record.pda);
    if (!record.file) continue;
    const bytes = readFileSync(resolve(directory, record.file));
    const hash = createHash("sha256").update(bytes).digest("hex");
    expect(hash).toBe(
      node.source.kind === "branch" ? node.source.payload : node.hash,
    );
    expect(
      findFileInArchive(archive, hash).matches.map((match) => match.pda),
    ).toEqual([record.pda]);
    expect(
      createHash("sha256").update(bytes.subarray(0, -1)).digest("hex"),
    ).not.toBe(hash);
  }
  expect(read("files/A.txt")).toBe("Hello World 1\n");
  expect(read("files/B.txt")).toBe("Hello World 2\n");
  expect(read("files/C.txt")).toBe("Hello World 3\n");
});

it("compiles and validates full history without claiming that it fits one transaction", () => {
  const proof = buildRestoreProof(archive, {
    anchor: address("Pack"),
    targets: [address("A")],
  });
  expect(proof).toHaveLength(24);
  expect(proof[0].source.kind).toBe("pack");
  expect(validateProof(proof)).toMatchObject({
    needsExisting: [],
    warnings: [],
  });
  expect(stringifyArchive(archiveFromProof(archive.programId, proof))).toBe(
    stringifyArchive(archive),
  );
  const prepared = prepareRestore(proof, false);
  expect(() =>
    new BorshInstructionCoder(IDL).encode("restore", {
      proofChain: prepared.proofEncoded,
    }),
  ).toThrow(/encoding overruns Buffer|offset.*out of range/);
});

it("seeds only the final live Pack and its consistent initial vote", async () => {
  const coder = new BorshAccountsCoder(IDL);
  const pack = JSON.parse(read("ledger/pack.json"));
  const vote = JSON.parse(read("ledger/pack-vote.json"));
  expect(readdirSync(resolve(directory, "ledger")).sort()).toEqual([
    "pack-vote.json",
    "pack.json",
    "program-id.txt",
  ]);
  const packData = Buffer.from(pack.account.data[0], "base64");
  const voteData = Buffer.from(vote.account.data[0], "base64");
  const record = coder.decode("hashAccount", packData);
  const witness = coder.decode("voteInfo", voteData);
  expect(pack.pubkey).toBe(address("Pack"));
  expect(pack.account.owner).toBe(archive.programId);
  expect(vote.account.owner).toBe(archive.programId);
  expect(pack.account.data[1]).toBe("base64");
  expect(vote.account.data[1]).toBe("base64");
  expect(pack.account.executable).toBe(false);
  expect(vote.account.executable).toBe(false);
  expect(pack.account.space).toBe(64);
  expect(vote.account.space).toBe(88);
  expect(pack.account.lamports).toBeGreaterThanOrEqual(1_336_320);
  expect(vote.account.lamports).toBeGreaterThanOrEqual(1_503_360);
  expect(packData.length).toBe(64);
  expect(voteData.length).toBe(88);
  expect(packData.subarray(58)).toEqual(Buffer.alloc(6));
  expect(voteData.subarray(81)).toEqual(Buffer.alloc(7));
  expect(record.source).toEqual({ pack: {} });
  expect(record.voters.toString()).toBe("1");
  expect(record.createdAt.toString()).toBe(
    archive.nodes[pack.pubkey].createdAt,
  );
  expect(Buffer.from(record.hash).toString("hex")).toBe(
    archive.nodes[pack.pubkey].hash,
  );
  const id = canonicalHashId(record.hash, { kind: "pack" });
  expect(Buffer.from(witness.hashId)).toEqual(Buffer.from(id));
  expect(witness.amount.toNumber()).toBe(pack.account.lamports);
  const [packPda, packBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("hash"), Buffer.from(id)],
    new PublicKey(archive.programId),
  );
  const [votePda, voteBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("vote"), witness.voter.toBuffer(), Buffer.from(id)],
    new PublicKey(archive.programId),
  );
  expect(packPda.toBase58()).toBe(pack.pubkey);
  expect(votePda.toBase58()).toBe(vote.pubkey);
  expect(record.bump).toBe(packBump);
  expect(witness.bump).toBe(voteBump);
});

it("checks original files and a late version through only the seeded Pack via fake RPC", async () => {
  const fixture = recordFixture();
  const pack = JSON.parse(read("ledger/pack.json"));
  fixture.read.mockImplementation(async (key) =>
    key.toBase58() === pack.pubkey
      ? {
          ...pack.account,
          owner: new PublicKey(pack.account.owner),
          data: Buffer.from(pack.account.data[0], "base64"),
        }
      : null,
  );
  for (const name of ["A", "B", "C", "R3"]) {
    const hash = createHash("sha256")
      .update(readFileSync(resolve(directory, `files/${name}.txt`)))
      .digest("hex");
    expect(
      await checkFileProof(fixture.client, archive, hash, address(name)),
    ).toMatchObject({
      matched: true,
      anchor: pack.pubkey,
      anchorKind: "pack",
    });
  }
  fixture.read.mockResolvedValue(null);
  expect(
    (
      await checkFileProof(
        fixture.client,
        archive,
        archive.nodes[address("A")].hash,
        address("A"),
      )
    ).matched,
  ).toBe(false);
});

it("rejects changed commitments and reports missing restore witnesses", () => {
  for (const edit of [
    (copy: typeof archive) => {
      copy.nodes[address("A")].createdAt = "1";
    },
    (copy: typeof archive) => {
      copy.nodes[address("Account")].snapshot!.lamports = "2";
    },
    (copy: typeof archive) => {
      copy.nodes[address("Pack")].members!.reverse();
    },
  ]) {
    const copy = structuredClone(archive);
    edit(copy);
    expect(() => parseArchive(copy)).toThrow();
  }
  const copy = structuredClone(archive);
  delete copy.nodes[address("Pack")].members;
  delete copy.nodes[address("Account")].snapshot;
  expect(inspectArchive(copy).missingWitnesses).toHaveLength(2);
});
