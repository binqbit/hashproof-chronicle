import { PublicKey } from "@solana/web3.js";
import { createSigningClient } from "../../contract/client";
import {
  ArchiveRestoreExecutionError,
  canonicalHashId,
  deriveHashPda,
  type ArchiveRestorePlan,
  type ArchiveRestoreResult,
  type HashArchive,
  type HashTimestampClient,
} from "../../contract/sdk";
import type { Receipt } from "../workspace/operations";
import { errorMessage } from "../workspace/values";
import { historyFromArchive } from "./archive-history";
import { entryId } from "./collect-proof";
import type { ProofGraph } from "./proof-graph";
import type { RestoreRecordState } from "./restore-anchors";
import { shortestRestorePaths } from "./restore-paths";

/** Planning needs a payer identity for sizing, but this provider cannot sign anything. */
export function planGraphRestore(
  client: HashTimestampClient,
  archive: HashArchive,
  targets: string[],
  payer?: PublicKey,
) {
  const refuseSigning = async (): Promise<never> => {
    throw new Error("Read-only restore preview cannot sign transactions.");
  };
  const planner = createSigningClient(client.connection, {
    publicKey: payer ?? new PublicKey(new Uint8Array(32).fill(7)),
    signTransaction: refuseSigning,
    signAllTransactions: refuseSigning,
  });
  return planner.planRestore(archive, {
    targets,
    anchor: "auto",
    createAccounts: true,
  });
}

/** Show shortest history routes; a ready plan restricts routes to each step's chosen anchor/proof. */
export function restoreGraphHighlight(
  graph: ProofGraph,
  plan?: ArchiveRestorePlan,
  records?: ReadonlyMap<string, RestoreRecordState>,
  targets: readonly string[] = [],
) {
  const anchors = new Set(
    [...(records ?? [])]
      .filter(([, state]) => state.kind === "live")
      .map(([pda]) => pda),
  );
  const proofNodes = new Set<string>();
  const proofEdges = new Set<string>();
  const required = new Set<string>();
  const present = new Set([...anchors, ...(plan?.alreadyPresent ?? [])]);
  plan?.alreadyPresent.forEach((pda) => anchors.add(pda));
  if (plan) {
    const program = new PublicKey(plan.programId);
    const routedTargets = new Set(plan.alreadyPresent);
    for (const step of plan.steps) {
      anchors.add(step.anchor);
      const included = new Set(
        step.proof.map((entry) =>
          deriveHashPda(
            program,
            canonicalHashId(entry.hash, entry.source),
          ).toBase58(),
        ),
      );
      // Later steps can revalidate targets already covered by an earlier step.
      // Assign their visible route to the first step that restores them.
      const stepTargets = step.targets.filter((pda) => !routedTargets.has(pda));
      stepTargets.forEach((pda) => routedTargets.add(pda));
      // Do not join independent steps merely because their union contains both endpoints.
      const paths = shortestRestorePaths(
        graph, new Set([step.anchor]), stepTargets, included,
      );
      paths.proofNodes.forEach((pda) => proofNodes.add(pda));
      paths.proofEdges.forEach((edge) => proofEdges.add(edge));
      step.additionalRequiredCreations.forEach((pda) => required.add(pda));
      step.requestedAccounts
        .filter((pda) => !step.expectedCreations.includes(pda))
        .forEach((pda) => present.add(pda));
    }
  } else {
    const paths = shortestRestorePaths(graph, anchors, targets);
    paths.proofNodes.forEach((pda) => proofNodes.add(pda));
    paths.proofEdges.forEach((edge) => proofEdges.add(edge));
  }
  return { anchors, proofNodes, proofEdges, required, present };
}

// Confirmation authorizes these effects, not any new route found after the preview.
function planEffects(plan: ArchiveRestorePlan) {
  return JSON.stringify({
    programId: plan.programId,
    payer: plan.payer,
    feePayer: plan.feePayer,
    present: [...plan.alreadyPresent].sort(),
    steps: plan.steps.map((step) => ({
      anchor: step.anchor,
      targets: [...step.targets].sort(),
      requested: [...step.requestedAccounts].sort(),
      creations: [...step.expectedCreations].sort(),
      additional: [...step.additionalRequiredCreations].sort(),
    })),
  });
}

function restoreReceipt(
  result: ArchiveRestoreResult,
  warning?: string,
): Receipt {
  const proof = historyFromArchive(result.archive).map(({ entry }) => entry);
  return {
    signature: result.signatures[result.signatures.length - 1],
    signatures: result.signatures,
    archive: result.archive,
    proof,
    ids: proof.map(entryId),
    warning,
  };
}

/** Refresh before signing, and never silently broaden the user's selected creations. */
export async function executeGraphRestore(
  client: HashTimestampClient,
  archive: HashArchive,
  targets: string[],
  reviewed: ArchiveRestorePlan,
): Promise<Receipt> {
  if (!reviewed.steps.length)
    throw new Error("The selected records already exist; nothing to restore.");
  if (reviewed.steps.some((step) => step.additionalRequiredCreations.length))
    throw new Error(
      "Select the required intermediate records before restoring.",
    );
  const fresh = await client.planRestore(archive, {
    targets,
    anchor: "auto",
    createAccounts: true,
  });
  if (planEffects(fresh) !== planEffects(reviewed))
    throw new Error(
      "Network state or wallet changed. Check the selected records again before restoring.",
    );
  try {
    return restoreReceipt(await client.executeRestorePlan(fresh));
  } catch (error) {
    if (
      error instanceof ArchiveRestoreExecutionError &&
      error.completed.signatures.length
    )
      return restoreReceipt(
        error.completed,
        `Restore stopped after ${error.completed.signatures.length} confirmed transaction(s). Save this proof and check the remaining records again. ${errorMessage(error.cause)}`,
      );
    throw error;
  }
}
