import { PublicKey } from "@solana/web3.js";
import { deriveHashPda, type ArchiveNode } from "../../contract/sdk";

/** Read stored relationships, without inventing missing Pack membership. */
export function archiveLinks(programId: string) {
  const program = new PublicKey(programId);
  const addresses = new Map<string, string>();
  const address = (id: string) => {
    if (!addresses.has(id))
      addresses.set(id, deriveHashPda(program, id).toBase58());
    return addresses.get(id)!;
  };
  return (node: ArchiveNode): readonly string[] | undefined => {
    switch (node.source.kind) {
      case "branch":
        return [address(node.source.previousHashId)];
      case "batch":
        return node.source.members.map(address);
      case "pack":
        return node.members;
      default:
        return [];
    }
  };
}
