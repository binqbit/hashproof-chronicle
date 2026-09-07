import type { PublicKey } from "@solana/web3.js";
import {
  resolveLiveRecord,
  resolveMembers,
  resolveRecord,
} from "../../contract/records";
import {
  canonicalHashId,
  decodeHashSource,
  deriveBranchHash,
  deriveBatchHash,
  derivePackHash,
  generationFromSource,
  hashSourceKindOf,
  type HashTimestampClient,
  type RestoreProofInput,
} from "../../contract/sdk";
import { hex } from "../workspace/values";
import { assertMatchingHistory, entryId } from "../history/collect-proof";

export async function checkBranch(
  client: HashTimestampClient,
  input: string,
  payload: Uint8Array,
  takeVote: boolean,
  voter?: PublicKey,
) {
  const parent = await resolveLiveRecord(client, input);
  const source = decodeHashSource(parent.account.source);
  const generation = generationFromSource(source);
  if (generation === (1n << 64n) - 1n)
    throw new Error("Parent generation cannot be incremented (u64 overflow).");
  if (takeVote && !voter)
    throw new Error("Connect your wallet to check parent-vote withdrawal.");
  if (takeVote && !(await client.fetchVoteInfo(parent.id, voter!)))
    throw new Error(
      "You have no parent vote to withdraw. Turn off parent-vote withdrawal.",
    );
  const id = hex(
    canonicalHashId(
      deriveBranchHash(
        parent.id,
        parent.account.createdAt,
        generation,
        hashSourceKindOf(source),
        payload,
      ),
      2,
    ),
  );
  const target = await resolveRecord(client, id);
  if (target.account)
    throw new Error(
      `This branch already exists: ${id}. Inspect it to add a vote.`,
    );
  return { parent, id, pda: target.pda };
}

export async function checkAggregate(
  client: HashTimestampClient,
  kind: "batch" | "pack",
  input: string,
  history: RestoreProofInput[] = [],
) {
  const members = await resolveMembers(client, input);
  const retained = new Map(history.map((entry) => [entryId(entry), entry]));
  for (const member of members) {
    const saved = retained.get(member.id);
    if (saved) assertMatchingHistory(member.account, saved);
  }
  const fingerprints = members.map(({ account }) => ({
    hash: account.hash,
    kind: hashSourceKindOf(decodeHashSource(account.source)),
    createdAt: account.createdAt,
  }));
  const hash =
    kind === "batch"
      ? deriveBatchHash(fingerprints)
      : derivePackHash(fingerprints);
  const id = hex(canonicalHashId(hash, kind === "batch" ? 3 : 4));
  const target = await resolveRecord(client, id);
  if (target.account)
    throw new Error(
      `This ${kind} already exists: ${id}. Inspect it to add a vote.`,
    );
  return { members, id, pda: target.pda };
}
