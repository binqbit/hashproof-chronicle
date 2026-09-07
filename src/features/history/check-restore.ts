import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { resolveRecord } from "../../contract/records";
import {
  decodeHashSource,
  encodeHashSource,
  prepareRestore,
  toBigInt,
  type HashTimestampClient,
  type RestoreProofInput,
} from "../../contract/sdk";
import { errorMessage } from "../workspace/values";
import { validateProof } from "./validate-proof";

export interface RestoreCheck {
  nodes: { id: string; state: string; requested: boolean }[];
  errors: string[];
  warnings: string[];
  transactionBytes?: number;
}

/** Read-only state checks. Proof-only validation deliberately ignores non-anchor incarnations. */
export async function checkRestore(
  client: HashTimestampClient,
  proof: RestoreProofInput[],
  create: boolean,
  payer?: PublicKey,
): Promise<RestoreCheck> {
  const local = validateProof(proof);
  const errors: string[] = [];
  const warnings = [...local.warnings];
  const nodes = await Promise.all(
    local.ids.map(async (id, index) => {
      const entry = proof[index];
      const requested = create && index > 0 && Boolean(entry.params);
      try {
        const { account } = await resolveRecord(client, id);
        const matches =
          account &&
          toBigInt(account.createdAt) === toBigInt(entry.createdAt) &&
          JSON.stringify(encodeHashSource(decodeHashSource(account.source))) ===
            JSON.stringify(encodeHashSource(entry.source));
        if (index === 0 && !matches)
          errors.push(
            "The live anchor is missing or does not match the proof's historical incarnation.",
          );
        if (requested && account && !matches)
          errors.push(
            `Historical incarnation conflict: ${id}. Proof-only mode can still validate retained history.`,
          );
        // Only the anchor and supplied materialization accounts are visible to the instruction.
        if (
          local.needsExisting.includes(index) &&
          !(matches && (index === 0 || requested))
        )
          errors.push(
            `Original account snapshot required for entry ${index}; its live record is not available to this instruction.`,
          );
        return {
          id,
          requested,
          state: !account
            ? requested
              ? "Will be recreated"
              : "No live record"
            : matches
              ? index === 0
                ? "Live anchor matches"
                : "Historical state matches"
              : "Different historical incarnation",
        };
      } catch (error) {
        const message = `Entry ${index}: ${errorMessage(error)}`;
        // A read failure is not evidence of absence, even for optional state previews.
        errors.push(message);
        return { id, requested, state: "Could not validate account" };
      }
    }),
  );
  let transactionBytes: number | undefined;
  try {
    const { proofEncoded, anchorId, restoredIds } = prepareRestore(
      proof,
      create,
    );
    const voter = payer ?? new PublicKey(new Uint8Array(32).fill(7));
    const instruction = await client.program.methods
      .restore(proofEncoded)
      .accountsStrict({
        payer: voter,
        anchorHashAccount: client.hashPda(anchorId),
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(
        restoredIds.flatMap((id) => [
          { pubkey: client.hashPda(id), isSigner: false, isWritable: true },
          {
            pubkey: client.votePda(id, voter),
            isSigner: false,
            isWritable: true,
          },
        ]),
      )
      .instruction();
    const transaction = new Transaction({
      feePayer: voter,
      recentBlockhash: PublicKey.default.toBase58(),
    }).add(instruction);
    transactionBytes = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    }).length;
  } catch (error) {
    errors.push(
      `Cannot encode this proof into a single transaction: ${errorMessage(error)}`,
    );
  }
  warnings.push(
    "RPC state can change. This preflight is not a simulation, confirmation, or a guarantee of sufficient SOL; the contract checks again on submission.",
  );
  return { nodes, errors, warnings, transactionBytes };
}
