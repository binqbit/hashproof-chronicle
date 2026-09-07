import {
  parseArchive,
  type HashArchive,
  type RestoreProofInput,
} from "../../contract/sdk";
import { entryId, fingerprint } from "./collect-proof";

/** Adapt validated archive data to the collector, keeping witnesses even on leaf/anchor records.
 * Missing dependencies stay missing; changing membership does not discard retained history.
 */
export function historyFromArchive(input: HashArchive) {
  const archive = parseArchive(input);
  const records = Object.entries(archive.nodes).map(([pda, node]) => {
    const entry: RestoreProofInput = {
      hash: node.hash,
      source:
        node.source.kind === "branch"
          ? { ...node.source, generation: BigInt(node.source.generation) }
          : node.source,
      createdAt: BigInt(node.createdAt),
    };
    return { pda, id: entryId(entry), entry };
  });
  const byId = new Map(records.map((record) => [record.id, record.entry]));
  const byPda = new Map(records.map((record) => [record.pda, record.entry]));
  for (const { pda, entry } of records) {
    const node = archive.nodes[pda];
    const source = node.source;
    switch (source.kind) {
      case "hash":
        entry.params = { kind: "hash", payload: node.hash };
        break;
      case "account":
        // Omit incomplete params so merging cannot erase a previously saved witness.
        if (node.snapshot)
          entry.params = {
            kind: "account",
            snapshot: { ...node.snapshot, data: [...node.snapshot.data] },
          };
        break;
      case "branch": {
        const parent = byId.get(source.previousHashId);
        if (parent)
          entry.params = { kind: "branch", parent: fingerprint(parent) };
        break;
      }
      case "batch":
      case "pack": {
        const members =
          source.kind === "batch"
            ? source.members.map((id) => byId.get(id))
            : node.members?.map((address) => byPda.get(address));
        if (members?.every((member) => member !== undefined))
          entry.params = {
            kind: source.kind,
            members: members.map(fingerprint),
          };
        break;
      }
    }
  }
  return records;
}
