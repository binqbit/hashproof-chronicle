/** Deterministic offline example. Returns artifacts; nothing is deployed or written. */
import { createHash } from "node:crypto";
import { BN, BorshAccountsCoder } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  archiveFromProof,
  canonicalHashId,
  deriveAccountMetadataHash,
  deriveBatchHash,
  deriveBranchHash,
  deriveHashPda,
  derivePackHash,
  encodeHashSource,
  generationFromSource,
  hashAccountSpace,
  hashSourceKindOf,
  IDL,
  inspectArchive,
  stringifyArchive,
  VOTE_INFO_SPACE,
  type RestoreProofInput,
} from "../../src/contract/sdk";

const digest = (text: string) =>
  createHash("sha256").update(text, "utf8").digest();
const start = BigInt(Date.parse("2026-09-01T12:00:00Z") / 1000);

export function generateProofChain() {
  const entries = new Map<string, RestoreProofInput>();
  const contents = new Map<string, string>();
  const files: Record<string, string> = {};
  const records: {
    name: string;
    pda: string;
    kind: RestoreProofInput["source"]["kind"];
    time: string;
    dependencies: string[];
    file?: string;
  }[] = [];
  const program = new PublicKey(IDL.address);
  const fingerprint = (entry: RestoreProofInput) => ({
    hash: entry.hash,
    sourceKind: hashSourceKindOf(entry.source),
    createdAt: entry.createdAt,
    generation: generationFromSource(entry.source),
  });
  const get = (name: string) => {
    const entry = entries.get(name);
    if (!entry) throw new Error(`Missing example dependency: ${name}`);
    return entry;
  };
  const id = (entry: RestoreProofInput) =>
    canonicalHashId(entry.hash, entry.source);
  const time = (minutes: number) => start + BigInt(minutes * 60);

  function add(
    name: string,
    entry: RestoreProofInput,
    dependencies: string[],
    text?: string,
  ) {
    if (entries.has(name)) throw new Error(`Duplicate example label: ${name}`);
    for (const parent of dependencies)
      if (
        BigInt(get(parent).createdAt.toString()) >=
        BigInt(entry.createdAt.toString())
      )
        throw new Error(`${name} must be later than ${parent}`);
    entries.set(name, entry);
    const file = text === undefined ? undefined : `files/${name}.txt`;
    if (text !== undefined) {
      files[file!] = text;
      contents.set(name, text);
    }
    records.push({
      name,
      pda: deriveHashPda(program, id(entry)).toBase58(),
      kind: entry.source.kind,
      time: new Date(Number(entry.createdAt) * 1000).toISOString(),
      dependencies,
      file,
    });
  }

  function hash(name: string, number: number, minutes: number) {
    const text = `Hello World ${number}\n`;
    add(
      name,
      {
        hash: digest(text),
        source: { kind: "hash" },
        createdAt: time(minutes),
      },
      [],
      text,
    );
  }

  function branch(name: string, parent: string, minutes: number) {
    const previous = get(parent);
    const meta = fingerprint(previous);
    const parentText = contents.get(parent);
    if (parentText === undefined)
      throw new Error(`Missing source text for ${parent}`);
    const text = `${parentText}Version ${name}\n`;
    const payload = digest(text);
    add(
      name,
      {
        hash: deriveBranchHash(
          id(previous),
          previous.createdAt,
          meta.generation,
          meta.sourceKind,
          payload,
        ),
        source: {
          kind: "branch",
          previousHashId: id(previous),
          payload,
          generation: BigInt(meta.generation.toString()) + 1n,
        },
        createdAt: time(minutes),
        params: { kind: "branch", parent: meta },
      },
      [parent],
      text,
    );
  }

  function group(
    name: string,
    kind: "batch" | "pack",
    names: string[],
    minutes: number,
  ) {
    const members = names.map((label) => fingerprint(get(label)));
    const input = members.map((member) => ({
      ...member,
      kind: member.sourceKind,
    }));
    add(
      name,
      {
        hash: kind === "batch" ? deriveBatchHash(input) : derivePackHash(input),
        source:
          kind === "batch"
            ? { kind, members: names.map((label) => id(get(label))) }
            : { kind },
        createdAt: time(minutes),
        params: { kind, members },
      },
      names,
    );
    // A branch of an aggregate uses a real combined document as its new payload.
    if (kind === "batch")
      contents.set(
        name,
        names
          .map((label) => `--- ${label} ---\n${contents.get(label)!}`)
          .join("\n"),
      );
  }

  hash("A", 1, 0);
  hash("B", 2, 1);
  hash("C", 3, 3);

  // A fictional ordinary wallet snapshot: no secret key is exported or used on-chain.
  const target = Keypair.fromSeed(
    digest("HashProof Chronicle offline example wallet"),
  ).publicKey;
  const snapshot = {
    owner: SystemProgram.programId,
    lamports: 1_000_000_000,
    executable: false,
    rentEpoch: 0,
    data: Buffer.alloc(0),
  };
  add(
    "Account",
    {
      hash: deriveAccountMetadataHash(target, snapshot),
      source: { kind: "account", account: target },
      createdAt: time(4),
      params: { kind: "account", snapshot },
    },
    [],
  );

  branch("A1", "A", 5);
  branch("B1", "B", 6);
  branch("C1", "C", 7);
  branch("B2", "B1", 9);
  branch("C2", "C1", 10);
  branch("C3", "C2", 12);
  branch("B3", "B2", 14);
  branch("C4", "C3", 17);
  group("Batch1", "batch", ["A1", "B3", "C4"], 20);
  group("Batch2", "batch", ["B3", "C4"], 22);
  branch("X1", "Batch1", 23);
  branch("Y1", "Batch2", 25);
  branch("X2", "X1", 28);
  group("Batch3", "batch", ["X2", "Y1"], 31);
  branch("L1", "Batch3", 33);
  branch("R1", "Batch3", 34);
  branch("R2", "R1", 37);
  branch("L2", "L1", 38);
  branch("R3", "R2", 42);
  group("Pack", "pack", ["L2", "R3", "Account"], 47);

  const archive = archiveFromProof(IDL.address, [...entries.values()]);
  if (!inspectArchive(archive).complete)
    throw new Error("Incomplete example archive");
  return { archive, files, records };
}

/** Standard solana-test-validator account dumps; only Pack is a live history node. */
export async function generateGenesisAccounts() {
  const { archive, records } = generateProofChain();
  const packPda = records.find((record) => record.name === "Pack")!.pda;
  const pack = archive.nodes[packPda];
  const program = new PublicKey(archive.programId);
  const hashId = canonicalHashId(pack.hash, { kind: "pack" });
  const [address, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("hash"), Buffer.from(hashId)],
    program,
  );
  if (address.toBase58() !== packPda)
    throw new Error("Genesis Pack PDA mismatch");
  const voter = Keypair.fromSeed(
    digest("HashProof Chronicle public localnet fixture voter"),
  ).publicKey;
  const [voteAddress, voteBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("vote"), voter.toBuffer(), Buffer.from(hashId)],
    program,
  );
  const coder = new BorshAccountsCoder(IDL);
  const packSpace = hashAccountSpace({ kind: "pack" });
  // Agave's default rent: 128 bytes overhead, 3480 lamports/byte-year, 2 years.
  const rent = (space: number) => (128 + space) * 3480 * 2;
  const dump = async (
    pubkey: PublicKey,
    name: string,
    value: object,
    space: number,
  ) => {
    const encoded = await coder.encode(name, value);
    if (encoded.length > space) throw new Error(`Invalid ${name} allocation`);
    const data = Buffer.alloc(space);
    encoded.copy(data);
    return {
      pubkey: pubkey.toBase58(),
      account: {
        lamports: rent(space),
        data: [data.toString("base64"), "base64"],
        owner: program.toBase58(),
        executable: false,
        rentEpoch: 0,
        space,
      },
    };
  };
  return {
    "ledger/pack.json": await dump(
      address,
      "hashAccount",
      {
        hash: [...Buffer.from(pack.hash, "hex")],
        source: encodeHashSource({ kind: "pack" }),
        voters: new BN(1),
        createdAt: new BN(pack.createdAt),
        bump,
      },
      packSpace,
    ),
    "ledger/pack-vote.json": await dump(
      voteAddress,
      "voteInfo",
      {
        voter,
        hashId: [...hashId],
        amount: new BN(rent(packSpace)),
        bump: voteBump,
      },
      VOTE_INFO_SPACE,
    ),
  };
}

export async function generateArtifacts() {
  const { archive, files, records } = generateProofChain();
  const rows = records.map(
    (record) =>
      `| ${record.name} | ${record.kind} | ${record.time.slice(11, 19)} | ${record.dependencies.join(", ") || "—"} | ${record.file ? `[file](${record.file})` : "—"} | \`${record.pda}\` |`,
  );
  return {
    "proof-chain.json": `${stringifyArchive(archive)}\n`,
    ...files,
    ...Object.fromEntries(
      Object.entries(await generateGenesisAccounts()).map(([path, account]) => [
        path,
        `${JSON.stringify(account, null, 2)}\n`,
      ]),
    ),
    "ledger/program-id.txt": `${archive.programId}\n`,
    "nodes.md": [
      "# Example node index",
      "",
      "All times are fictional UTC timestamps on 1 September 2026. Labels and file paths are only in this index, not in the proof archive.",
      "",
      "| Label | Type | UTC | Inputs (ordered) | Payload file | PDA |",
      "| --- | --- | --- | --- | --- | --- |",
      ...rows,
      "",
    ].join("\n"),
  };
}
