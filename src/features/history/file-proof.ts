import { PublicKey } from "@solana/web3.js";
import {
  deriveHashPda,
  inspectArchive,
  parseArchive,
  selectArchive,
  toBigInt,
  type HashArchive,
  type HashTimestampClient,
} from "../../contract/sdk";
import { resolveRecord } from "../../contract/records";
import { errorMessage, hashInput, hex } from "../workspace/values";
import { historyFromArchive } from "./archive-history";
import { assertMatchingHistory } from "./collect-proof";

export interface FileProofMatch {
  pda: string;
  id: string;
  kind: "hash" | "branch";
  createdAt: string;
}

/** A file digest is a Hash payload or a Branch version, never an aggregate/metadata digest. */
export function findFileInArchive(input: HashArchive, fileHash: string) {
  const archive = parseArchive(input);
  const digest = hex(hashInput(fileHash));
  const matches: FileProofMatch[] = [];
  for (const { pda, id } of historyFromArchive(archive)) {
    const node = archive.nodes[pda];
    const kind = node.source.kind;
    const matchesHash = kind === "hash" && node.hash === digest;
    const matchesVersion =
      node.source.kind === "branch" && node.source.payload === digest;
    if (
      (kind === "hash" || kind === "branch") &&
      (matchesHash || matchesVersion)
    )
      matches.push({
        pda,
        id,
        kind,
        createdAt: node.createdAt,
      });
  }
  matches.sort((a, b) => {
    const difference = BigInt(a.createdAt) - BigInt(b.createdAt);
    return difference < 0n
      ? -1
      : difference > 0n
        ? 1
        : a.pda.localeCompare(b.pda);
  });
  return { archive, digest, matches, inspection: inspectArchive(archive) };
}

export interface FileProofCheck {
  matched: boolean;
  message: string;
  checked: number;
  anchor?: string;
  anchorKind?: string;
}

const MAX_ANCHOR_CHECKS = 32;

/** Candidate discovery only. The SDK, not this reverse index, authenticates the links. */
function laterRecords(archive: HashArchive, target: string) {
  const program = new PublicKey(archive.programId);
  const address = (id: string) => deriveHashPda(program, id).toBase58();
  const parents = new Map<string, string[]>();
  for (const [pda, node] of Object.entries(archive.nodes)) {
    const source = node.source;
    const dependencies =
      source.kind === "branch"
        ? [address(source.previousHashId)]
        : source.kind === "batch"
          ? source.members.map(address)
          : source.kind === "pack"
            ? (node.members ?? [])
            : [];
    for (const dependency of dependencies) {
      const linked = parents.get(dependency) ?? [];
      linked.push(pda);
      parents.set(dependency, linked);
    }
  }
  const candidates = [target];
  const seen = new Set(candidates);
  for (let index = 0; index < candidates.length; index++)
    for (const pda of parents.get(candidates[index]) ?? [])
      if (!seen.has(pda)) {
        seen.add(pda);
        candidates.push(pda);
      }
  return candidates;
}

/** Read-only evidence check: no wallet, transaction, simulation, or file upload.
 * Later anchors require a complete, SDK-validated closure; partial links never confer trust.
 */
export async function checkFileProof(
  client: HashTimestampClient,
  input: HashArchive,
  fileHash: string,
  target: string,
  signal?: AbortSignal,
): Promise<FileProofCheck> {
  signal?.throwIfAborted();
  const found = findFileInArchive(input, fileHash);
  if (found.archive.programId !== client.programId.toBase58())
    throw new Error("This proof belongs to another program.");
  if (!found.matches.some((match) => match.pda === target))
    throw new Error("The selected record does not match this file.");
  const { archive } = found;
  const records = new Map(
    historyFromArchive(archive).map((record) => [record.pda, record]),
  );
  const candidates = laterRecords(archive, target);
  const problems: string[] = [];
  let checked = 0;
  for (const pda of candidates.slice(0, MAX_ANCHOR_CHECKS)) {
    signal?.throwIfAborted();
    checked++;
    try {
      const record = records.get(pda)!;
      const live = await resolveRecord(client, `id:${record.id}`);
      signal?.throwIfAborted();
      if (!live.account) continue;
      assertMatchingHistory(live.account, record.entry);
      if (toBigInt(live.account.voters) <= 0n)
        throw new Error("The live record has no votes.");
      if (pda !== target) {
        const closure = selectArchive(archive, [pda]);
        if (!closure.nodes[target] || !inspectArchive(closure).complete)
          throw new Error(
            "The saved history is incomplete for this later record.",
          );
      }
      return {
        matched: true,
        checked,
        anchor: pda,
        anchorKind: archive.nodes[pda].source.kind,
        message:
          pda === target
            ? "The file and saved timestamp match a live record."
            : "The saved file timestamp is linked to a matching live record through complete history.",
      };
    } catch (caught) {
      signal?.throwIfAborted();
      problems.push(errorMessage(caught));
    }
  }
  const limit =
    candidates.length > MAX_ANCHOR_CHECKS
      ? ` Only the first ${MAX_ANCHOR_CHECKS} possible live records were checked.`
      : "";
  return {
    matched: false,
    checked,
    message: `Could not confirm this timestamp on the selected network.${limit} ${problems[0] ?? "No matching live record was found in the saved history."} This does not mean the file never existed.`,
  };
}
