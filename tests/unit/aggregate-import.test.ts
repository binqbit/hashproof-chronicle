import { expect, it, vi } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { BorshAccountsCoder } from "@coral-xyz/anchor";
import example from "../../hash-timestamp/examples/archive.json";
import {
  archiveFromProof,
  createArchive,
  IDL,
  parseArchive,
  stringifyArchive,
} from "../../src/contract/sdk";
import {
  readArchiveFiles,
  MAX_PROOF_FILE_BYTES,
} from "../../src/features/history/archive-files";
import { historyFromArchive } from "../../src/features/history/archive-history";
import {
  collectProof,
  entryId,
  mergeHistory,
} from "../../src/features/history/collect-proof";
import { proofJson } from "../../src/features/history/proof-format";
import { checkAggregate } from "../../src/features/records/preflight";
import { hashEntry, recordFixture } from "./fixtures/records";

const rpc = "http://127.0.0.1:8899";
const file = (text: string, name = "proof.json") => new File([text], name);

it("reads one or more proof/merged files locally, preserving all history and deduplicating", async () => {
  const proof = hashEntry();
  const archive = archiveFromProof(IDL.address, [proof]);
  const result = await readArchiveFiles(
    [
      file(proofJson([proof], IDL.address, rpc)),
      file(stringifyArchive(archive)),
    ],
    IDL.address,
    { rpc },
  );
  expect(result.archive).toEqual(archive);
  expect(historyFromArchive(result.archive).map((record) => record.id)).toEqual(
    [entryId(proof)],
  );
  expect(
    (
      await readArchiveFiles([file(stringifyArchive(archive))], IDL.address, {
        rpc,
      })
    ).archive,
  ).toEqual(archive);
});

it("retains Account snapshots and ordered Pack/Batch fingerprints through archive conversion", () => {
  const archive = parseArchive(example);
  const history = historyFromArchive(archive).map((record) => record.entry);
  expect(new Set(history.map((entry) => entry.source.kind))).toEqual(
    new Set(["hash", "account", "branch", "batch", "pack"]),
  );
  expect(archiveFromProof(archive.programId, history)).toEqual(archive);
  const account = history.find((entry) => entry.source.kind === "account")!;
  expect(account.params?.kind).toBe("account");
  if (account.params?.kind === "account")
    expect(account.params.snapshot?.data).toEqual([1, 2, 3]);
});

it("accepts partial archives without inventing missing member fingerprints", () => {
  const archive = archiveFromProof(IDL.address, [
    { ...hashEntry(), source: { kind: "pack" }, params: undefined },
  ]);
  const [record] = historyFromArchive(archive);
  expect(record.entry.params).toBeUndefined();
  expect(record.entry.source.kind).toBe("pack");
});

it("keeps a retained Account snapshot when the imported archive has no snapshot", async () => {
  const f = recordFixture();
  const saved = historyFromArchive(parseArchive(example)).find(
    ({ entry }) => entry.source.kind === "account",
  )!.entry;
  const partial = archiveFromProof(IDL.address, [
    { ...saved, params: undefined },
  ]);
  const imported = historyFromArchive(partial).map(({ entry }) => entry);
  const pda = await f.put(saved);
  vi.spyOn(f.client, "fetchHashAccount").mockResolvedValue(
    new BorshAccountsCoder(IDL).decode(
      "hashAccount",
      f.records.get(pda.toBase58())!.data,
    ),
  );
  // The source account is no longer available; only its retained snapshot can help.
  const proof = await collectProof(
    f.client,
    entryId(saved),
    mergeHistory([saved], imported),
  );
  expect(proof[0].params).toEqual(saved.params);
  expect(f.read).not.toHaveBeenCalled();
});

it("rejects wrong programs/networks and conflicting historical records before selection", async () => {
  await expect(
    readArchiveFiles(
      [file(stringifyArchive(createArchive(PublicKey.default)))],
      IDL.address,
      { rpc },
    ),
  ).rejects.toThrow("another program");
  await expect(
    readArchiveFiles(
      [file(proofJson([hashEntry()], IDL.address, "http://different.invalid"))],
      IDL.address,
      { rpc },
    ),
  ).rejects.toThrow("another program or RPC");
  await expect(
    readArchiveFiles(
      [
        file(proofJson([hashEntry()], IDL.address, rpc)),
        file(proofJson([hashEntry(1, 999n)], IDL.address, rpc)),
      ],
      IDL.address,
      { rpc },
    ),
  ).rejects.toThrow("Conflicting historical incarnation");
});

it("enforces file limits and rejects malformed input without reading oversized files", async () => {
  const oversized = file("{}");
  Object.defineProperty(oversized, "size", { value: MAX_PROOF_FILE_BYTES + 1 });
  const read = vi.spyOn(oversized, "text");
  await expect(
    readArchiveFiles([oversized], IDL.address, { rpc }),
  ).rejects.toThrow("16 MiB");
  expect(read).not.toHaveBeenCalled();
  await expect(
    readArchiveFiles([file("{", "broken.json")], IDL.address, { rpc }),
  ).rejects.toThrow("broken.json:");
});

it.each(["batch", "pack"] as const)(
  "checks saved selected records against live history for %s",
  async (kind) => {
    const f = recordFixture();
    const saved = hashEntry();
    const id = entryId(saved);
    await f.put(saved);
    expect(
      (await checkAggregate(f.client, kind, id, [saved])).members.map(
        (member) => member.id,
      ),
    ).toEqual([id]);
    await f.put(hashEntry(1, 101n));
    await expect(checkAggregate(f.client, kind, id, [saved])).rejects.toThrow(
      "no longer matches the imported history",
    );
    f.records.clear();
    await expect(checkAggregate(f.client, kind, id, [saved])).rejects.toThrow(
      "not live",
    );
  },
);
