import { PublicKey } from "@solana/web3.js";
import {
  HashTimestampClient,
  deriveGenesisHashId,
  deriveBranchHashId,
  deriveBranchHash,
  generationFromSource,
  hashSourceKindOf,
  to32Bytes,
  deriveAccountMetadataHash,
  rpcU64,
} from "../../contract/sdk";
import type {
  HashAccountData,
  HashBytes,
  RestoreProofInput,
  HashArchive,
} from "../../contract/sdk";
import {
  collectProof,
  fingerprint,
  mergeHistory,
  recordEntry,
  assertMatchingHistory,
  entryId,
} from "../history/collect-proof";
import { errorMessage, hex } from "./values";
import { checkRestore } from "../history/check-restore";

export interface Receipt {
  signature: string;
  ids: string[];
  proof?: RestoreProofInput[];
  archive?: HashArchive;
  warning?: string;
}

/** Hold the same parent/member snapshot for preview, proof and SDK instruction construction. */
class SnapshotClient extends HashTimestampClient {
  constructor(
    client: HashTimestampClient,
    private readonly snapshots: Map<string, HashAccountData>
  ) {
    super(client.program);
  }
  override fetchHashAccount(id: HashBytes) {
    return this.snapshots.has(hex(to32Bytes(id)))
      ? Promise.resolve(this.snapshots.get(hex(to32Bytes(id)))!)
      : super.fetchHashAccount(id);
  }
}

async function snapshots(client: HashTimestampClient, ids: string[]) {
  const records = await Promise.all(
    ids.map(async (id) => {
      const record = await client.fetchHashAccount(id);
      if (!record) throw new Error(`Record not found: ${id}`);
      return [id, record] as const;
    })
  );
  return new SnapshotClient(client, new Map(records));
}

/** Once a signature exists, an auxiliary read failure must not invite duplicate submission. */
async function withProof(
  client: HashTimestampClient,
  receipt: Receipt,
  history: RestoreProofInput[]
): Promise<Receipt> {
  try {
    return {
      ...receipt,
      proof: await collectProof(client, receipt.ids[0], history),
    };
  } catch (error) {
    return {
      ...receipt,
      proof: history.length ? history : undefined,
      warning: `Transaction confirmed. Only partial history was retained; it is not a complete restore proof. ${errorMessage(
        error
      )}`,
    };
  }
}

export async function register(
  client: HashTimestampClient,
  hash: Uint8Array
): Promise<Receipt> {
  const { signature, archive } = await client.register(hash);
  return withProof(
    client,
    { signature, archive, ids: [hex(deriveGenesisHashId(hash))] },
    []
  );
}

export async function branch(
  client: HashTimestampClient,
  parentId: string,
  payload: Uint8Array,
  takeVote: boolean,
  history: RestoreProofInput[]
): Promise<Receipt> {
  const snapshot = await snapshots(client, [parentId]);
  const parent = recordEntry((await snapshot.fetchHashAccount(parentId))!);
  let parentProof: RestoreProofInput[] = [];
  let warning: string | undefined;
  try {
    parentProof = await collectProof(snapshot, parentId, history);
  } catch (error) {
    warning = `Parent history not fully available: ${errorMessage(error)}`;
  }
  const id = hex(
    deriveBranchHashId(
      deriveBranchHash(
        parentId,
        parent.createdAt,
        generationFromSource(parent.source),
        hashSourceKindOf(parent.source),
        payload
      )
    )
  );
  const { signature, archive } = await snapshot.branch(
    parentId,
    payload,
    takeVote
  );
  const receipt = { signature, archive, ids: [id] };
  const retained = parentProof.length ? parentProof : [parent];
  try {
    const child = await client.fetchHashAccount(id);
    if (!child) throw new Error("The child is no longer live.");
    const tip: RestoreProofInput = {
      ...recordEntry(child),
      params: { kind: "branch", parent: fingerprint(parent) },
    };
    return withProof(client, receipt, [tip, ...retained]);
  } catch (error) {
    return {
      ...receipt,
      proof: retained,
      warning: `Transaction confirmed. Only parent history was retained; the child timestamp is unavailable. ${
        warning || ""
      } ${errorMessage(error)}`,
    };
  }
}

export async function aggregate(
  client: HashTimestampClient,
  kind: "batch" | "pack",
  ids: string[],
  history: RestoreProofInput[],
  expectedMembers: RestoreProofInput[] = [],
): Promise<Receipt> {
  const snapshot = await snapshots(client, ids);
  const expected = new Map(expectedMembers.map((entry) => [entryId(entry), entry]));
  for (const id of ids) {
    const saved = expected.get(id);
    if (saved) assertMatchingHistory((await snapshot.fetchHashAccount(id))!, saved);
  }
  const members = await Promise.all(
    ids.map(async (id) =>
      fingerprint(recordEntry((await snapshot.fetchHashAccount(id))!))
    )
  );
  let historyProof: RestoreProofInput[] = [];
  let warning: string | undefined;
  try {
    historyProof = mergeHistory(
      ...(await Promise.all(
        ids.map((id) => collectProof(snapshot, id, history))
      ))
    );
  } catch (error) {
    warning = `Member history not fully available: ${errorMessage(error)}`;
  }
  const result =
    kind === "batch" ? await snapshot.batch(ids) : await snapshot.pack(ids);
  const id = hex("batchId" in result ? result.batchId : result.packId);
  const receipt = {
    signature: result.signature,
    archive: result.archive,
    ids: [id],
  };
  const retained = historyProof.length
    ? historyProof
    : await Promise.all(
        ids.map(async (memberId) =>
          recordEntry((await snapshot.fetchHashAccount(memberId))!)
        )
      );
  try {
    const record = await client.fetchHashAccount(id);
    if (!record) throw new Error("The new aggregate is no longer live.");
    const tip: RestoreProofInput = {
      ...recordEntry(record),
      params: { kind, members },
    };
    return await withProof(client, receipt, [tip, ...retained]);
  } catch (error) {
    return {
      ...receipt,
      proof: retained,
      warning: `Transaction confirmed. Only member history was retained; aggregate timestamp is unavailable. ${
        warning || ""
      } ${errorMessage(error)}`,
    };
  }
}

export async function accountSnapshot(
  client: HashTimestampClient,
  target: PublicKey
): Promise<Receipt> {
  const before = await client.connection.getAccountInfo(target);
  if (!before || before.rentEpoch === undefined)
    throw new Error("Target snapshot is unavailable.");
  const result = await client.hashAccount(target);
  const receipt = {
    signature: result.signature,
    archive: result.archive,
    ids: [hex(result.hashId)],
  };
  if (
    hex(deriveAccountMetadataHash(target, before)) !== hex(result.metadataHash)
  ) {
    return {
      ...receipt,
      warning:
        "Transaction confirmed, but the target changed between reads. The original snapshot was not retained.",
    };
  }
  try {
    const account = await client.fetchHashAccount(result.hashId);
    if (!account) throw new Error("Snapshot record is no longer live.");
    const entry: RestoreProofInput = {
      ...recordEntry(account),
      params: {
        kind: "account",
        snapshot: {
          owner: before.owner,
          lamports: rpcU64(before.lamports),
          executable: before.executable,
          rentEpoch: rpcU64(before.rentEpoch),
          data: before.data,
        },
      },
    };
    return { ...receipt, proof: [entry] };
  } catch (error) {
    return {
      ...receipt,
      warning: `Transaction confirmed. Proof unavailable: ${errorMessage(
        error
      )}`,
    };
  }
}

export async function restore(
  client: HashTimestampClient,
  proof: RestoreProofInput[],
  createAccounts: boolean
): Promise<Receipt> {
  const checked = await checkRestore(
    client,
    proof,
    createAccounts,
    client.program.provider.publicKey
  );
  if (checked.errors.length) throw new Error(checked.errors.join(" "));
  const result = await client.restore(proof, { createAccounts });
  return {
    signature: result.signature,
    ids: result.restoredIds.map(hex),
    proof,
    warning: createAccounts
      ? "IDs list requested records, including records that already existed."
      : "Proof-only validation confirmed; no ancestor accounts were requested.",
  };
}
