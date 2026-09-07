import {
  parseArchive,
  readArchiveRecord,
  sameArchiveRecord,
  type HashArchive,
  type HashTimestampClient,
} from "../../contract/sdk";
import { errorMessage } from "../workspace/values";

export type RestoreRecordState =
  | { kind: "live" | "missing" }
  | { kind: "conflict" | "error"; message: string };

/** Existence is independent of proof completeness, selected targets and transaction size. */
export async function readRestoreAnchors(
  client: HashTimestampClient,
  input: HashArchive,
  signal?: AbortSignal,
): Promise<Map<string, RestoreRecordState>> {
  signal?.throwIfAborted();
  const archive = parseArchive(input);
  if (archive.programId !== client.programId.toBase58())
    throw new Error("This proof belongs to another program.");
  const records = new Map<string, RestoreRecordState>();
  const entries = Object.entries(archive.nodes);
  // Bound RPC concurrency, and stop scheduling reads when a file is replaced.
  for (let offset = 0; offset < entries.length; offset += 8) {
    signal?.throwIfAborted();
    await Promise.all(
      entries.slice(offset, offset + 8).map(async ([pda, saved]) => {
        try {
          const live = await readArchiveRecord(client.program, pda);
          signal?.throwIfAborted();
          records.set(
            pda,
            !live
              ? { kind: "missing" }
              : sameArchiveRecord(live, saved)
                ? { kind: "live" }
                : {
                    kind: "conflict",
                    message:
                      "This address exists, but its record does not match the saved history.",
                  },
          );
        } catch (error) {
          signal?.throwIfAborted();
          // Failed reads or invalid account data are unknown, never absent or trusted.
          records.set(pda, { kind: "error", message: errorMessage(error) });
        }
      }),
    );
  }
  signal?.throwIfAborted();
  return records;
}
